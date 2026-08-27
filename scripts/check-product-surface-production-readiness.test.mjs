import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checker = resolve(root, 'scripts/check-product-surface-production-readiness.mjs');
const schemaSource = resolve(root, 'architecture/product-surface-production-readiness.schema.json');
const manifestSource = resolve(
  root,
  'docs/06-delivery/release-evidence/product-surface-production-readiness.json'
);
const packageSource = resolve(root, 'package.json');
const releaseWorkflowSource = resolve(root, '.github/workflows/release-readiness.yml');
const evidenceReference =
  'docs/03-architecture/R1 제품 업무·관리 Surface 분리 및 관리 Context ADR.md';
const evidenceChecksum = `sha256:${createHash('sha256')
  .update(readFileSync(resolve(root, evidenceReference)))
  .digest('hex')}`;
const sourceRevision = '1'.repeat(40);
const provenanceKindByEvidenceType = new Map([
  ['OWNER_APPROVAL', 'OWNER_APPROVAL_ATTESTATION'],
  ['OPENAPI', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['CONTRACT_CHECKSUM', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['PAGE_CONTRACT', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['DATA_CONTRACT', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['ACTION_CONTRACT', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['GATEWAY_PEP_TEST', 'AUTOMATED_RUN_ATTESTATION'],
  ['SERVICE_PEP_TEST', 'AUTOMATED_RUN_ATTESTATION'],
  ['CROSS_TENANT_NEGATIVE_TEST', 'AUTOMATED_RUN_ATTESTATION'],
  ['AUTOMATED_TEST_RUN', 'AUTOMATED_RUN_ATTESTATION'],
  ['ARTIFACT_ROUTING_MATRIX', 'AUTOMATED_RUN_ATTESTATION'],
  ['REVOCATION_SLO', 'AUTOMATED_RUN_ATTESTATION'],
  ['CHAOS_TEST', 'AUTOMATED_RUN_ATTESTATION'],
  ['DEPLOYMENT_TRUST_ATTESTATION', 'DEPLOYMENT_ATTESTATION'],
  ['ROLLBACK_REHEARSAL', 'DEPLOYMENT_ATTESTATION'],
  ['FEATURE_DISABLED_AT_RELEASE', 'DEPLOYMENT_ATTESTATION'],
  ['PRIVACY_APPROVAL', 'INDEPENDENT_REVIEW_ATTESTATION'],
  ['ACCESSIBILITY_MANUAL_AT', 'INDEPENDENT_REVIEW_ATTESTATION'],
  ['TELEMETRY_RETENTION', 'INDEPENDENT_REVIEW_ATTESTATION'],
  ['USABILITY_STUDY', 'INDEPENDENT_REVIEW_ATTESTATION'],
  ['PENETRATION_TEST', 'INDEPENDENT_REVIEW_ATTESTATION'],
]);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'dwp-product-surface-readiness-'));
  temporaryDirectories.push(directory);
  return {
    directory,
    path: join(directory, 'manifest.json'),
    manifest: JSON.parse(readFileSync(manifestSource, 'utf8')),
  };
}

function run(value, arguments_ = []) {
  writeFileSync(value.path, `${JSON.stringify(value.manifest, null, 2)}\n`);
  return spawnSync(
    process.execPath,
    [checker, '--manifest', value.path, '--root', root, ...arguments_],
    { cwd: root, encoding: 'utf8' }
  );
}

function runWithSchema(value, schema) {
  const schemaPath = join(value.directory, 'schema.json');
  writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
  return run(value, ['--schema', schemaPath]);
}

function allItems(manifest) {
  return [
    ...manifest.productionGates,
    ...manifest.decisions,
    ...manifest.products,
    ...manifest.exitCriteria,
  ];
}

function completeManifest(value) {
  value.manifest.status = 'READY';
  for (const item of allItems(value.manifest)) {
    item.state = 'COMPLETE';
    item.approval = {
      approvedBy: [item.owner],
      approvedAt: '2026-08-27T12:00:00.000Z',
    };
    item.evidence = item.requiredEvidenceTypes.map((type) => {
      const evidenceIdentity = `${item.id}/${type}`;
      return {
        type,
        owner: item.owner,
        recordedAt: '2026-08-27T12:00:00.000Z',
        reference: `https://evidence.dwp.example/releases/${evidenceIdentity}`,
        checksum: digest(`evidence:${evidenceIdentity}`),
        provenance: {
          kind: provenanceKindByEvidenceType.get(type),
          claim: type,
          issuer: 'dwp-release-attestor',
          sourceRevision,
          attestationReference: `https://evidence.dwp.example/attestations/${evidenceIdentity}`,
          attestationChecksum: digest(`attestation:${evidenceIdentity}`),
        },
      };
    });
    item.blockers = [];
    item.failClosedEvidence = [];
  }
}

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

test('integrity mode accepts the explicitly blocked production manifest', () => {
  const value = fixture();
  const result = run(value);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /exact product closure: 0\/12/);
  assert.match(result.stdout, /schema and integrity only/);
});

test('pins X-03 to the semantically qualified 47-cell internal blocker', () => {
  const value = fixture();
  const x03 = value.manifest.exitCriteria.find((item) => item.id === 'X-03');

  assert.deepEqual(x03?.blockers, ['INTERNAL_47_PRODUCT_VECTOR_SERVICE_PEP_CELLS']);
  assert.doesNotMatch(JSON.stringify(x03), /INTERNAL_44_PRODUCT_VECTOR_SERVICE_PEP_CELLS/);
  const result = run(value);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('release mode fails closed without converting pending approvals to completion', () => {
  const value = fixture();
  const result = run(value, ['--release']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /G-02 BLOCKED_EXTERNAL/);
  assert.match(result.stderr, /P-MEETINGS PENDING_INTERNAL/);
  assert.match(result.stderr, /X-08 BLOCKED_EXTERNAL/);
});

test('official release paths execute the Product Surface release gate and block this manifest', () => {
  const packageManifest = JSON.parse(readFileSync(packageSource, 'utf8'));
  assert.match(
    packageManifest.scripts?.['release:gate'] ?? '',
    /^node scripts\/check-product-surface-production-readiness\.mjs --release && /,
    'release:gate must fail on Product Surface readiness before other release checks'
  );

  const releaseWorkflow = readFileSync(releaseWorkflowSource, 'utf8');
  assert.match(
    releaseWorkflow,
    /run: corepack yarn product-surfaces:readiness:test/,
    'the release workflow must retain the fail-closed binding regression test'
  );
  assert.match(
    releaseWorkflow,
    /run: corepack yarn product-surfaces:readiness:release/,
    'the release workflow must enforce Product Surface production readiness explicitly'
  );

  const result = spawnSync(process.execPath, [checker, '--release'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Product Surface production release is blocked/);
  assert.match(result.stderr, /X-03 PENDING_INTERNAL/);
  assert.match(result.stderr, /X-05 BLOCKED_EXTERNAL/);
});

test('rejects Management automatic restoration and incomplete navigation acceptance IDs', () => {
  const value = fixture();
  value.manifest.navigationConveniencePolicy.managementAutomaticRestore = 'ALLOWED';
  value.manifest.navigationConveniencePolicy.acceptanceCriteria.pop();
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Management automatic last-route restoration must remain FORBIDDEN/);
  assert.match(result.stderr, /navigation acceptance is missing NC-05/);
});

test('rejects scoped JIT exposure or a weakened re-enablement contract', () => {
  const value = fixture();
  value.manifest.scopedJitReleasePolicy.activation = 'ENABLED';
  value.manifest.scopedJitReleasePolicy.environmentOverride = 'ALLOWED';
  value.manifest.scopedJitReleasePolicy.allowedScopes = ['TENANT'];
  value.manifest.scopedJitReleasePolicy.reenablementRequirements.pop();
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /scoped JIT must remain disabled without an environment override/);
  assert.match(result.stderr, /scoped JIT cannot expose any release scope while disabled/);
  assert.match(result.stderr, /re-enablement requirements do not match the fixed release contract/);
});

test('rejects schema drift that would weaken Management or evidence validation', () => {
  const value = fixture();
  const schema = JSON.parse(readFileSync(schemaSource, 'utf8'));
  schema.$defs.navigationConveniencePolicy.properties.managementAutomaticRestore.const = 'ALLOWED';
  schema.$defs.scopedJitReleasePolicy.properties.activation.const = 'ENABLED';
  schema.$defs.evidence.properties.type.enum.pop();
  schema.$defs.evidenceProvenance.properties.kind.enum.pop();
  const result = runWithSchema(value, schema);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /schema evidence types have drifted/);
  assert.match(result.stderr, /schema evidence provenance kinds have drifted/);
  assert.match(result.stderr, /schema Management restoration policy has drifted/);
  assert.match(result.stderr, /schema scoped JIT disablement has drifted/);
});

test('rejects product inventory drift, rollout widening and under-declared evidence', () => {
  const value = fixture();
  value.manifest.products[11].productId = 'unknown-product';
  value.manifest.products[0].rolloutDefault = '111';
  value.manifest.products[1].requiredEvidenceTypes = ['OWNER_APPROVAL'];
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /products is missing meetings/);
  assert.match(result.stderr, /products has unknown IDs unknown-product/);
  assert.match(result.stderr, /rolloutDefault must match the fail-closed inventory value 000/);
  assert.match(result.stderr, /requiredEvidenceTypes do not match the fixed release contract/);
});

