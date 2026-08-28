import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  validateX04LocalConfig,
  validateX04LocalEvidence,
} from './check-x04-local-revocation-slo.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(
  readFileSync(resolve(root, 'scripts/x04-local-revocation-slo.config.json'), 'utf8')
);

function evidenceFixture() {
  return {
    schemaVersion: 1,
    evidenceId: config.automationId,
    claimScope: config.claimScope,
    clock: config.clock,
    productionSloAttestation: null,
    readinessDisposition: config.readinessDisposition,
    externalBlockers: [...config.externalBlockers],
    scenarios: config.capabilityModes.map((mode) => ({
      mode: mode.id,
      deliveryDelayMs: mode.deliveryDelayMs,
      propagationLatencyMs: mode.deliveryDelayMs,
      cachePurgeLatencyMs: mode.deliveryDelayMs,
      uiDenialLatencyMs: mode.deliveryDelayMs,
      assertions: Object.fromEntries(
        config.requiredAssertions.map((assertion) => [assertion, true])
      ),
    })),
  };
}

test('accepts the closed local-only X-04 config and deterministic evidence', () => {
  assert.deepEqual(validateX04LocalConfig(config), []);
  assert.deepEqual(validateX04LocalEvidence(evidenceFixture(), config), []);
});

test('rejects a forged production SLO claim or completion disposition', () => {
  const forgedConfig = structuredClone(config);
  forgedConfig.productionSlo = {
    approved: true,
    thresholds: { propagation: 100 },
    attestationReference: 'https://evidence.dwp.example/forged',
  };
  forgedConfig.readinessDisposition = 'COMPLETE';
  const configErrors = validateX04LocalConfig(forgedConfig);
  assert.ok(configErrors.some((error) => error.includes('must not claim an approved production')));
  assert.ok(configErrors.some((error) => error.includes('must remain BLOCKED_EXTERNAL')));

  const forgedEvidence = evidenceFixture();
  forgedEvidence.productionSloAttestation = 'https://evidence.dwp.example/forged';
  forgedEvidence.readinessDisposition = 'COMPLETE';
  const evidenceErrors = validateX04LocalEvidence(forgedEvidence, config);
  assert.ok(evidenceErrors.some((error) => error.includes('cannot contain a production SLO')));
  assert.ok(evidenceErrors.some((error) => error.includes('must remain BLOCKED_EXTERNAL')));
});

test('rejects missing capability coverage, fail-open assertions, and latency regressions', () => {
  const evidence = evidenceFixture();
  evidence.scenarios = evidence.scenarios.slice(0, 1);
  evidence.scenarios[0].uiDenialLatencyMs = 21;
  evidence.scenarios[0].assertions.ACCESS_SENSITIVE_CACHE_PURGED = false;
  const errors = validateX04LocalEvidence(evidence, config);
  assert.ok(errors.some((error) => error.includes('exactly two capability modes')));
  assert.ok(errors.some((error) => error.includes('is missing STORAGE_FALLBACK')));
  assert.ok(errors.some((error) => error.includes('uiDenialLatencyMs exceeds')));
  assert.ok(errors.some((error) => error.includes('ACCESS_SENSITIVE_CACHE_PURGED must be true')));
});

test('rejects evidence shape drift and external blocker removal', () => {
  const evidence = evidenceFixture();
  evidence.unapprovedField = true;
  evidence.externalBlockers = evidence.externalBlockers.slice(1);
  const errors = validateX04LocalEvidence(evidence, config);
  assert.ok(errors.some((error) => error.includes('unknown fields')));
  assert.ok(errors.some((error) => error.includes('externalBlockers must exactly match')));
});
