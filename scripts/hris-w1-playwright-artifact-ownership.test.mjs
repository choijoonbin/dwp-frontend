import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  HRIS_W1_ARTIFACT_OWNER_MARKER,
  claimHrisW1ArtifactRoot,
} from './hris-w1-playwright-artifact-ownership.mjs';
import { browserChildEnvironment } from './hris-w1-checkpoint-browser-run.mjs';

const RUN_ID = 'w1-owner-contract-test';
const OWNER_A = 'a'.repeat(64);
const OWNER_B = 'b'.repeat(64);

function fixture(t) {
  const parent = mkdtempSync(path.join(tmpdir(), 'hris-w1-owner-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  return path.join(parent, `hris-w1-live-browser-${RUN_ID}`);
}

test('same Playwright execution can evaluate config twice through its exact owner marker', (t) => {
  const artifactRoot = fixture(t);

  assert.equal(claimHrisW1ArtifactRoot(artifactRoot, RUN_ID, OWNER_A), 'CREATED_BY_OWNER');
  assert.equal(claimHrisW1ArtifactRoot(artifactRoot, RUN_ID, OWNER_A), 'REUSED_BY_OWNER');

  const marker = readFileSync(path.join(artifactRoot, HRIS_W1_ARTIFACT_OWNER_MARKER), 'utf8');
  assert.doesNotMatch(marker, new RegExp(OWNER_A, 'u'));
});

test('pre-existing unowned artifact directory remains fail-closed', (t) => {
  const artifactRoot = fixture(t);
  mkdirSync(artifactRoot, { mode: 0o700 });
  writeFileSync(path.join(artifactRoot, 'prior-evidence.json'), '{}\n');

  assert.throws(
    () => claimHrisW1ArtifactRoot(artifactRoot, RUN_ID, OWNER_A),
    /without its live owner marker/u
  );
});

test('marker from another Playwright execution cannot authorize reuse', (t) => {
  const artifactRoot = fixture(t);
  claimHrisW1ArtifactRoot(artifactRoot, RUN_ID, OWNER_A);

  assert.throws(
    () => claimHrisW1ArtifactRoot(artifactRoot, RUN_ID, OWNER_B),
    /owned by another execution/u
  );
});

test('browser child receives only a canonical execution owner token', () => {
  const environment = {
    runId: RUN_ID,
    endpoints: { gateway: 'http://127.0.0.1:21007' },
    tenants: [
      { tenantId: 1001, email: 'admin-a@dwp.test', password: 'synthetic-password-a' },
      { tenantId: 1002, email: 'admin-b@dwp.test', password: 'synthetic-password-b' },
    ],
  };
  const artifactRoot = `/tmp/hris-w1-live-browser-${RUN_ID}`;
  const childEnvironment = browserChildEnvironment(
    environment,
    { tenantA: [], tenantB: [] },
    21_999,
    artifactRoot,
    { configurationId: '30000000-0000-4000-8000-000000000001' },
    OWNER_A
  );

  assert.equal(childEnvironment.HRIS_W1_LIVE_ARTIFACT_OWNER_TOKEN, OWNER_A);
  assert.throws(
    () =>
      browserChildEnvironment(
        environment,
        { tenantA: [], tenantB: [] },
        21_999,
        artifactRoot,
        { configurationId: '30000000-0000-4000-8000-000000000001' },
        `${OWNER_A}0`
      ),
    /artifact owner token is noncanonical/iu
  );
});