test('cannot mark an item complete without dated approval and every immutable evidence type', () => {
  const value = fixture();
  const item = value.manifest.productionGates[0];
  item.state = 'COMPLETE';
  item.blockers = [];
  item.failClosedEvidence = [];
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /G-02 COMPLETE requires named approvers/);
  assert.match(result.stderr, /G-02 COMPLETE requires approvedAt/);
  assert.match(result.stderr, /G-02 COMPLETE is missing OWNER_APPROVAL, OPENAPI/);
});

test('rejects a forged local evidence checksum', () => {
  const value = fixture();
  completeManifest(value);
  const evidence = value.manifest.productionGates[0].evidence.find(
    (entry) => entry.type === 'CONTRACT_CHECKSUM'
  );
  evidence.reference = evidenceReference;
  evidence.checksum = `sha256:${'a'.repeat(64)}`;
  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /evidence checksum does not match/);
});

test('rejects an ADR or attestation reused across distinct evidence claims and items', () => {
  const value = fixture();
  completeManifest(value);
  const evidenceEntries = [
    value.manifest.productionGates[0].evidence.find((entry) => entry.type === 'OPENAPI'),
    value.manifest.productionGates[1].evidence.find((entry) => entry.type === 'CONTRACT_CHECKSUM'),
  ];
  for (const evidence of evidenceEntries) {
    evidence.reference = evidenceReference;
    evidence.checksum = evidenceChecksum;
    evidence.provenance.attestationReference =
      'https://evidence.dwp.example/attestations/reused-across-claims';
  }
  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /manifest evidence reference .* is reused across distinct claims/);
  assert.match(result.stderr, /manifest evidence attestation .* is reused across distinct claims/);
});

