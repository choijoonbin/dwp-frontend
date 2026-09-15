import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  APPROVAL_STITCH_FETCH_ERROR,
  APPROVAL_STITCH_SOURCE_ENV,
  ApprovalStitchSourceError,
  readApprovalStitchManifest,
  readPngDimensions,
  runApprovalStitchSourceCheck,
  sha256,
  validateApprovalStitchManifest,
} from './check-approval-stitch-source.mjs';

test('tracked manifest seals all 41 pairs and explicitly records source gaps', async () => {
  const result = await runApprovalStitchSourceCheck({ sourceDir: null });
  assert.deepEqual(result, {
    pairCount: 41,
    approvalFrameCount: 40,
    quarantinedFrameCount: 1,
    rasterFrameCount: 30,
    fetchErrorPlaceholderCount: 11,
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

test('PNG dimensions come only from a valid IHDR and placeholders never claim raster size', () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(390, 16);
  png.writeUInt32BE(844, 20);
  assert.deepEqual(readPngDimensions(png), { width: 390, height: 844 });
  assert.equal(readPngDimensions(Buffer.from(APPROVAL_STITCH_FETCH_ERROR)), null);
  assert.equal(
    sha256(APPROVAL_STITCH_FETCH_ERROR),
    '6c9a02e2605929162392587c714f045251761b8a72c4bced6d4cbc2e4303ef8b'
  );
});

test(
  'configured local source verifies every byte, raster and ordered source token',
  { skip: !process.env[APPROVAL_STITCH_SOURCE_ENV] },
  async () => {
    const result = await runApprovalStitchSourceCheck();
    assert.equal(result.mode, 'source-and-manifest');
    assert.equal(result.pairCount, 41);
  }
);
