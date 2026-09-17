import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  HOME_WAVE2_CANONICAL_IDS,
  validateHomeWave2Evidence,
} from './home-wave2-evidence-validation.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(
  readFileSync(resolve(root, 'architecture/home-wave2-evidence.v1.json'), 'utf8')
);
const errorsFor = (manifest) => validateHomeWave2Evidence(manifest, root);
const hasError = (errors, text) => errors.some((error) => error.includes(text));

test('accepts the sealed 33-ID evidence graph', () => {
  assert.deepEqual(errorsFor(source), []);
  assert.deepEqual(
    source.canonicalScreens.map((screen) => screen.id),
    HOME_WAVE2_CANONICAL_IDS
  );
  assert.deepEqual(source.counts, {
    canonical: 33,
    productionCompositions: 9,
    stateAndSpecificationEvidence: 24,
    primaryVisualEvidence: 33,
    interactionVisualEvidence: 7,
  });
});

test('rejects missing or reordered IDs and falsified counts', () => {
  const missing = structuredClone(source);
  missing.canonicalScreens = missing.canonicalScreens.slice(1);
  assert.ok(hasError(errorsFor(missing), 'accepted 33 IDs in canonical order'));

  const reordered = structuredClone(source);
  [reordered.canonicalScreens[0], reordered.canonicalScreens[1]] = [
    reordered.canonicalScreens[1],
    reordered.canonicalScreens[0],
  ];
  assert.ok(hasError(errorsFor(reordered), 'accepted 33 IDs in canonical order'));

  const falseCounts = structuredClone(source);
  falseCounts.counts.primaryVisualEvidence = 14;
  assert.ok(hasError(errorsFor(falseCounts), '33/9/24/33/7'));
});

test('rejects missing per-screen environment, commit, viewport, locale, theme, and axe metadata', () => {
  const screen = (manifest) =>
    manifest.canonicalScreens.find((record) => record.id === 'C01-D1440-BASE');

  const noCommit = structuredClone(source);
  delete screen(noCommit).implementationCommit;
  assert.ok(hasError(errorsFor(noCommit), 'sealed implementation commit'));

  const noBrowser = structuredClone(source);
  delete screen(noBrowser).browser.version;
  assert.ok(hasError(errorsFor(noBrowser), 'browser name/version/project/platform'));

  const noViewport = structuredClone(source);
  delete screen(noViewport).viewport.width;
  assert.ok(hasError(errorsFor(noViewport), 'exact canonical viewport'));

  const badLocale = structuredClone(source);
  screen(badLocale).locale = 'en-US';
  assert.ok(hasError(errorsFor(badLocale), 'invalid locale'));

  const badTheme = structuredClone(source);
  screen(badTheme).theme = 'DARK';
  assert.ok(hasError(errorsFor(badTheme), 'invalid theme'));

  const axeFailure = structuredClone(source);
  screen(axeFailure).axeResult = {
    status: 'FAIL',
    ruleLevel: 'CRITICAL_AND_SERIOUS',
    violationCount: 1,
  };
  assert.ok(hasError(errorsFor(axeFailure), 'passing axe'));
});

test('rejects missing, stale, or uncommitted primary visual evidence', () => {
  const target = (manifest) =>
    manifest.canonicalScreens.find((screen) => screen.id === 'C10-D1440-EMPTY-r02');

  const missing = structuredClone(source);
  target(missing).visualEvidence = 'e2e/missing-wave2-evidence.png';
  assert.ok(hasError(errorsFor(missing), 'exact canonical primary screenshot path'));
  assert.ok(hasError(errorsFor(missing), 'references missing'));

  const stale = structuredClone(source);
  target(stale).visualEvidenceSha256 = '0'.repeat(64);
  assert.ok(hasError(errorsFor(stale), 'does not match its screenshot'));

  const substituted = structuredClone(source);
  const replacement = substituted.canonicalScreens.find(
    (screen) => screen.id === 'C11-D1440-PARTIAL-r02'
  );
  target(substituted).visualEvidence = replacement.visualEvidence;
  target(substituted).visualEvidenceSha256 = replacement.visualEvidenceSha256;
  assert.ok(hasError(errorsFor(substituted), 'exact canonical primary screenshot path'));
  assert.ok(hasError(errorsFor(substituted), 'reuses another screen'));

  const uncommitted = structuredClone(source);
  target(uncommitted).implementationCommit = '0'.repeat(40);
  assert.ok(hasError(errorsFor(uncommitted), 'sealed implementation commit'));
});

