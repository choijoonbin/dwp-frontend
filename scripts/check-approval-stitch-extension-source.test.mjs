import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  APPROVAL_STITCH_EXTENSION_SOURCE_ENV,
  ApprovalStitchExtensionSourceError,
  extensionSourceTreeSha256,
  readApprovalStitchExtensionManifest,
  runApprovalStitchExtensionSourceCheck,
  validateApprovalStitchExtensionManifest,
  validateApprovalStitchExtensionSourceFileInventory,
} from './check-approval-stitch-extension-source.mjs';

test('tracked extension manifest seals all 24 APR-17 through APR-24 source pairs', async () => {
  const result = await runApprovalStitchExtensionSourceCheck({ sourceDir: null });
  assert.deepEqual(result, {
    pairCount: 24,
    approvalFrameCount: 24,
    rasterFrameCount: 24,
    mode: 'manifest-only',
    skippedSourceReason: `${APPROVAL_STITCH_EXTENSION_SOURCE_ENV} is not set`,
  });
});

test('extension manifest rejects source drift independently of payload integrity', async () => {
  const manifest = structuredClone(await readApprovalStitchExtensionManifest());
  manifest.frames[0].screen.sha256 = '0'.repeat(64);
  assert.notEqual(extensionSourceTreeSha256(manifest), manifest.sourceTreeSha256);
  assert.throws(
    () => validateApprovalStitchExtensionManifest(manifest),
    (error) =>
      error instanceof ApprovalStitchExtensionSourceError &&
      error.message === 'sourceTreeSha256 differs from its sealed file inventory'
  );
});

test('extension manifest remains bound to the reviewed consolidated archive', async () => {
  const manifest = structuredClone(await readApprovalStitchExtensionManifest());
  manifest.sourceArchive.sha256 = '0'.repeat(64);
  assert.throws(
    () => validateApprovalStitchExtensionManifest(manifest),
    (error) =>
      error instanceof ApprovalStitchExtensionSourceError &&
      error.message === 'source archive SHA-256 differs from the reviewed delivery'
  );
});

test('extension inventory rejects unreviewed files and incomplete pair substitutions', async () => {
  const manifest = await readApprovalStitchExtensionManifest();
  const expectedFiles = manifest.frames
    .flatMap((frame) => [frame.screen.path, frame.code.path])
    .concat(manifest.ignoredArtifacts.map((artifact) => artifact.path));
  assert.doesNotThrow(() =>
    validateApprovalStitchExtensionSourceFileInventory(expectedFiles, manifest)
  );
  assert.throws(
    () =>
      validateApprovalStitchExtensionSourceFileInventory(
        [...expectedFiles.slice(1), 'unreviewed/instruction.md'],
        manifest
      ),
    (error) =>
      error instanceof ApprovalStitchExtensionSourceError &&
      error.message === 'source file inventory differs from the immutable extension manifest'
  );
});

test(
  'configured extension source verifies every byte, raster and ordered source token',
  { skip: !process.env[APPROVAL_STITCH_EXTENSION_SOURCE_ENV] },
  async () => {
    const result = await runApprovalStitchExtensionSourceCheck();
    assert.equal(result.mode, 'source-and-manifest');
    assert.equal(result.pairCount, 24);
  }
);
