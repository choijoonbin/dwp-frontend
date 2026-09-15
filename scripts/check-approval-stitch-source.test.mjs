import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  APPROVAL_STITCH_SOURCE_ENV,
  ApprovalStitchSourceError,
  readApprovalStitchManifest,
  readPngDimensions,
  runApprovalStitchSourceCheck,
  sha256,
  validateApprovalStitchManifest,
  validateApprovalStitchSourceFileInventory,
} from './check-approval-stitch-source.mjs';

test('tracked manifest seals all 43 reviewed Approval source pairs', async () => {
  const result = await runApprovalStitchSourceCheck({ sourceDir: null });
  assert.deepEqual(result, {
    pairCount: 43,
    approvalFrameCount: 43,
    quarantinedFrameCount: 0,
    rasterFrameCount: 43,
    fetchErrorPlaceholderCount: 0,
    mode: 'manifest-only',
    skippedSourceReason: `${APPROVAL_STITCH_SOURCE_ENV} is not set`,
  });
});

test('manifest integrity rejects a changed source hash even when shape is unchanged', async () => {
  const manifest = structuredClone(await readApprovalStitchManifest());
  manifest.frames[0].screen.sha256 = '0'.repeat(64);
  assert.throws(
    () => validateApprovalStitchManifest(manifest),
    (error) =>
      error instanceof ApprovalStitchSourceError &&
      error.message === 'manifest integritySha256 differs from its canonical payload'
  );
});

test('PNG dimensions come only from a valid IHDR', () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(390, 16);
  png.writeUInt32BE(844, 20);
  assert.deepEqual(readPngDimensions(png), { width: 390, height: 844 });
  assert.equal(readPngDimensions(Buffer.from('not-a-png')), null);
  assert.equal(
    sha256('not-a-png'),
    'f6340893e73ce5f7c019eeebfc6d38224824f8f7565b421b51d54c1c0d25d5c6'
  );
});

test('source inventory rejects files that are not sealed by the reviewed delivery', async () => {
  const manifest = await readApprovalStitchManifest();
  const expectedFiles = manifest.frames
    .flatMap((frame) => [frame.code.path, frame.screen.path])
    .concat(manifest.ignoredArtifacts.map((artifact) => artifact.path));
  assert.doesNotThrow(() => validateApprovalStitchSourceFileInventory(expectedFiles, manifest));
  assert.throws(
    () =>
      validateApprovalStitchSourceFileInventory(
        [...expectedFiles, 'unreviewed/source-instruction.md'],
        manifest
      ),
    (error) =>
      error instanceof ApprovalStitchSourceError &&
      error.message === 'source file inventory differs from the immutable manifest'
  );
});

test(
  'configured local source verifies every byte, raster and ordered source token',
  { skip: !process.env[APPROVAL_STITCH_SOURCE_ENV] },
  async () => {
    const result = await runApprovalStitchSourceCheck();
    assert.equal(result.mode, 'source-and-manifest');
    assert.equal(result.pairCount, 43);
  }
);
