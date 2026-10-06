import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CheckpointHold } from './hris-w1-checkpoint-core.mjs';
import { validateHomeLaunchpadIdentityEvidence } from './hris-w1-checkpoint-browser-evidence.mjs';

function fixture(t) {
  const artifactRoot = mkdtempSync(path.join(tmpdir(), 'hris-home-identity-'));
  t.after(() => rmSync(artifactRoot, { recursive: true, force: true }));
  const screenshot = path.join(artifactRoot, 'tenant-a-global-home-hris-launchpad.png');
  writeFileSync(screenshot, Buffer.from('synthetic screenshot bytes'));
  return {
    artifactRoot,
    evidence: {
      requestedPath: '/',
      finalPath: '/',
      appId: 'ref-app-people',
      visibleLabel: 'HRIS',
      shortLabel: 'HRIS',
      fullLabel: 'HRIS',
      screenshot,
    },
  };
}

test('validates exact Global Home HRIS identity and screenshot lineage', (t) => {
  const { artifactRoot, evidence } = fixture(t);
  const validated = validateHomeLaunchpadIdentityEvidence(evidence, { artifactRoot });

  assert.deepEqual(validated, {
    requestedPath: '/',
    finalPath: '/',
    appId: 'ref-app-people',
    visibleLabel: 'HRIS',
    shortLabel: 'HRIS',
    fullLabel: 'HRIS',
    screenshot: {
      path: 'tenant-a-global-home-hris-launchpad.png',
      sha256: 'df0531165ed33e6704a207d169b9f88a78b13db91f74751caf764973f9811f7d',
    },
  });
});

test('rejects label drift and schema expansion before trusting Home identity evidence', (t) => {
  const { artifactRoot, evidence } = fixture(t);

  assert.throws(
    () =>
      validateHomeLaunchpadIdentityEvidence(
        { ...evidence, visibleLabel: '인사' },
        { artifactRoot }
      ),
    (error) => error instanceof CheckpointHold && /not exact Global Home HRIS/u.test(error.message)
  );
  assert.throws(
    () =>
      validateHomeLaunchpadIdentityEvidence({ ...evidence, unsupported: true }, { artifactRoot }),
    (error) => error instanceof CheckpointHold && /unexpected field set/u.test(error.message)
  );
});
