import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  deriveReleaseReadinessStatus,
  RELEASE_READINESS_EXPECTED_IDS,
  validateReleaseReadinessPolicy,
} from './release-readiness-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registrySource = resolve(root, 'docs/06-delivery/release-evidence/release-readiness.json');

function fixture() {
  return structuredClone(JSON.parse(readFileSync(registrySource, 'utf8')));
}

function allItems(registry) {
  return Object.keys(RELEASE_READINESS_EXPECTED_IDS).flatMap((section) => registry[section]);
}

function completionReceipt(id) {
  return {
    commit: '1'.repeat(40),
    environment: 'production',
    runId: `release-${id}`,
    occurredAt: '2026-08-28T00:00:00.000Z',
    sha256: `sha256:${'2'.repeat(64)}`,
    issuer: 'dwp-release-attestor',
    signatureRef: `https://evidence.dwp.example/receipts/${id}`,
  };
}

test('accepts the current explicitly blocked registry with all exact required IDs', () => {
  const registry = fixture();
  assert.deepEqual(validateReleaseReadinessPolicy(registry), []);
  assert.equal(deriveReleaseReadinessStatus(registry), 'BLOCKED_EXTERNAL_EVIDENCE');
  for (const id of ['R3-06', 'A-06', 'A-07']) {
    const item = allItems(registry).find((candidate) => candidate.id === id);
    assert.equal(item?.state, 'BLOCKED_EXTERNAL');
    assert.ok(item?.blockers.length > 0);
  }
});

test('rejects a missing Provider assurance or customer drill gate', () => {
  const registry = fixture();
  registry.productionHardening = registry.productionHardening.filter((item) => item.id !== 'R3-06');
  registry.approvals = registry.approvals.filter((item) => item.id !== 'A-07');
  const errors = validateReleaseReadinessPolicy(registry);
  assert.ok(errors.some((error) => error.includes('productionHardening is missing R3-06')));
  assert.ok(errors.some((error) => error.includes('approvals is missing A-07')));
});

test('rejects stale or unknown top-level status in both directions', () => {
  const registry = fixture();
  registry.status = 'READY';
  assert.ok(
    validateReleaseReadinessPolicy(registry).some((error) =>
      error.includes('Registry status must be BLOCKED_EXTERNAL_EVIDENCE')
    )
  );

  registry.status = 'NOT_REVIEWED';
  assert.ok(
    validateReleaseReadinessPolicy(registry).some((error) =>
      error.includes('Registry has invalid status NOT_REVIEWED')
    )
  );
});

test('rejects document-only fake completion without a signed receipt', () => {
  const registry = fixture();
  const customerApproval = registry.approvals.find((item) => item.id === 'A-06');
  customerApproval.state = 'COMPLETE';
  customerApproval.blockers = [];
  const errors = validateReleaseReadinessPolicy(registry);
  assert.ok(errors.some((error) => error === 'A-06 COMPLETE requires a signed completionReceipt.'));
});

test('accepts READY only when every required gate has a closed signed receipt', () => {
  const registry = fixture();
  for (const item of allItems(registry)) {
    if (!item.releaseRequired) continue;
    item.state = 'COMPLETE';
    item.blockers = [];
    item.completionReceipt = completionReceipt(item.id);
  }
  registry.status = 'READY';
  assert.equal(deriveReleaseReadinessStatus(registry), 'READY');
  assert.deepEqual(validateReleaseReadinessPolicy(registry), []);

  registry.status = 'BLOCKED_EXTERNAL_EVIDENCE';
  assert.ok(
    validateReleaseReadinessPolicy(registry).some((error) =>
      error.includes('Registry status must be READY')
    )
  );
});
