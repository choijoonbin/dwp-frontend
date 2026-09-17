import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readPngDimensions, sha256 } from './check-approval-stitch-source.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const APPROVAL_STITCH_EXTENSION_MANIFEST_PATH = path.resolve(
  SCRIPT_DIR,
  '../e2e/support/approval-stitch-extension-manifest.json'
);
export const APPROVAL_STITCH_EXTENSION_SOURCE_ENV = 'APPROVAL_STITCH_EXTENSION_SOURCE_DIR';

const APR_IDS = Array.from({ length: 8 }, (_, index) => `APR-${index + 17}`);
const FRAME_IDS = APR_IDS.flatMap((apr) => ['A', 'B', 'C'].map((suffix) => `${apr}${suffix}`));
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RENDER_CLASSES = new Set(['normal', 'mobile']);
const VIEWPORT_INTENTS = new Set(['desktop-1440', 'mobile-390']);

export class ApprovalStitchExtensionSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApprovalStitchExtensionSourceError';
  }
}

function fail(message) {
  throw new ApprovalStitchExtensionSourceError(message);
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

function sealedFiles(manifest) {
  return manifest.frames
    .flatMap((frame) => [frame.screen, frame.code])
    .concat(manifest.ignoredArtifacts)
    .map(({ path: filePath, bytes, sha256: digest }) => ({
      path: filePath,
      sha256: digest,
      bytes,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function extensionSourceTreeSha256(manifest) {
  return createHash('sha256')
    .update(JSON.stringify(sealedFiles(manifest)))
    .digest('hex');
}

export async function readApprovalStitchExtensionManifest(
  manifestPath = APPROVAL_STITCH_EXTENSION_MANIFEST_PATH
) {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

export function validateApprovalStitchExtensionManifest(manifest) {
  assert(manifest && typeof manifest === 'object', 'manifest must be an object');
  assert(manifest.schemaVersion === 2, 'manifest schemaVersion must be 2');
  assert(manifest.sourceProjectId === '13391261371843159731', 'unexpected Stitch project');
  assert(manifest.sourceDelivery === '전자결재.zip', 'unexpected Stitch source delivery');
  assert(
    manifest.sourceArchive?.fileName === '전자결재.zip',
    'unexpected Stitch source archive name'
  );
  assert(SHA256_PATTERN.test(manifest.sourceArchive?.sha256), 'source archive SHA-256 is invalid');
  assert(
    manifest.sourceArchive.sha256 ===
      '86384fedc131d4ee537f760809bd99a292d8a45755accecc152fbbcd152c7bc0',
    'source archive SHA-256 differs from the reviewed delivery'
  );
  assert(
    manifest.sourceRootEnv === APPROVAL_STITCH_EXTENSION_SOURCE_ENV,
    'unexpected source env contract'
  );
  assert(Array.isArray(manifest.frames), 'manifest frames must be an array');
  assert(manifest.frames.length === 24, `expected 24 source pairs, got ${manifest.frames.length}`);
  assert(manifest.pairCount === manifest.frames.length, 'pairCount differs from frames length');
  assert(Array.isArray(manifest.ignoredArtifacts), 'ignoredArtifacts must be an array');
  assert(manifest.ignoredArtifacts.length === 2, 'expected two excluded non-Approval artifacts');
  assert(SHA256_PATTERN.test(manifest.sourceTreeSha256), 'sourceTreeSha256 is invalid');
  assert(
    extensionSourceTreeSha256(manifest) === manifest.sourceTreeSha256,
    'sourceTreeSha256 differs from its sealed file inventory'
  );
  assert(SHA256_PATTERN.test(manifest.integritySha256), 'manifest integritySha256 is invalid');
  assert(
    sha256(JSON.stringify(manifestCore(manifest))) === manifest.integritySha256,
    'manifest integritySha256 differs from its canonical payload'
  );

  const ids = new Set();
  const pairPaths = new Set();
  for (const frame of manifest.frames) {
    assert(FRAME_IDS.includes(frame.id), `unexpected frame id: ${frame.id}`);
    assert(!ids.has(frame.id), `duplicate frame id: ${frame.id}`);
    ids.add(frame.id);
    assert(APR_IDS.includes(frame.apr), `${frame.id} has invalid APR id: ${frame.apr}`);
    assert(frame.id.startsWith(frame.apr), `${frame.id} is not bound to ${frame.apr}`);
    assert(RENDER_CLASSES.has(frame.renderClass), `${frame.id} has invalid render class`);
    assert(VIEWPORT_INTENTS.has(frame.viewportIntent), `${frame.id} has invalid viewport intent`);
    assert(
      (frame.renderClass === 'mobile') === (frame.viewportIntent === 'mobile-390'),
      `${frame.id} render class and viewport intent differ`
    );
    assertRelativePath(frame.pairPath, `${frame.id}.pairPath`);
    assert(!pairPaths.has(frame.pairPath), `duplicate pairPath: ${frame.pairPath}`);
    pairPaths.add(frame.pairPath);

    assertRelativePath(frame.screen?.path, `${frame.id}.screen.path`);
    assertRelativePath(frame.code?.path, `${frame.id}.code.path`);
    assert(
      frame.screen.path === `${frame.pairPath}/screen.png`,
      `${frame.id} screen path mismatch`
    );
    assert(frame.code.path === `${frame.pairPath}/code.html`, `${frame.id} code path mismatch`);
    for (const [kind, file] of [
      ['screen', frame.screen],
      ['code', frame.code],
    ]) {
      assert(SHA256_PATTERN.test(file.sha256), `${frame.id} ${kind} SHA-256 is invalid`);
      assert(
        Number.isSafeInteger(file.bytes) && file.bytes > 0,
        `${frame.id} ${kind} bytes invalid`
      );
    }
    assert(frame.screen.status === 'raster', `${frame.id} must contain a reviewed PNG raster`);
    assert(frame.screen.mediaType === 'image/png', `${frame.id} screen must be image/png`);
    assert(
      Number.isSafeInteger(frame.screen.width) && frame.screen.width > 0,
      `${frame.id} width invalid`
    );
    assert(
      Number.isSafeInteger(frame.screen.height) && frame.screen.height > 0,
      `${frame.id} height invalid`
    );
    assert(frame.code.mediaType === 'text/html', `${frame.id} code must be text/html`);
    assert(
      Array.isArray(frame.code.sourceTokens) && frame.code.sourceTokens.length >= 2,
      `${frame.id} must pin at least two source tokens`
    );
    assert(
      frame.code.sourceTokens.every((token) => typeof token === 'string' && token.length >= 3),
      `${frame.id} contains an invalid source token`
    );
  }

  assert(
    JSON.stringify([...ids]) === JSON.stringify(FRAME_IDS),
    'APR-17 through APR-24 frames differ'
  );
  assert(manifest.approvalFrameCount === 24, 'approvalFrameCount mismatch');
  assert(manifest.rasterFrameCount === 24, 'rasterFrameCount mismatch');
  assert(
    manifest.fetchErrorPlaceholderCount === 0,
    'source delivery must not contain placeholders'
  );

  for (const artifact of manifest.ignoredArtifacts) {
    assertRelativePath(artifact.path, 'ignored artifact path');
    assert(SHA256_PATTERN.test(artifact.sha256), `${artifact.path} SHA-256 is invalid`);
    assert(
      Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0,
      `${artifact.path} bytes invalid`
    );
    assert(
      typeof artifact.reason === 'string' && artifact.reason.includes('Non-Approval'),
      `${artifact.path} exclusion reason must remain explicit`
    );
  }

  return { pairCount: 24, approvalFrameCount: 24, rasterFrameCount: 24 };
}

export function validateApprovalStitchExtensionSourceFileInventory(actualFiles, manifest) {
  const expectedFiles = sealedFiles(manifest).map((file) => file.path);
  assert(
    JSON.stringify([...actualFiles].sort()) === JSON.stringify(expectedFiles),
    'source file inventory differs from the immutable extension manifest'
  );
}

async function sourceInventory(sourceDir) {
  const files = [];
  async function visit(relativeDir) {
    for (const entry of await readdir(path.join(sourceDir, relativeDir), { withFileTypes: true })) {
      const relativePath = path.posix.join(relativeDir, entry.name);
      if (entry.isDirectory()) await visit(relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  }
  await visit('');
  return files;
}

async function verifyFile(sourceDir, file, label) {
  const buffer = await readFile(path.join(sourceDir, file.path));
  assert(buffer.length === file.bytes, `${label} byte count differs`);
  assert(sha256(buffer) === file.sha256, `${label} SHA-256 differs`);
  return buffer;
}

function normalizeVisibleHtmlText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replace(/\s+/gu, ' ')
    .trim();
}

export async function verifyApprovalStitchExtensionSource(sourceDir, manifest) {
  validateApprovalStitchExtensionSourceFileInventory(await sourceInventory(sourceDir), manifest);
  for (const frame of manifest.frames) {
    const screen = await verifyFile(sourceDir, frame.screen, `${frame.id} screen`);
    const dimensions = readPngDimensions(screen);
    assert(dimensions !== null, `${frame.id} screen is not a PNG raster`);
    assert(dimensions.width === frame.screen.width, `${frame.id} raster width differs`);
    assert(dimensions.height === frame.screen.height, `${frame.id} raster height differs`);

    const html = normalizeVisibleHtmlText(
      (await verifyFile(sourceDir, frame.code, `${frame.id} code`)).toString('utf8')
    );
    let cursor = -1;
    for (const token of frame.code.sourceTokens) {
      const index = html.indexOf(token, cursor + 1);
      assert(index >= 0, `${frame.id} source token is missing or reordered: ${token}`);
      cursor = index;
    }
  }
  for (const artifact of manifest.ignoredArtifacts) {
    await verifyFile(sourceDir, artifact, artifact.path);
  }
}

export async function runApprovalStitchExtensionSourceCheck({
  manifestPath = APPROVAL_STITCH_EXTENSION_MANIFEST_PATH,
  sourceDir = process.env[APPROVAL_STITCH_EXTENSION_SOURCE_ENV],
} = {}) {
  const manifest = await readApprovalStitchExtensionManifest(manifestPath);
  const summary = validateApprovalStitchExtensionManifest(manifest);
  if (!sourceDir) {
    return {
      ...summary,
      mode: 'manifest-only',
      skippedSourceReason: `${APPROVAL_STITCH_EXTENSION_SOURCE_ENV} is not set`,
    };
  }
  await verifyApprovalStitchExtensionSource(path.resolve(sourceDir), manifest);
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
    const result = await runApprovalStitchExtensionSourceCheck(
      parseArguments(process.argv.slice(2))
    );
    const sourceMessage =
      result.mode === 'source-and-manifest'
        ? 'source bytes, hashes, raster metadata and HTML tokens verified'
        : `source verification skipped (${result.skippedSourceReason}); tracked manifest verified`;
    console.log(`Approval Stitch APR-17..24 PASS: ${result.pairCount} pairs; ${sourceMessage}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
