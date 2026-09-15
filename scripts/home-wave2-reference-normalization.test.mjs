import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import {
  buildReferenceNormalizationReport,
  calculateImageNormalization,
  calculatePairNormalization,
  readPngDimensions,
} from './home-wave2-reference-normalization.mjs';

function createPngHeader(width, height) {
  const header = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 4, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

const hash = (value) => createHash('sha256').update(value).digest('hex');

test('width normalization preserves aspect ratio and exposes first-viewport crop geometry', () => {
  const result = calculateImageNormalization(
    { width: 1164, height: 1600 },
    { width: 1440, height: 900 }
  );

  assert.deepEqual(result.widthAnchored, {
    scale: 1.237113,
    widthCss: 1440,
    heightCss: 1979.381443,
  });
  assert.deepEqual(result.firstViewportTopCrop.normalizedCss, {
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
  });
  assert.equal(result.firstViewportTopCrop.sourcePixels.height, 727.5);
  assert.equal(result.firstViewportTopCrop.verticalCoverage, 1);
  assert.equal(result.containOverview.letterboxCss.horizontal, 785.25);
  assert.equal(result.containOverview.letterboxCss.vertical, 0);
});

test('pair normalization reports document-length residual instead of hiding it with contain', () => {
  const result = calculatePairNormalization(
    { width: 319, height: 1600 },
    { width: 390, height: 3370 },
    { width: 390, height: 844 }
  );

  assert.deepEqual(result.fullDocumentAlignment, {
    anchor: 'TOP_LEFT_AFTER_INDEPENDENT_WIDTH_NORMALIZATION',
    overlapHeightCss: 1956.112853,
    sourceOnlyTailCss: 0,
    implementationOnlyTailCss: 1413.887147,
    implementationToSourceHeightRatio: 1.722804,
  });
});

test('report pairs every registry record and verifies both image hashes and dimensions', () => {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'home-wave2-normalization-'));
  const sourceRoot = resolve(fixtureRoot, 'accepted');
  const implementationRoot = resolve(fixtureRoot, 'implementation');
  const sourcePath = resolve(sourceRoot, 'reference/example/screen.png');
  const implementationPath = resolve(implementationRoot, 'evidence/example.png');
  const registryPath = resolve(fixtureRoot, 'registry.json');
  const evidencePath = resolve(fixtureRoot, 'evidence.json');
  mkdirSync(dirname(sourcePath), { recursive: true });
  mkdirSync(dirname(implementationPath), { recursive: true });

  const sourceImage = createPngHeader(245, 1600);
  const implementationImage = createPngHeader(390, 2450);
  writeFileSync(sourcePath, sourceImage);
  writeFileSync(implementationPath, implementationImage);

  const registry = {
    screens: [
      {
        id: 'FLOW-BASE-MOBILE-FINAL',
        family: 'FLOW',
        role: 'BASE',
        device: 'MOBILE',
        png: {
          path: 'reference/example/screen.png',
          width: 245,
          height: 1600,
          sha256: hash(sourceImage),
        },
      },
    ],
  };
  const evidence = {
    sourceRegistrySha256: hash(`${JSON.stringify(registry)}\n`),
    canonicalScreens: [
      {
        id: 'FLOW-BASE-MOBILE-FINAL',
        sourcePngSha256: hash(sourceImage),
        viewport: { width: 390, height: 844 },
        visualEvidence: 'evidence/example.png',
        visualEvidenceSha256: hash(implementationImage),
      },
    ],
  };
  writeFileSync(registryPath, `${JSON.stringify(registry)}\n`);
  writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`);

  const report = buildReferenceNormalizationReport({
    registry,
    evidence,
    registryPath,
    evidencePath,
    sourceRoot,
    implementationRoot,
    reportRoot: fixtureRoot,
  });

  assert.deepEqual(report.counts, {
    registry: 1,
    evidence: 1,
    paired: 1,
    unsealedImplementation: 0,
  });
  assert.equal(report.inputs.acceptedSourcesReadOnly, true);
  assert.deepEqual(report.pairs[0].acceptedSource.dimensionsPx, { width: 245, height: 1600 });
  assert.deepEqual(report.pairs[0].implementationEvidence.dimensionsPx, {
    width: 390,
    height: 2450,
  });
  assert.equal(report.pairs[0].reviewStatus, 'PENDING_PAIRWISE_PERCEPTUAL_REVIEW');
  assert.equal(report.pairs[0].normalization.source.widthAnchored.heightCss, 2546.938776);
  assert.equal(report.pairs[0].normalization.implementation.widthAnchored.heightCss, 2450);
  assert.equal(readPngDimensions(sourcePath).width, 245);
  assert.equal(readFileSync(sourcePath).equals(sourceImage), true);
});

test('report rejects registry and evidence ID drift before reading any screenshots', () => {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'home-wave2-normalization-'));
  const registryPath = resolve(fixtureRoot, 'registry.json');
  const evidencePath = resolve(fixtureRoot, 'evidence.json');
  const registry = { screens: [{ id: 'C01', png: {} }] };
  const evidence = { canonicalScreens: [{ id: 'C02' }] };
  writeFileSync(registryPath, `${JSON.stringify(registry)}\n`);
  writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`);

  assert.throws(
    () =>
      buildReferenceNormalizationReport({
        registry,
        evidence,
        registryPath,
        evidencePath,
        sourceRoot: fixtureRoot,
        implementationRoot: fixtureRoot,
        reportRoot: fixtureRoot,
      }),
    /Registry\/evidence ID mismatch/u
  );
});