test('rejects missing and tampered viewport interaction evidence', () => {
  const target = (manifest) =>
    manifest.canonicalScreens.find((screen) => screen.id === 'C16-M390-SAVE-CONFLICT-r02');

  const missing = structuredClone(source);
  delete target(missing).interactionEvidence;
  assert.ok(hasError(errorsFor(missing), 'requires viewport interaction evidence'));

  const stale = structuredClone(source);
  target(stale).interactionEvidence.sha256 = '0'.repeat(64);
  assert.ok(hasError(errorsFor(stale), 'interaction evidence SHA-256'));

  const substituted = structuredClone(source);
  const replacement = substituted.canonicalScreens.find(
    (screen) => screen.id === 'C16-D1440-SAVE-CONFLICT-r02'
  );
  target(substituted).interactionEvidence = structuredClone(replacement.interactionEvidence);
  assert.ok(hasError(errorsFor(substituted), 'exact interaction path and purpose'));
  assert.ok(hasError(errorsFor(substituted), 'reuses another screen'));
});

test('rejects manifest and per-screen accepted-source hash drift', () => {
  const registryDrift = structuredClone(source);
  registryDrift.sourceRegistrySha256 = '0'.repeat(64);
  assert.ok(hasError(errorsFor(registryDrift), 'does not match the vendored registry'));

  const sourceDrift = structuredClone(source);
  sourceDrift.canonicalScreens[0].sourcePngSha256 = '0'.repeat(64);
  assert.ok(hasError(errorsFor(sourceDrift), 'does not match the accepted source PNG'));

  const comparisonDrift = structuredClone(source);
  comparisonDrift.canonicalScreens[0].acceptedSourceComparison.status = 'NOT_REVIEWED';
  assert.ok(hasError(errorsFor(comparisonDrift), 'human/perceptual'));
});

test('detects a physically tampered vendored registry', () => {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'dwp-home-wave2-evidence-'));
  try {
    mkdirSync(resolve(temporaryRoot, 'architecture'), { recursive: true });
    writeFileSync(
      resolve(temporaryRoot, 'architecture/home-wave2-design-source-registry.v1.json'),
      '{}\n'
    );
    const errors = validateHomeWave2Evidence(source, temporaryRoot);
    assert.ok(hasError(errors, 'vendored design source registry differs'));
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('rejects state routes, unexercised fixtures, and test-only production leakage', () => {
  const routedState = structuredClone(source);
  routedState.canonicalScreens.find((screen) => screen.id === 'C10-D1440-EMPTY-r02').route =
    '/empty';
  assert.ok(hasError(errorsFor(routedState), 'must not define a separate route'));

  const unexercised = structuredClone(source);
  unexercised.canonicalScreens.find((screen) => screen.id === 'C10-D1440-EMPTY-r02').fixtureId =
    'HOME_STATE_NOT_EXECUTED';
  assert.ok(hasError(errorsFor(unexercised), 'is not exercised by its evidence'));

  const leaked = structuredClone(source);
  leaked.testOnlyStateSpec.source = 'apps/dwp/src/home-wave2-state-spec.tsx';
  assert.ok(hasError(errorsFor(leaked), 'test-only state spec exclusion metadata is invalid'));
});

test('rejects a missing or falsified combined clean-run receipt', () => {
  const badCount = structuredClone(source);
  badCount.cleanRun.testCount = 14;
  assert.ok(hasError(errorsFor(badCount), 'clean-run receipt metadata is invalid'));

  const staleReceipt = structuredClone(source);
  staleReceipt.cleanRun.receiptSha256 = '0'.repeat(64);
  assert.ok(hasError(errorsFor(staleReceipt), 'clean-run receipt SHA-256 does not match'));
});
