import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateRawSync, inflateSync } from 'node:zlib';

const MAXIMUM_FILE_BYTES = 256 * 1024 * 1024;
const MAXIMUM_ZIP_ENTRY_BYTES = 64 * 1024 * 1024;
const MAXIMUM_ZIP_EXPANDED_BYTES = 512 * 1024 * 1024;
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PIXEL_CANARY_MINIMUM_CHECKER_CELLS = 9;

const forbiddenPatterns = [
  {
    id: 'authorization-bearer',
    expression: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/giu,
  },
  {
    id: 'jwt',
    expression: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu,
  },
  {
    id: 'activation-token',
    expression: /\bactivationToken\b\s*[=:]\s*["']?[A-Za-z0-9._~+/=-]{4,}/giu,
  },
  {
    id: 'session-cookie',
    expression: /\bDWP_SESSION\b/gu,
  },
  {
    id: 'cookie-header',
    expression: /\b(?:set-cookie|cookie)\s*[=:]\s*["']?[^"'\r\n]{3,}/giu,
  },
  {
    id: 'secret-assignment',
    expression:
      /\b(?:client_secret|api[_-]?key|access[_-]?token|refresh[_-]?token|password)\b\s*[=:]\s*["']?[^\s,"'}]{4,}/giu,
  },
  {
    id: 'email',
    expression: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    // E2E fixtures use IANA-reserved pseudo-domains so that generated artifacts
    // can never contain a routable customer address. Keep those deterministic
    // fixtures out of the PII signal while scanning every other address.
    ignore: (value) =>
      /@(?:[^@\s]+\.)?(?:example|invalid|test)$/iu.test(value) ||
      /\.(?:gif|html?|jpe?g|json|png|svg|trace|webp)$/iu.test(value),
  },
  {
    id: 'pii-canary',
    expression: /\bDWP[_-](?:PII|SECRET|TOKEN)[_-]CANARY(?:[_-][A-Z0-9]+)*\b/giu,
  },
];

function fail(message) {
  throw new Error(`Provider artifact DLP scan could not complete safely: ${message}`);
}

function findZipEnd(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_SIGNATURE) return offset;
  }
  return -1;
}

export function readZipEntries(buffer, label = 'archive.zip') {
  const endOffset = findZipEnd(buffer);
  if (endOffset < 0) fail(`${label} has no valid ZIP end record`);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (entryCount === 0xffff || centralOffset === 0xffffffff) {
    fail(`${label} uses unsupported ZIP64 metadata`);
  }

  const entries = [];
  let offset = centralOffset;
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_SIGNATURE) {
      fail(`${label} has an invalid central directory`);
    }
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const expandedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nameEnd = offset + 46 + fileNameLength;
    if (nameEnd > buffer.length) fail(`${label} has a truncated entry name`);
    const name = buffer.subarray(offset + 46, nameEnd).toString('utf8');
    offset = nameEnd + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (expandedSize > MAXIMUM_ZIP_ENTRY_BYTES) {
      fail(`${label}/${name} exceeds the per-entry scan limit`);
    }
    expandedBytes += expandedSize;
    if (expandedBytes > MAXIMUM_ZIP_EXPANDED_BYTES) {
      fail(`${label} exceeds the expanded archive scan limit`);
    }
    if (
      localOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localOffset) !== ZIP_LOCAL_SIGNATURE
    ) {
      fail(`${label}/${name} has an invalid local header`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataOffset + compressedSize;
    if (dataEnd > buffer.length) fail(`${label}/${name} is truncated`);
    const compressed = buffer.subarray(dataOffset, dataEnd);
    let data;
    if (compression === 0) data = Buffer.from(compressed);
    else if (compression === 8) data = inflateRawSync(compressed);
    else fail(`${label}/${name} uses unsupported ZIP compression ${compression}`);
    if (data.length !== expandedSize) fail(`${label}/${name} has an invalid expanded size`);
    entries.push({ name, data });
  }
  return entries;
}

function scanText(text, location, findings) {
  for (const pattern of forbiddenPatterns) {
    pattern.expression.lastIndex = 0;
    let count = 0;
    for (const match of text.matchAll(pattern.expression)) {
      if (!pattern.ignore?.(match[0])) count += 1;
    }
    if (count > 0) findings.push({ kind: pattern.id, location, count });
  }
}