test('rejects mismatched, unpinned or untrusted evidence provenance', () => {
  const value = fixture();
  completeManifest(value);
  const evidence = value.manifest.exitCriteria[2].evidence.find(
    (entry) => entry.type === 'CROSS_TENANT_NEGATIVE_TEST'
  );
  evidence.provenance.kind = 'OWNER_APPROVAL_ATTESTATION';
  evidence.provenance.claim = 'OWNER_APPROVAL';
  evidence.provenance.sourceRevision = 'main';
  evidence.provenance.attestationReference = evidenceReference;
  evidence.provenance.attestationChecksum = 'unverified';
  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /CROSS_TENANT_NEGATIVE_TEST evidence requires AUTOMATED_RUN_ATTESTATION provenance/
  );
  assert.match(result.stderr, /provenance claim must equal CROSS_TENANT_NEGATIVE_TEST/);
  assert.match(result.stderr, /requires a full lowercase source revision/);
  assert.match(result.stderr, /requires an HTTPS attestation reference/);
  assert.match(result.stderr, /requires an immutable attestation checksum/);
});

test('release mode accepts only a fully approved and checksummed 12-product manifest', () => {
  const value = fixture();
  completeManifest(value);
  const result = run(value, ['--release']);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /exact product closure: 12\/12/);
  assert.match(result.stdout, /production release gate passed/);
});

test('rejects READY status while any release-required item remains incomplete', () => {
  const value = fixture();
  value.manifest.status = 'READY';
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot be READY while release-required evidence is incomplete/);
});
