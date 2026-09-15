import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const APPROVAL_STITCH_MANIFEST_PATH = path.resolve(
  SCRIPT_DIR,
  '../e2e/support/approval-stitch-source-manifest.json'
);
export const APPROVAL_STITCH_SOURCE_ENV = 'APPROVAL_STITCH_SOURCE_DIR';
export const APPROVAL_STITCH_FETCH_ERROR = '<FIFE Image failed to fetch>';

const APPROVAL_IDS = Array.from(
  { length: 16 },
  (_, index) => `APR-${String(index + 1).padStart(2, '0')}`
);
const APPROVAL_RENDER_CLASSES = new Set(['normal', 'mobile', 'exception', 'board']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class ApprovalStitchSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApprovalStitchSourceError';
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function readPngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function fail(message) {
  throw new ApprovalStitchSourceError(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertRelativePath(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty path`);
  assert(!path.isAbsolute(value), `${label} must remain relative: ${value}`);
  assert(!value.split('/').includes('..'), `${label} must not escape its root: ${value}`);
}

function manifestCore(manifest) {
  const { integritySha256: _integritySha256, ...core } = manifest;
  return core;
}

export async function readApprovalStitchManifest(manifestPath = APPROVAL_STITCH_MANIFEST_PATH) {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

export function validateApprovalStitchManifest(manifest) {
  assert(manifest && typeof manifest === 'object', 'manifest must be an object');
  assert(manifest.schemaVersion === 1, 'manifest schemaVersion must be 1');
  assert(manifest.sourceProjectId === '13391261371843159731', 'unexpected Stitch project');
  assert(manifest.sourceRootEnv === APPROVAL_STITCH_SOURCE_ENV, 'unexpected source env contract');
  assert(Array.isArray(manifest.frames), 'manifest frames must be an array');
  assert(manifest.frames.length === 41, `expected 41 source pairs, got ${manifest.frames.length}`);
  assert(manifest.pairCount === manifest.frames.length, 'pairCount differs from frames length');
  assert(SHA256_PATTERN.test(manifest.integritySha256), 'manifest integritySha256 is invalid');
  assert(
    sha256(JSON.stringify(manifestCore(manifest))) === manifest.integritySha256,
    'manifest integritySha256 differs from its canonical payload'
  );

  const ids = new Set();
  const pairPaths = new Set();
  const approvalIds = new Set();
  const renderClasses = new Set();
  let approvalFrames = 0;
  let quarantinedFrames = 0;
  let rasterFrames = 0;
  let placeholderFrames = 0;

  for (const frame of manifest.frames) {
    assert(typeof frame.id === 'string' && frame.id.length > 0, 'frame id is required');
    assert(!ids.has(frame.id), `duplicate frame id: ${frame.id}`);
    ids.add(frame.id);
    assertRelativePath(frame.pairPath, `${frame.id}.pairPath`);
    assert(!pairPaths.has(frame.pairPath), `duplicate pairPath: ${frame.pairPath}`);
    pairPaths.add(frame.pairPath);

    if (frame.apr === null) {
      quarantinedFrames += 1;
      assert(frame.renderClass === 'quarantine', `${frame.id} null APR must be quarantined`);
      assert(
        frame.pairPath === 'quarantine-zip4-workplace',
        `${frame.id} is an unrecognized non-Approval source`
      );
    } else {
      approvalFrames += 1;
      assert(APPROVAL_IDS.includes(frame.apr), `${frame.id} has invalid APR id: ${frame.apr}`);
      assert(
        APPROVAL_RENDER_CLASSES.has(frame.renderClass),
        `${frame.id} has invalid render class: ${frame.renderClass}`
      );
      approvalIds.add(frame.apr);
      renderClasses.add(frame.renderClass);
    }

    assertRelativePath(frame.screen?.path, `${frame.id}.screen.path`);
    assertRelativePath(frame.code?.path, `${frame.id}.code.path`);
    assert(
      frame.screen.path === `${frame.pairPath}/screen.png`,
      `${frame.id} screen path mismatch`
    );
    assert(frame.code.path === `${frame.pairPath}/code.html`, `${frame.id} code path mismatch`);
    assert(SHA256_PATTERN.test(frame.screen.sha256), `${frame.id} screen SHA-256 is invalid`);
    assert(SHA256_PATTERN.test(frame.code.sha256), `${frame.id} code SHA-256 is invalid`);
    assert(
      Number.isSafeInteger(frame.screen.bytes) && frame.screen.bytes > 0,
      `${frame.id} screen bytes invalid`
    );
    assert(
      Number.isSafeInteger(frame.code.bytes) && frame.code.bytes > 0,
      `${frame.id} code bytes invalid`
    );
    assert(frame.code.mediaType === 'text/html', `${frame.id} code media type must be text/html`);
    assert(
      Array.isArray(frame.code.sourceTokens) && frame.code.sourceTokens.length >= 2,
      `${frame.id} must pin at least two source tokens`
    );
    assert(
      frame.code.sourceTokens.every((token) => typeof token === 'string' && token.length >= 3),
      `${frame.id} contains an invalid source token`
    );

    if (frame.screen.status === 'raster') {
      rasterFrames += 1;
      assert(frame.screen.mediaType === 'image/png', `${frame.id} raster must be image/png`);
      assert(
        Number.isSafeInteger(frame.screen.width) && frame.screen.width > 0,
        `${frame.id} width invalid`
      );
      assert(
        Number.isSafeInteger(frame.screen.height) && frame.screen.height > 0,
        `${frame.id} height invalid`
      );
    } else {
      placeholderFrames += 1;
      assert(
        frame.screen.status === 'fetch-error-placeholder',
        `${frame.id} has an unknown screen status`
      );
      assert(frame.screen.mediaType === 'text/plain', `${frame.id} placeholder must be text/plain`);
      assert(
        frame.screen.bytes === Buffer.byteLength(APPROVAL_STITCH_FETCH_ERROR),
        `${frame.id} placeholder byte count changed`
      );
      assert(
        frame.screen.width === null && frame.screen.height === null,
        `${frame.id} placeholder cannot claim raster dimensions`
      );
      assert(
        frame.screen.sha256 === sha256(APPROVAL_STITCH_FETCH_ERROR),
        `${frame.id} placeholder SHA-256 changed`
      );
    }
  }

  assert(approvalFrames === 40, `expected 40 Approval frames, got ${approvalFrames}`);
  assert(quarantinedFrames === 1, `expected one quarantined frame, got ${quarantinedFrames}`);
  assert(rasterFrames === 30, `expected 30 raster frames, got ${rasterFrames}`);
  assert(placeholderFrames === 11, `expected 11 fetch placeholders, got ${placeholderFrames}`);
  assert(manifest.approvalFrameCount === approvalFrames, 'approvalFrameCount mismatch');
  assert(manifest.quarantinedFrameCount === quarantinedFrames, 'quarantinedFrameCount mismatch');
  assert(manifest.rasterFrameCount === rasterFrames, 'rasterFrameCount mismatch');
  assert(manifest.fetchErrorPlaceholderCount === placeholderFrames, 'placeholder count mismatch');
  assert(
    JSON.stringify([...approvalIds].sort()) === JSON.stringify(APPROVAL_IDS),
    'APR-01 through APR-16 are not all represented'
  );
  assert(
    JSON.stringify([...renderClasses].sort()) ===
      JSON.stringify([...APPROVAL_RENDER_CLASSES].sort()),
    'normal/mobile/exception/board source classes are not all represented'
  );

  for (const frame of manifest.frames) {
    if (!frame.duplicateOf) continue;
    const original = manifest.frames.find((candidate) => candidate.pairPath === frame.duplicateOf);
    assert(original, `${frame.id} duplicateOf target does not exist: ${frame.duplicateOf}`);
    assert(original.apr === frame.apr, `${frame.id} duplicate crosses APR ownership`);
    assert(original.code.sha256 === frame.code.sha256, `${frame.id} duplicate code hash differs`);
  }

  return {
    pairCount: manifest.frames.length,
    approvalFrameCount: approvalFrames,
    quarantinedFrameCount: quarantinedFrames,
    rasterFrameCount: rasterFrames,
    fetchErrorPlaceholderCount: placeholderFrames,
  };
}

async function sourcePairPaths(sourceDir) {
  const pairs = new Map();
  async function visit(relativeDir) {
    const absoluteDir = path.join(sourceDir, relativeDir);
    for (const entry of await readdir(absoluteDir, { withFileTypes: true })) {
      const relativePath = path.posix.join(
        relativeDir.split(path.sep).join(path.posix.sep),
        entry.name
      );
      if (entry.isDirectory()) await visit(relativePath);
      else if (entry.isFile() && (entry.name === 'screen.png' || entry.name === 'code.html')) {
        const pairPath = path.posix.dirname(relativePath);
        const pair = pairs.get(pairPath) ?? new Set();
        pair.add(entry.name);
        pairs.set(pairPath, pair);
      }
    }
  }
  await visit('');
  return pairs;
}

export async function verifyApprovalStitchFrame(sourceDir, frame) {
  const screenBuffer = await readFile(path.join(sourceDir, frame.screen.path));
  const codeBuffer = await readFile(path.join(sourceDir, frame.code.path));
  assert(screenBuffer.length === frame.screen.bytes, `${frame.id} screen byte count differs`);
  assert(codeBuffer.length === frame.code.bytes, `${frame.id} code byte count differs`);
  assert(sha256(screenBuffer) === frame.screen.sha256, `${frame.id} screen SHA-256 differs`);
  assert(sha256(codeBuffer) === frame.code.sha256, `${frame.id} code SHA-256 differs`);

  const dimensions = readPngDimensions(screenBuffer);
  if (frame.screen.status === 'raster') {
    assert(dimensions !== null, `${frame.id} no longer contains a PNG raster`);
    assert(dimensions.width === frame.screen.width, `${frame.id} raster width differs`);
    assert(dimensions.height === frame.screen.height, `${frame.id} raster height differs`);
  } else {
    assert(
      dimensions === null,
      `${frame.id} placeholder unexpectedly became a raster; recapture and review it`
    );
    assert(
      screenBuffer.toString('utf8') === APPROVAL_STITCH_FETCH_ERROR,
      `${frame.id} placeholder payload differs`
    );
  }

  const html = codeBuffer.toString('utf8');
  let cursor = -1;
  for (const token of frame.code.sourceTokens) {
    const index = html.indexOf(token, cursor + 1);
    assert(index >= 0, `${frame.id} source token is missing or reordered: ${token}`);
    cursor = index;
  }
}

export async function verifyApprovalStitchSource(sourceDir, manifest) {
  const pairs = await sourcePairPaths(sourceDir);
  const expectedPaths = manifest.frames.map((frame) => frame.pairPath).sort();
  const actualPaths = [...pairs.keys()].sort();
  assert(
    JSON.stringify(actualPaths) === JSON.stringify(expectedPaths),
    'source pair inventory differs from the immutable manifest'
  );
  for (const [pairPath, files] of pairs) {
    assert(
      files.has('screen.png') && files.has('code.html'),
      `${pairPath} is not a complete source pair`
    );
  }
  for (const frame of manifest.frames) await verifyApprovalStitchFrame(sourceDir, frame);
}

export async function runApprovalStitchSourceCheck({
  manifestPath = APPROVAL_STITCH_MANIFEST_PATH,
  sourceDir = process.env[APPROVAL_STITCH_SOURCE_ENV],
} = {}) {
  const manifest = await readApprovalStitchManifest(manifestPath);
  const summary = validateApprovalStitchManifest(manifest);
  if (!sourceDir) {
    return {
      ...summary,
      mode: 'manifest-only',
      skippedSourceReason: `${APPROVAL_STITCH_SOURCE_ENV} is not set`,
    };
  }
  await verifyApprovalStitchSource(path.resolve(sourceDir), manifest);
  return { ...summary, mode: 'source-and-manifest', skippedSourceReason: null };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--manifest') options.manifestPath = path.resolve(argv[++index]);
    else if (argv[index] === '--source') options.sourceDir = path.resolve(argv[++index]);
    else fail(`unknown argument: ${argv[index]}`);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await runApprovalStitchSourceCheck(parseArguments(process.argv.slice(2)));
    const sourceMessage =
      result.mode === 'source-and-manifest'
        ? 'source bytes, hashes, raster metadata and HTML tokens verified'
        : `source verification skipped (${result.skippedSourceReason}); tracked manifest verified`;
    console.log(
      `Approval Stitch source PASS: ${result.pairCount} pairs, ${result.rasterFrameCount} rasters, ` +
        `${result.fetchErrorPlaceholderCount} recorded fetch gaps; ${sourceMessage}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
