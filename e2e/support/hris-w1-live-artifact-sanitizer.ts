import { constants as fsConstants, type BigIntStats } from 'node:fs';
import { chmod, open, rm } from 'node:fs/promises';

const MAX_HAR_BYTES = 32 * 1024 * 1024;
const SAFE_REQUEST_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-length',
  'content-type',
  'origin',
  'user-agent',
  'x-correlation-id',
  'x-request-id',
]);
const SAFE_RESPONSE_HEADERS = new Set([
  'cache-control',
  'content-length',
  'content-type',
  'date',
  'server',
  'x-correlation-id',
  'x-request-id',
]);
const CREDENTIAL_HEADER =
  /^(?:authorization|cookie|set-cookie|proxy-authorization|(?:x-)?(?:csrf|xsrf)-token)$/iu;

type JsonRecord = Record<string, unknown>;

function object(value: unknown, location: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${location} must be an object`);
  }
  return value as JsonRecord;
}

function sameStat(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function readAttested(pathname: string): Promise<Buffer> {
  if (typeof fsConstants.O_NOFOLLOW !== 'number') {
    throw new Error('HAR attestation requires O_NOFOLLOW support.');
  }
  const handle = await open(
    pathname,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | (fsConstants.O_CLOEXEC ?? 0)
  );
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size <= 0n) {
      throw new Error('Raw HAR must be one non-empty, singly linked regular file.');
    }
    if (before.size > BigInt(MAX_HAR_BYTES)) {
      throw new Error('Raw HAR exceeds the 32 MiB fail-closed limit.');
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameStat(before, after) || BigInt(bytes.byteLength) !== before.size) {
      throw new Error('Raw HAR changed while it was read.');
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function redactURL(value: string): string {
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) url.searchParams.set(key, '[REDACTED]');
    return url.toString();
  } catch {
    return '[INVALID_URL_REDACTED]';
  }
}

export async function sanitizeHrisW1Har(
  rawPath: string,
  safePath: string,
  forbiddenValues: readonly string[]
): Promise<void> {
  try {
    const secretValues = new Set(forbiddenValues);
    const har = object(JSON.parse((await readAttested(rawPath)).toString('utf8')), 'HAR');
    const log = object(har.log, 'HAR.log');
    const entries = Array.isArray(log.entries) ? log.entries : [];
    for (const entryValue of entries) {
      const entry = object(entryValue, 'HAR entry');
      for (const sideName of ['request', 'response'] as const) {
        const side = object(entry[sideName], `HAR entry.${sideName}`);
        if (typeof side.url === 'string') side.url = redactURL(side.url);
        if (sideName === 'request' && Array.isArray(side.queryString)) {
          side.queryString = side.queryString.map((queryValue) => ({
            ...object(queryValue, 'HAR query'),
            value: '[REDACTED]',
          }));
        }
        if (sideName === 'response' && typeof side.redirectURL === 'string') {
          side.redirectURL = side.redirectURL ? '[REDACTED]' : '';
        }
        const safeHeaders = sideName === 'request' ? SAFE_REQUEST_HEADERS : SAFE_RESPONSE_HEADERS;
        if (Array.isArray(side.headers)) {
          for (const headerValue of side.headers) {
            const header = object(headerValue, 'HAR header');
            if (
              typeof header.name === 'string' &&
              CREDENTIAL_HEADER.test(header.name) &&
              typeof header.value === 'string' &&
              header.value.length >= 8
            ) {
              secretValues.add(header.value);
            }
          }
          side.headers = side.headers.filter((headerValue) => {
            const header = object(headerValue, 'HAR header');
            return typeof header.name === 'string' && safeHeaders.has(header.name.toLowerCase());
          });
        }
        if (Array.isArray(side.cookies)) {
          for (const cookieValue of side.cookies) {
            const cookie = object(cookieValue, 'HAR cookie');
            if (typeof cookie.value === 'string' && cookie.value.length >= 8) {
              secretValues.add(cookie.value);
            }
          }
        }
        side.cookies = [];
        if (sideName === 'request') delete side.postData;
        else {
          const content = side.content;
          if (content && typeof content === 'object' && !Array.isArray(content)) {
            delete (content as JsonRecord).text;
          }
        }
      }
    }
    const serialized = `${JSON.stringify(har, null, 2)}\n`;
    if (Array.from(secretValues).some((value) => value && serialized.includes(value))) {
      throw new Error('Sanitized HAR still contains a synthetic credential value.');
    }
    if (
      /"name"\s*:\s*"(?:authorization|cookie|set-cookie|proxy-authorization|(?:x-)?(?:csrf|xsrf)-token)"/iu.test(
        serialized
      )
    ) {
      throw new Error('Sanitized HAR still contains a credential-bearing header.');
    }
    const output = await open(
      safePath,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        fsConstants.O_NOFOLLOW |
        (fsConstants.O_CLOEXEC ?? 0),
      0o600
    );
    try {
      await output.writeFile(serialized, 'utf8');
      await output.sync();
    } finally {
      await output.close();
    }
    await chmod(safePath, 0o600);
  } finally {
    await rm(rawPath, { force: true });
  }
}
