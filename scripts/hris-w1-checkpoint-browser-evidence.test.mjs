import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CheckpointHold, sha256Canonical } from './hris-w1-checkpoint-core.mjs';
import { validateHomeLaunchpadIdentityEvidence } from './hris-w1-checkpoint-browser-evidence.mjs';
import {
  globalHomeIdentityObservation,
  pathBrowserGatewayOwnerDbObservations,
} from './hris-w1-checkpoint-evidence.mjs';

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

function finalEvidenceInput(homeLaunchpadIdentity) {
  const configurationId = '30000000-0000-4000-8000-000000000001';
  const digest = 'a'.repeat(64);
  return {
    environment: { tenants: [{ tenantId: 1001 }] },
    browserSummary: {
      tenants: [{ label: 'tenant-a', tenantId: 1001, homeLaunchpadIdentity }],
      payrollResponse: {
        responseBodySha256: digest,
        payrollConfigurationIds: [configurationId],
      },
    },
    runtimeFixture: { configurationId, version: 2 },
    payrollProjection: { legalEntityId: 'legal-entity' },
    databaseObservation: { observationSha256: digest },
    ownerChain: {
      initial: { configurationId, legalEntityId: 'legal-entity' },
      update: { commandId: 'update-command', resultSha256: digest },
      simulate: { commandId: 'simulate-command', resultSha256: digest },
    },
  };
}

test('preserves validated Global Home HRIS screenshot lineage as a digest-bound observation', (t) => {
  const { artifactRoot, evidence } = fixture(t);
  const validated = validateHomeLaunchpadIdentityEvidence(evidence, { artifactRoot });
  const observations = pathBrowserGatewayOwnerDbObservations(finalEvidenceInput(validated));
  const observation = observations[1];
  const { observationSha256, ...unsigned } = observation;

  assert.equal(observations.length, 2);
  assert.equal(observation.source, 'BROWSER_GLOBAL_HOME_IDENTITY');
  assert.equal(observation.tenantId, 1001);
  assert.deepEqual(observation.screenshot, validated.screenshot);
  assert.equal(observationSha256, sha256Canonical(unsigned));
});

test('fails closed when final Global Home evidence is missing or mutated', (t) => {
  const { artifactRoot, evidence } = fixture(t);
  const validated = validateHomeLaunchpadIdentityEvidence(evidence, { artifactRoot });

  assert.throws(
    () => globalHomeIdentityObservation(finalEvidenceInput(undefined)),
    (error) => error instanceof CheckpointHold && /homeLaunchpadIdentity/u.test(error.message)
  );
  for (const mutated of [
    { ...validated, visibleLabel: '인사' },
    { ...validated, screenshot: { ...validated.screenshot, sha256: 'not-a-sha256' } },
  ]) {
    assert.throws(
      () => globalHomeIdentityObservation(finalEvidenceInput(mutated)),
      (error) =>
        error instanceof CheckpointHold && /digest-bound Global Home HRIS/u.test(error.message)
    );
  }
});