function paethPredictor(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function pixelCanaryColor(row, pixel, channels, colorType) {
  const index = pixel * channels;
  const red = row[index];
  const green = colorType === 0 || colorType === 4 ? red : row[index + 1];
  const blue = colorType === 0 || colorType === 4 ? red : row[index + 2];
  if (red === 255 && green === 0 && blue === 255) return 'magenta';
  if (red === 0 && green === 255 && blue === 255) return 'cyan';
  return null;
}

function scanPngPixelCanary(buffer, location, findings) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${location} has an invalid PNG signature`);
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const imageData = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) fail(`${location} has a truncated PNG chunk`);
    const data = buffer.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      if (length !== 13) fail(`${location} has an invalid PNG header`);
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') imageData.push(data);
    else if (type === 'IEND') break;
    offset = dataEnd + 4;
  }
  if (!width || !height || imageData.length === 0) fail(`${location} has no PNG image data`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (bitDepth !== 8 || !channels || interlace !== 0) {
    fail(`${location} uses an unsupported PNG pixel format`);
  }
  const rowBytes = width * channels;
  const expandedPixelBytes = (rowBytes + 1) * height;
  if (
    !Number.isSafeInteger(expandedPixelBytes) ||
    expandedPixelBytes > MAXIMUM_ZIP_EXPANDED_BYTES
  ) {
    fail(`${location} exceeds the expanded PNG scan limit`);
  }
  const inflated = inflateSync(Buffer.concat(imageData));
  if (inflated.length !== expandedPixelBytes) {
    fail(`${location} has an invalid PNG scanline length`);
  }
  let previous = Buffer.alloc(rowBytes);
  let cursor = 0;
  let checkerCells = 0;
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const encoded = inflated.subarray(cursor, cursor + rowBytes);
    cursor += rowBytes;
    const decoded = Buffer.allocUnsafe(rowBytes);
    for (let index = 0; index < rowBytes; index += 1) {
      const left = index >= channels ? decoded[index - channels] : 0;
      const above = previous[index] ?? 0;
      const upperLeft = index >= channels ? previous[index - channels] : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : filter === 4
                  ? paethPredictor(left, above, upperLeft)
                  : null;
      if (predictor === null) fail(`${location} uses unsupported PNG filter ${filter}`);
      decoded[index] = (encoded[index] + predictor) & 0xff;
    }
    if (rowIndex > 0) {
      for (let pixel = 1; pixel < width; pixel += 1) {
        const current = pixelCanaryColor(decoded, pixel, channels, colorType);
        const left = pixelCanaryColor(decoded, pixel - 1, channels, colorType);
        const above = pixelCanaryColor(previous, pixel, channels, colorType);
        const upperLeft = pixelCanaryColor(previous, pixel - 1, channels, colorType);
        if (current && current === upperLeft && left === above && current !== left) {
          checkerCells += 1;
        }
      }
    }
    previous = decoded;
  }
  if (checkerCells >= PIXEL_CANARY_MINIMUM_CHECKER_CELLS) {
    findings.push({
      kind: 'pii-canary-pixel-marker',
      location,
      count: checkerCells,
    });
  }
}

function embeddedZipPayloads(text) {
  const payloads = [];
  const expression = /data:application\/zip;base64,([A-Za-z0-9+/=]+)/gu;
  for (const match of text.matchAll(expression)) {
    if (match[1]) payloads.push(Buffer.from(match[1], 'base64'));
  }
  return payloads;
}

function isPlaywrightSourceEntry(name) {
  return /^resources\/src@[a-f0-9]+\.txt$/iu.test(name);
}

function scanZip(buffer, location, findings) {
  for (const entry of readZipEntries(buffer, location)) {
    const nestedLocation = `${location}!/${entry.name}`;
    // Playwright can copy the test implementation into retry traces. It is not
    // runtime evidence and intentionally contains synthetic canaries used to
    // prove the scanner. Network/event traces, snapshots, response resources,
    // attachments and nested archives remain recursively scanned.
    if (isPlaywrightSourceEntry(entry.name)) continue;
    if (entry.name.toLowerCase().endsWith('.zip')) scanZip(entry.data, nestedLocation, findings);
    else scanBuffer(entry.data, nestedLocation, findings);
  }
}

function scanBuffer(buffer, location, findings, { scanRawText = true } = {}) {
  if (location.toLowerCase().endsWith('.png')) scanPngPixelCanary(buffer, location, findings);
  const text = buffer.toString('utf8');
  if (scanRawText) scanText(text, location, findings);
  for (const [index, payload] of embeddedZipPayloads(text).entries()) {
    scanZip(payload, `${location}!/embedded-report-${index + 1}.zip`, findings);
  }
}

function playwrightReportFileMode(path, roots) {
  for (const root of roots) {
    const fromRoot = relative(root, path).replaceAll('\\', '/');
    if (fromRoot.startsWith('../') || fromRoot === '..') continue;
    if (!/^(?:playwright-report(?:-.+)?|report)$/u.test(basename(root))) continue;
    if (fromRoot === 'index.html') return 'embedded-report';
    if (fromRoot.startsWith('trace/')) return 'viewer-asset';
  }
  return 'artifact';
}

async function collectFiles(path, files) {
  const metadata = await lstat(path).catch(() => null);
  if (!metadata) return false;
  if (metadata.isSymbolicLink()) fail(`${path} is a symbolic link`);
  if (metadata.isFile()) {
    files.push(path);
    return true;
  }
  if (!metadata.isDirectory()) fail(`${path} is not a regular file or directory`);
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    await collectFiles(resolve(path, entry.name), files);
  }
  return true;
}

export async function scanProviderArtifacts(inputPaths) {
  const roots = inputPaths.map((path) => resolve(path));
  const files = [];
  const filesByRoot = new Map();
  for (const root of roots) {
    const metadata = await lstat(root).catch(() => null);
    if (!metadata) fail(`requested artifact root does not exist: ${root}`);
    if (metadata.isSymbolicLink()) fail(`${root} is a symbolic link`);
    if (!metadata.isDirectory()) fail(`${root} is not a directory`);
    const rootFiles = [];
    await collectFiles(root, rootFiles);
    if (rootFiles.length === 0) fail(`${root} contains no files`);
    filesByRoot.set(root, rootFiles);
    files.push(...rootFiles);
  }

  const findings = [];
  let filesScanned = 0;
  const runtimeEvidenceByRoot = new Map(roots.map((root) => [root, 0]));
  for (const path of files) {
    const reportMode = playwrightReportFileMode(path, roots);
    if (reportMode === 'viewer-asset') continue;
    const metadata = await lstat(path);
    if (metadata.size > MAXIMUM_FILE_BYTES) fail(`${path} exceeds the file scan limit`);
    const buffer = await readFile(path);
    const location =
      roots.length === 1 ? `${basename(roots[0])}/${path.slice(roots[0].length + 1)}` : path;
    if (path.toLowerCase().endsWith('.zip')) scanZip(buffer, location, findings);
    else scanBuffer(buffer, location, findings, { scanRawText: reportMode !== 'embedded-report' });
    filesScanned += 1;
    for (const [root, rootFiles] of filesByRoot) {
      if (rootFiles.includes(path))
        runtimeEvidenceByRoot.set(root, runtimeEvidenceByRoot.get(root) + 1);
    }
  }
  for (const [root, count] of runtimeEvidenceByRoot) {
    if (count === 0) fail(`${root} contains no runtime evidence`);
  }
  return { filesScanned, findings };
}

export function formatFindings(findings) {
  return findings
    .map((finding) => `- ${finding.kind}: ${finding.location} (${finding.count} occurrence(s))`)
    .join('\n');
}

async function main() {
  const inputs = process.argv.slice(2);
  const roots =
    inputs.length > 0 ? inputs : ['playwright-report-provider', 'test-results/provider'];
  const result = await scanProviderArtifacts(roots);
  if (result.findings.length > 0) {
    console.error(
      `Provider artifact DLP scan failed with ${result.findings.length} sanitized finding(s).\n${formatFindings(result.findings)}`
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Provider artifact DLP scan passed (${result.filesScanned} files).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath || fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
