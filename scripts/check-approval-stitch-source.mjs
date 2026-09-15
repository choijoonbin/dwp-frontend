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
  assert(manifest.schemaVersion === 2, 'manifest schemaVersion must be 2');
  assert(manifest.sourceProjectId === '13391261371843159731', 'unexpected Stitch project');
  assert(manifest.sourceRootEnv === APPROVAL_STITCH_SOURCE_ENV, 'unexpected source env contract');
  assert(
    manifest.sourceArchive?.fileName === 'stitch_enterprise_grid_calendar_application.zip',
    'unexpected Stitch source archive name'
  );
  assert(SHA256_PATTERN.test(manifest.sourceArchive?.sha256), 'source archive SHA-256 is invalid');
  assert(
    manifest.sourceArchive.sha256 ===
      '2ee7954e2f62bccfe2dd8063ac9536a001fae84bedab92388cadfe54678f42dd',
    'source archive SHA-256 differs from the reviewed delivery'
  );
  assert(
    JSON.stringify(manifest.retiredFrameIds) ===
      JSON.stringify(['STITCH-026', 'STITCH-040', 'STITCH-041']),
    'retired duplicate or quarantined frame ids changed'
  );
  assert(
    JSON.stringify(manifest.ignoredArtifacts) ===
      JSON.stringify([
        {
          path: 'precision_calendar_system/DESIGN.md',
          reason: 'Calendar design-system metadata is not an Approval screen source.',
          bytes: 12_283,
          sha256: 'dc14f164e1578db21a976c88f25d293d6e54e7b845b360d203603dcfbed675cc',
        },
      ]),
    'ignored non-Approval artifact contract changed'
  );
  assert(Array.isArray(manifest.frames), 'manifest frames must be an array');
  assert(manifest.frames.length === 43, `expected 43 source pairs, got ${manifest.frames.length}`);
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

    approvalFrames += 1;
    assert(APPROVAL_IDS.includes(frame.apr), `${frame.id} has invalid APR id: ${frame.apr}`);
    assert(
      APPROVAL_RENDER_CLASSES.has(frame.renderClass),
      `${frame.id} has invalid render class: ${frame.renderClass}`
    );
    assert(frame.duplicateOf === undefined, `${frame.id} must be a distinct reviewed export`);
    approvalIds.add(frame.apr);
    renderClasses.add(frame.renderClass);

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

    rasterFrames += 1;
    assert(frame.screen.status === 'raster', `${frame.id} must contain a reviewed PNG raster`);
    assert(frame.screen.mediaType === 'image/png', `${frame.id} raster must be image/png`);
    assert(
      Number.isSafeInteger(frame.screen.width) && frame.screen.width > 0,
      `${frame.id} width invalid`
    );
    assert(
      Number.isSafeInteger(frame.screen.height) && frame.screen.height > 0,
      `${frame.id} height invalid`
    );
  }

  assert(approvalFrames === 43, `expected 43 Approval frames, got ${approvalFrames}`);
  assert(quarantinedFrames === 0, `expected no quarantined frames, got ${quarantinedFrames}`);
  assert(rasterFrames === 43, `expected 43 raster frames, got ${rasterFrames}`);
  assert(placeholderFrames === 0, `expected no fetch placeholders, got ${placeholderFrames}`);
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

  return {
    pairCount: manifest.frames.length,
    approvalFrameCount: approvalFrames,
    quarantinedFrameCount: quarantinedFrames,
    rasterFrameCount: rasterFrames,
    fetchErrorPlaceholderCount: placeholderFrames,
  };
}

export function validateApprovalStitchSourceFileInventory(actualFiles, manifest) {
  const expectedFiles = manifest.frames
    .flatMap((frame) => [frame.code.path, frame.screen.path])
    .concat(manifest.ignoredArtifacts.map((artifact) => artifact.path))
    .sort();
  assert(
    JSON.stringify([...actualFiles].sort()) === JSON.stringify(expectedFiles),
    'source file inventory differs from the immutable manifest'
  );
}

async function sourceInventory(sourceDir) {
  const pairs = new Map();
  const files = [];
  async function visit(relativeDir) {
    const absoluteDir = path.join(sourceDir, relativeDir);
    for (const entry of await readdir(absoluteDir, { withFileTypes: true })) {
      const relativePath = path.posix.join(
        relativeDir.split(path.sep).join(path.posix.sep),
        entry.name
      );
      if (entry.isDirectory()) await visit(relativePath);
      else if (entry.isFile()) {
        files.push(relativePath);
        if (entry.name !== 'screen.png' && entry.name !== 'code.html') continue;
        const pairPath = path.posix.dirname(relativePath);
        const pair = pairs.get(pairPath) ?? new Set();
        pair.add(entry.name);
        pairs.set(pairPath, pair);
      }
    }
  }
  await visit('');
  return { files, pairs };
}

export async function verifyApprovalStitchFrame(sourceDir, frame) {
  const screenBuffer = await readFile(path.join(sourceDir, frame.screen.path));
  const codeBuffer = await readFile(path.join(sourceDir, frame.code.path));
  assert(screenBuffer.length === frame.screen.bytes, `${frame.id} screen byte count differs`);
  assert(codeBuffer.length === frame.code.bytes, `${frame.id} code byte count differs`);
  assert(sha256(screenBuffer) === frame.screen.sha256, `${frame.id} screen SHA-256 differs`);
  assert(sha256(codeBuffer) === frame.code.sha256, `${frame.id} code SHA-256 differs`);

  const dimensions = readPngDimensions(screenBuffer);
  assert(dimensions !== null, `${frame.id} no longer contains a PNG raster`);
  assert(dimensions.width === frame.screen.width, `${frame.id} raster width differs`);
  assert(dimensions.height === frame.screen.height, `${frame.id} raster height differs`);

  const html = codeBuffer.toString('utf8');
  let cursor = -1;
  for (const token of frame.code.sourceTokens) {
    const index = html.indexOf(token, cursor + 1);
    assert(index >= 0, `${frame.id} source token is missing or reordered: ${token}`);
    cursor = index;
  }
}

export async function verifyApprovalStitchSource(sourceDir, manifest) {
  const { files, pairs } = await sourceInventory(sourceDir);
  validateApprovalStitchSourceFileInventory(files, manifest);
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
  for (const artifact of manifest.ignoredArtifacts) {
    const buffer = await readFile(path.join(sourceDir, artifact.path));
    assert(buffer.length === artifact.bytes, `${artifact.path} byte count differs`);
    assert(sha256(buffer) === artifact.sha256, `${artifact.path} SHA-256 differs`);
  }
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
