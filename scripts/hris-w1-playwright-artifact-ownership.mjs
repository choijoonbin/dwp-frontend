import { createHash, timingSafeEqual } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const HRIS_W1_ARTIFACT_OWNER_ENV = 'HRIS_W1_LIVE_ARTIFACT_OWNER_TOKEN';
export const HRIS_W1_ARTIFACT_OWNER_MARKER = '.hris-w1-playwright-owner.json';

const OWNER_SCHEMA = 'hris-w1-playwright-artifact-owner/v1';
const OWNER_TOKEN = /^[0-9a-f]{64}$/u;
const RUN_ID = /^[a-z0-9][a-z0-9-]{7,63}$/u;

function fail(message) {
  throw new Error(`HRIS W1 artifact ownership rejected: ${message}`);
}

function sameStat(left, right) {
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

function markerBytes(artifactRoot, runId, ownerToken) {
  const ownerBindingSha256 = createHash('sha256')
    .update('hris-w1-playwright-artifact-owner\0', 'utf8')
    .update(runId, 'utf8')
    .update('\0', 'utf8')
    .update(artifactRoot, 'utf8')
    .update('\0', 'utf8')
    .update(ownerToken, 'utf8')
    .digest('hex');
  return Buffer.from(
    `${JSON.stringify({ schemaVersion: OWNER_SCHEMA, runId, ownerBindingSha256 })}\n`,
    'utf8'
  );
}

function validateBoundary(artifactRoot, runId, ownerToken) {
  if (!RUN_ID.test(runId)) fail('run id is noncanonical.');
  if (!OWNER_TOKEN.test(ownerToken)) fail(`${HRIS_W1_ARTIFACT_OWNER_ENV} is noncanonical.`);
  if (
    !path.isAbsolute(artifactRoot) ||
    path.resolve(artifactRoot) !== artifactRoot ||
    path.basename(artifactRoot) !== `hris-w1-live-browser-${runId}` ||
    path.dirname(artifactRoot) === path.parse(artifactRoot).root
  ) {
    fail('artifact directory is not the exact absolute run-bound path.');
  }
  const parent = path.dirname(artifactRoot);
  let parentStat;
  try {
    parentStat = lstatSync(parent, { bigint: true });
  } catch {
    fail('artifact parent does not exist.');
  }
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    fail('artifact parent must be a non-symlink directory.');
  }
}

function verifyOwnedDirectory(artifactRoot, expectedMarker) {
  let rootStat;
  try {
    rootStat = lstatSync(artifactRoot, { bigint: true });
  } catch {
    fail('artifact directory disappeared during ownership verification.');
  }
  if (
    !rootStat.isDirectory() ||
    rootStat.isSymbolicLink() ||
    Number(rootStat.mode & 0o777n) !== 0o700
  ) {
    fail('existing artifact path is not the private owned directory.');
  }
  if (typeof fsConstants.O_NOFOLLOW !== 'number') fail('O_NOFOLLOW support is required.');
  const markerPath = path.join(artifactRoot, HRIS_W1_ARTIFACT_OWNER_MARKER);
  let descriptor;
  try {
    descriptor = openSync(
      markerPath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | (fsConstants.O_CLOEXEC ?? 0)
    );
  } catch {
    fail('refusing to reuse an artifact directory without its live owner marker.');
  }
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile() ||
      before.nlink !== 1n ||
      Number(before.mode & 0o777n) !== 0o600 ||
      before.size !== BigInt(expectedMarker.byteLength)
    ) {
      fail('artifact owner marker metadata is invalid.');
    }
    const actual = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameStat(before, after) || actual.byteLength !== expectedMarker.byteLength) {
      fail('artifact owner marker changed while it was read.');
    }
    if (!timingSafeEqual(actual, expectedMarker)) {
      fail('refusing to reuse an artifact directory owned by another execution.');
    }
  } finally {
    closeSync(descriptor);
  }
  return 'REUSED_BY_OWNER';
}

export function claimHrisW1ArtifactRoot(artifactRoot, runId, ownerToken) {
  validateBoundary(artifactRoot, runId, ownerToken);
  const expectedMarker = markerBytes(artifactRoot, runId, ownerToken);
  try {
    mkdirSync(artifactRoot, { mode: 0o700 });
  } catch (error) {
    if (error?.code === 'EEXIST') return verifyOwnedDirectory(artifactRoot, expectedMarker);
    throw error;
  }
  chmodSync(artifactRoot, 0o700);
  const markerPath = path.join(artifactRoot, HRIS_W1_ARTIFACT_OWNER_MARKER);
  try {
    writeFileSync(markerPath, expectedMarker, { flag: 'wx', mode: 0o600 });
    chmodSync(markerPath, 0o600);
  } catch {
    fail('could not create the exclusive artifact owner marker.');
  }
  return 'CREATED_BY_OWNER';
}
