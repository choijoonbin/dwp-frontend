import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CheckpointHold, sha256Canonical } from './hris-w1-checkpoint-core.mjs';
import {
  validateBrowserRuntimeObservation,
  validateHomeLaunchpadIdentityEvidence,
} from './hris-w1-checkpoint-browser-evidence.mjs';
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

function runtimeObservation() {
  const response = {
    status: 200,
    bodyByteLength: 128,
    responseBodySha256: 'a'.repeat(64),
    fromServiceWorker: false,
  };
  const authority = (routeContractKey, contextScopeKey, subjectSurfaceKey, reason) => ({
    routeContractKey,
    contextScopeKey,
    subjectType: 'PRODUCT',
    subjectProductKey: 'hcm',
    subjectSurfaceKey,
    action: 'CONTINUED',
    reason,
    response,
  });
  return {
    label: 'tenant-a',
    homeRuntime: {
      runtimeState: 'SHADOW_COMPARE',
      renderAuthority: 'LEGACY',
      actionAuthority: 'DISABLED',
    },
    diagnostics: {
      consoleErrorCount: 0,
      consoleErrorSha256: [],
      pageErrorCount: 0,
      pageErrorSha256: [],
    },
    firewall: {
      interceptedHttpRequests: 19,
      continuedHttpRequests: 18,
      continuedMutations: [
        { method: 'POST', path: '/api/auth/product-surface-access/evaluate' },
        { method: 'POST', path: '/api/auth/product-surface-access/evaluate' },
      ],
      evaluationRequests: [
        authority(
          'route.hcm.operations.people.page',
          'hcm-scope-active',
          'hcm.operations',
          'EXACT_PAGE_CONTRACT'
        ),
        authority(
          'route.hcm.personal.directory.page',
          null,
          'hcm.personal',
          'EXACT_BACKGROUND_PAGE_CONTRACT'
        ),
      ],
      expectedBlockedSideEffects: [
        {
          method: 'POST',
          path: '/api/platform/v2/home/shadow-receipts',
          query: '',
          reason: 'EXPECTED_BLOCKED_HOME_SHADOW_RECEIPT',
          runtimeState: 'SHADOW_COMPARE',
          bodyByteLength: 256,
          requestBodySha256: 'b'.repeat(64),
          decisionRevisionSha256: 'c'.repeat(64),
        },
      ],
      blockedMutations: [],
      blockedExternalHttp: [],
      blockedExternalWebSockets: [],
    },
  };
}

const runtimeRouteMatrix = [
  {
    outcome: 'allowed',
    pageRouteContractKey: 'route.hcm.operations.people.page',
    expectedScopeKey: 'hcm-scope-active',
  },
];

test('browser v4 runtime evidence accepts exact authority and blocked SHADOW side effect', () => {
  const validated = validateBrowserRuntimeObservation(
    runtimeObservation(),
    'tenant-a',
    runtimeRouteMatrix,
    true
  );

  assert.equal(validated.firewall.evaluationRequests.length, 2);
  assert.equal(validated.firewall.expectedBlockedSideEffects.length, 1);
  assert.equal(validated.homeRuntime.runtimeState, 'SHADOW_COMPARE');
});

test('browser v4 runtime evidence rejects duplicate receipts, missing responses, and diagnostics', () => {
  const duplicate = runtimeObservation();
  duplicate.firewall.expectedBlockedSideEffects.push(
    structuredClone(duplicate.firewall.expectedBlockedSideEffects[0])
  );
  duplicate.firewall.interceptedHttpRequests += 1;
  assert.throws(
    () => validateBrowserRuntimeObservation(duplicate, 'tenant-a', runtimeRouteMatrix, true),
    (error) => error instanceof CheckpointHold && /side-effect count/u.test(error.message)
  );

  const missingResponse = runtimeObservation();
  missingResponse.firewall.evaluationRequests[0].response = null;
  assert.throws(
    () => validateBrowserRuntimeObservation(missingResponse, 'tenant-a', runtimeRouteMatrix, true),
    (error) =>
      error instanceof CheckpointHold && /unexpected authority evaluation/u.test(error.message)
  );

  const unofficialBackground = runtimeObservation();
  unofficialBackground.firewall.evaluationRequests[1].routeContractKey =
    'route.hcm.personal.unofficial.page';
  assert.throws(
    () =>
      validateBrowserRuntimeObservation(unofficialBackground, 'tenant-a', runtimeRouteMatrix, true),
    (error) =>
      error instanceof CheckpointHold && /non-official background PAGE/u.test(error.message)
  );

  const diagnostics = runtimeObservation();
  diagnostics.diagnostics.consoleErrorCount = 1;
  diagnostics.diagnostics.consoleErrorSha256 = ['d'.repeat(64)];
  assert.throws(
    () => validateBrowserRuntimeObservation(diagnostics, 'tenant-a', runtimeRouteMatrix, true),
    (error) => error instanceof CheckpointHold && /zero-error browser runtime/u.test(error.message)
  );
});
