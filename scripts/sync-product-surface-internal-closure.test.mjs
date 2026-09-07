import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checker = path.join(root, 'scripts/sync-product-surface-internal-closure.mjs');
const authorizationSource = path.join(root, 'architecture/product-surface-authorization.v1.json');
const closureSource = path.join(
  root,
  'architecture/product-surface-internal-closure.v1.generated.json'
);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createFixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dwp-internal-closure-'));
  temporaryDirectories.push(workspace);
  const architecture = path.join(workspace, 'architecture');
  const backend = path.join(workspace, 'backend');
  const official = path.join(backend, 'contracts/product-authorization');
  fs.mkdirSync(architecture, { recursive: true });
  fs.mkdirSync(official, { recursive: true });
  git(backend, 'init', '--initial-branch=main');
  git(backend, 'config', 'user.email', 'closure-test@dwp.example');
  git(backend, 'config', 'user.name', 'Closure Test');
  git(backend, 'remote', 'add', 'origin', 'https://github.com/choijoonbin/dwp-backend.git');
  const authorization = JSON.parse(fs.readFileSync(authorizationSource, 'utf8'));
  const closure = JSON.parse(fs.readFileSync(closureSource, 'utf8'));
  const closureBundle = authorization.bundles.find(
    (bundle) => bundle.version === closure.generatedFrom.authorizationBundle.version
  );
  assert.ok(closureBundle, 'the attested closure bundle must remain in the registry lineage');
  fs.writeFileSync(
    path.join(architecture, 'product-surface-authorization.v1.json'),
    `${JSON.stringify(authorization, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(official, 'product-surfaces-v1.bundle-v4.json'),
    `${JSON.stringify(closureBundle, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(official, 'product-surface-rollout-inventory.v1.generated.json'),
    `${JSON.stringify(authorization.rolloutInventory, null, 2)}\n`
  );
  const matrix = {
    schemaVersion: 1,
    matrixId: closure.generatedFrom.negativeMatrix.matrixId,
    completionState: closure.summary.completionState,
    rolloutInventory: {
      reference:
        'contracts/product-authorization/product-surface-rollout-inventory.v1.generated.json',
      checksum: closure.generatedFrom.rolloutInventory.checksum,
    },
    exactContract: {
      reference: 'contracts/product-authorization/product-surfaces-v1.bundle-v4.json',
      checksum: closure.generatedFrom.authorizationBundle.checksum,
      products: closure.products.map(({ productId }) => productId),
    },
    attackVectors: closure.attackVectors.map((id) => ({ id, gatewayTestReferences: [] })),
    products: closure.products.map((product) => ({
      productId: product.productId,
      contractStatus: product.contractStatus,
      ownerService: product.ownerService,
      rolloutCeiling: '111',
      attackEvidence: Object.fromEntries(
        Object.entries(product.attackEvidence).filter(([, references]) => references.length > 0)
      ),
      missingAttackIds: product.missingAttackIds,
      blocker: product.blocker,
    })),
  };
  const matrixPath = path.join(official, 'authorization-negative-matrix.v1.json');
  fs.writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
  const agentAttestation = buildAgentAttestation();
  fs.writeFileSync(
    path.join(official, 'dwaion-agent-pep-attestation.v1.json'),
    `${JSON.stringify(agentAttestation, null, 2)}\n`
  );
  git(backend, 'add', 'contracts');
  git(backend, 'commit', '-m', 'Add official closure fixture');
  const revision = git(backend, 'rev-parse', 'HEAD');
  closure.generatedFrom.backend = {
    repository: 'https://github.com/choijoonbin/dwp-backend',
    revision,
  };
  closure.generatedFrom.negativeMatrix.artifactChecksum = checksum(matrix);
  closure.generatedFrom.agentEvidence = {
    artifact: 'dwaion-agent-pep-attestation.v1.json',
    repository: agentAttestation.repository,
    revision: agentAttestation.revision,
    checksum: agentAttestation.checksum,
    artifactChecksum: checksum(agentAttestation),
    sourceCiRun: agentAttestation.sourceCiRun,
  };
  return { workspace, backend, official, matrixPath, closure, revision };
}

function run(fixture, ...arguments_) {
  if (git(fixture.backend, 'status', '--porcelain')) {
    git(fixture.backend, 'add', '--all');
    git(fixture.backend, 'commit', '-m', 'Update official closure fixture');
    fixture.revision = git(fixture.backend, 'rev-parse', 'HEAD');
  }
  return spawnSync(
    process.execPath,
    [
      checker,
      ...arguments_,
      '--backend-checkout',
      fixture.backend,
      '--source-revision',
      fixture.revision,
    ],
    {
      cwd: fixture.workspace,
      encoding: 'utf8',
    }
  );
}

function buildAgentAttestation() {
  const value = {
    schemaVersion: 1,
    attestationId: 'dwaion-agent-owner-pep.v1',
    repository: 'https://github.com/choijoonbin/aura_agent',
    revision: '1'.repeat(40),
    sourceCiRun: {
      provider: 'GITHUB_ACTIONS',
      workflow: 'Agent quality',
      runId: '123',
      url: 'https://github.com/choijoonbin/aura_agent/actions/runs/123',
      headSha: '1'.repeat(40),
      conclusion: 'success',
    },
  };
  value.checksum = checksum(value);
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function checksum(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function git(directory, ...arguments_) {
  const result = spawnSync('git', ['-C', directory, ...arguments_], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

test('generates and rechecks the calculated official backend closure projection', () => {
  const fixture = createFixture();
  const sync = run(fixture, '--sync', fixture.official);
  assert.equal(sync.status, 0, `${sync.stdout}\n${sync.stderr}`);
  assert.match(
    sync.stdout,
    new RegExp(
      `${fixture.closure.summary.qualifiedAttackCells}/${fixture.closure.summary.totalAttackCells} ` +
        `PEP cells \\(${fixture.closure.summary.completionState}\\)`
    )
  );
  assert.equal(
    fs.readFileSync(
      path.join(
        fixture.workspace,
        'architecture/product-surface-internal-closure.v1.generated.json'
      ),
      'utf8'
    ),
    `${JSON.stringify(fixture.closure, null, 2)}\n`
  );

  const check = run(fixture, '--check', fixture.official);
  assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
  assert.match(check.stdout, /official backend artifacts matched/);
});

test('rejects a matrix that declares completion while an attack vector is missing', () => {
  const fixture = createFixture();
  const matrix = JSON.parse(fs.readFileSync(fixture.matrixPath, 'utf8'));
  const product = matrix.products[0];
  const attackId = fixture.closure.attackVectors[0];
  delete product.attackEvidence[attackId];
  product.missingAttackIds = [attackId];
  product.blocker = 'MISSING_TEST_VECTOR';
  matrix.completionState = 'COMPLETE';
  fs.writeFileSync(fixture.matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
  const result = run(fixture, '--sync', fixture.official);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /completionState must be PARTIAL/);
});

test('rejects missing-cell metadata that is not derived from executable references', () => {
  const fixture = createFixture();
  const matrix = JSON.parse(fs.readFileSync(fixture.matrixPath, 'utf8'));
  const product = matrix.products[0];
  delete product.attackEvidence[fixture.closure.attackVectors[0]];
  fs.writeFileSync(fixture.matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
  const result = run(fixture, '--sync', fixture.official);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing attack vector declaration is not calculated/);
});

test('fails closed when the official matrix artifact is absent', () => {
  const fixture = createFixture();
  fs.rmSync(fixture.matrixPath);
  const result = run(fixture, '--sync', fixture.official);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /authorization negative matrix is missing/);
});

test('rejects a closure bundle checksum outside its immutable registry lineage', () => {
  const fixture = createFixture();
  const sync = run(fixture, '--sync', fixture.official);
  assert.equal(sync.status, 0, `${sync.stdout}\n${sync.stderr}`);
  const closurePath = path.join(
    fixture.workspace,
    'architecture/product-surface-internal-closure.v1.generated.json'
  );
  const closure = JSON.parse(fs.readFileSync(closurePath, 'utf8'));
  closure.generatedFrom.authorizationBundle.checksum = 'f'.repeat(64);
  fs.writeFileSync(closurePath, `${JSON.stringify(closure, null, 2)}\n`);

  const result = run(fixture, '--check');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /outside or differs from its immutable authorization bundle/);
});