test('report rejects a registry that is not the one bound into the evidence record', () => {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'home-wave2-normalization-'));
  const registryPath = resolve(fixtureRoot, 'registry.json');
  const evidencePath = resolve(fixtureRoot, 'evidence.json');
  const registry = { screens: [] };
  const evidence = { sourceRegistrySha256: '0'.repeat(64), canonicalScreens: [] };
  writeFileSync(registryPath, `${JSON.stringify(registry)}\n`);
  writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`);

  assert.throws(
    () =>
      buildReferenceNormalizationReport({
        registry,
        evidence,
        registryPath,
        evidencePath,
        sourceRoot: fixtureRoot,
        implementationRoot: fixtureRoot,
        reportRoot: fixtureRoot,
      }),
    /sourceRegistrySha256 differs/u
  );
});

test('unsealed review mode records a changed implementation without treating it as manifest-bound', () => {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'home-wave2-normalization-'));
  const sourceRoot = resolve(fixtureRoot, 'accepted');
  const implementationRoot = resolve(fixtureRoot, 'implementation');
  const sourcePath = resolve(sourceRoot, 'reference/example/screen.png');
  const implementationPath = resolve(implementationRoot, 'evidence/example.png');
  const registryPath = resolve(fixtureRoot, 'registry.json');
  const evidencePath = resolve(fixtureRoot, 'evidence.json');
  mkdirSync(dirname(sourcePath), { recursive: true });
  mkdirSync(dirname(implementationPath), { recursive: true });
  const sourceImage = createPngHeader(100, 200);
  const implementationImage = createPngHeader(100, 300);
  writeFileSync(sourcePath, sourceImage);
  writeFileSync(implementationPath, implementationImage);
  const registry = {
    screens: [
      {
        id: 'C01',
        family: 'CLASSIC',
        role: 'BASE',
        device: 'DESKTOP',
        png: {
          path: 'reference/example/screen.png',
          width: 100,
          height: 200,
          sha256: hash(sourceImage),
        },
      },
    ],
  };
  writeFileSync(registryPath, `${JSON.stringify(registry)}\n`);
  const evidence = {
    sourceRegistrySha256: hash(`${JSON.stringify(registry)}\n`),
    canonicalScreens: [
      {
        id: 'C01',
        sourcePngSha256: hash(sourceImage),
        viewport: { width: 100, height: 100 },
        visualEvidence: 'evidence/example.png',
        visualEvidenceSha256: '0'.repeat(64),
      },
    ],
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`);

  assert.throws(
    () =>
      buildReferenceNormalizationReport({
        registry,
        evidence,
        registryPath,
        evidencePath,
        sourceRoot,
        implementationRoot,
        reportRoot: fixtureRoot,
      }),
    /implementation SHA-256 differs/u
  );

  const report = buildReferenceNormalizationReport({
    registry,
    evidence,
    registryPath,
    evidencePath,
    sourceRoot,
    implementationRoot,
    reportRoot: fixtureRoot,
    allowUnsealedImplementation: true,
  });
  assert.equal(report.inputs.implementationEvidenceBinding, 'UNSEALED_SCREENSHOTS_PRESENT');
  assert.equal(report.counts.unsealedImplementation, 1);
  assert.equal(
    report.pairs[0].implementationEvidence.manifestBinding,
    'MISMATCH_UNSEALED_SCREENSHOT'
  );
  assert.equal(report.pairs[0].implementationEvidence.sha256, hash(implementationImage));
  assert.equal(report.pairs[0].implementationEvidence.manifestSha256, '0'.repeat(64));
});
