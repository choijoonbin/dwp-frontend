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
const checker = path.join(root, 'scripts/check-official-backend-contracts.mjs');
const fixtureChecker = path.join(root, 'scripts/sync-product-authorization-fixtures.mjs');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function cleanEnvironment() {
  const environment = { ...process.env };
  delete environment.DWP_OFFICIAL_BACKEND_CONTRACTS_DIR;
  delete environment.DWP_PRODUCT_AUTHORIZATION_DIR;
  delete environment.DWP_PRODUCT_AUTHORIZATION_FIXTURE;
  delete environment.DWP_GATEWAY_OPENAPI;
  delete environment.DWP_BACKEND_CHECKOUT;
  delete environment.DWP_BACKEND_REVISION;
  delete environment.DWP_AGENT_EVIDENCE_ROOT;
  return environment;
}

function run(arguments_, environment = cleanEnvironment()) {
  return spawnSync(process.execPath, [checker, ...arguments_], {
    cwd: root,
    encoding: 'utf8',
    env: environment,
  });
}

function runFixtureCheck(fixture, authorizationDirectory) {
  return spawnSync(
    process.execPath,
    [fixtureChecker, '--check', fixture, '--authorization', authorizationDirectory],
    { cwd: root, encoding: 'utf8', env: cleanEnvironment() }
  );
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

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function writeFixture(fixturePath, fixture) {
  const checksumInput = structuredClone(fixture);
  delete checksumInput.fixtureChecksum;
  fixture.fixtureChecksum = sha256(checksumInput);
  fs.writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
}

function createOfficialContracts() {
  const contracts = fs.mkdtempSync(path.join(os.tmpdir(), 'dwp-official-contracts-'));
  temporaryDirectories.push(contracts);
  const authorizationDirectory = path.join(contracts, 'product-authorization');
  const openApiDirectory = path.join(contracts, 'openapi');
  fs.mkdirSync(authorizationDirectory, { recursive: true });
  fs.mkdirSync(openApiDirectory, { recursive: true });

  const snapshot = JSON.parse(
    fs.readFileSync(path.join(root, 'architecture/product-surface-authorization.v1.json'), 'utf8')
  );
  fs.writeFileSync(
    path.join(authorizationDirectory, 'product-surfaces-v1.index.json'),
    `${JSON.stringify(snapshot.index, null, 2)}\n`
  );
  snapshot.bundles.forEach((bundle, index) => {
    fs.writeFileSync(
      path.join(authorizationDirectory, `product-surfaces-v1.bundle-v${index + 1}.json`),
      `${JSON.stringify(bundle, null, 2)}\n`
    );
  });
  fs.writeFileSync(
    path.join(authorizationDirectory, 'product-surface-rollout-inventory.v1.generated.json'),
    `${JSON.stringify(snapshot.rolloutInventory, null, 2)}\n`
  );
  const latestVersion = snapshot.index.latestVersion;
  fs.copyFileSync(
    path.join(authorizationDirectory, `product-surfaces-v1.bundle-v${latestVersion}.json`),
    path.join(authorizationDirectory, 'product-surfaces-v1.json')
  );
  fs.copyFileSync(
    path.join(root, 'architecture/pilot-fixtures.v1.generated.json'),
    path.join(authorizationDirectory, 'pilot-fixtures.v1.generated.json')
  );
  const closure = JSON.parse(
    fs.readFileSync(
      path.join(root, 'architecture/product-surface-internal-closure.v1.generated.json'),
      'utf8'
    )
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
  fs.writeFileSync(
    path.join(authorizationDirectory, 'authorization-negative-matrix.v1.json'),
    `${JSON.stringify(matrix, null, 2)}\n`
  );
  fs.copyFileSync(
    path.join(root, 'libs/api-contracts/openapi/gateway-public.json'),
    path.join(openApiDirectory, 'gateway-public.json')
  );
  return contracts;
}

test('fails closed when official backend release inputs are absent', () => {
  const result = run([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires explicit official backend/);
});

test('accepts a complete byte-identical official backend contract set', () => {
  const contracts = createOfficialContracts();
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /all official backend release artifacts/);
});

test('accepts all three explicit contract-specific environment inputs', () => {
  const contracts = createOfficialContracts();
  const environment = cleanEnvironment();
  environment.DWP_PRODUCT_AUTHORIZATION_DIR = path.join(contracts, 'product-authorization');
  environment.DWP_PRODUCT_AUTHORIZATION_FIXTURE = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  environment.DWP_GATEWAY_OPENAPI = path.join(contracts, 'openapi/gateway-public.json');
  const result = run([], environment);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('official package environment fails closed without pinned executable source checkouts', () => {
  const contracts = createOfficialContracts();
  const environment = cleanEnvironment();
  environment.DWP_OFFICIAL_BACKEND_CONTRACTS_DIR = contracts;
  environment.DWP_PRODUCT_AUTHORIZATION_DIR = '/ambient/not-authoritative/authorization';
  environment.DWP_PRODUCT_AUTHORIZATION_FIXTURE = '/ambient/not-authoritative/fixture.json';
  environment.DWP_GATEWAY_OPENAPI = '/ambient/not-authoritative/gateway.json';
  const result = run([], environment);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires DWP_BACKEND_CHECKOUT/);
});

test('rejects mixing package and contract-specific CLI modes', () => {
  const contracts = createOfficialContracts();
  const result = run([
    '--backend-contracts',
    contracts,
    '--gateway-openapi',
    path.join(contracts, 'openapi/gateway-public.json'),
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /mutually exclusive/);
});

test('complete contract-specific CLI inputs ignore an ambient package root', () => {
  const contracts = createOfficialContracts();
  const environment = cleanEnvironment();
  environment.DWP_OFFICIAL_BACKEND_CONTRACTS_DIR = '/ambient/not-authoritative/contracts';
  const result = run(
    [
      '--authorization-directory',
      path.join(contracts, 'product-authorization'),
      '--fixture-artifact',
      path.join(contracts, 'product-authorization/pilot-fixtures.v1.generated.json'),
      '--gateway-openapi',
      path.join(contracts, 'openapi/gateway-public.json'),
    ],
    environment
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('rejects duplicate or incomplete contract-specific CLI inputs', () => {
  const contracts = createOfficialContracts();
  const duplicate = run([
    '--gateway-openapi',
    path.join(contracts, 'openapi/gateway-public.json'),
    '--gateway-openapi',
    path.join(contracts, 'openapi/gateway-public.json'),
  ]);
  assert.equal(duplicate.status, 2);
  const incomplete = run([
    '--authorization-directory',
    path.join(contracts, 'product-authorization'),
  ]);
  assert.equal(incomplete.status, 2);
  assert.match(incomplete.stderr, /requires explicit official backend/);
});

test('rejects fixture formatting drift even when canonical checksum metadata remains valid', () => {
  const contracts = createOfficialContracts();
  const fixture = path.join(contracts, 'product-authorization/pilot-fixtures.v1.generated.json');
  fs.appendFileSync(fixture, '\n');
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fixture snapshot is not byte-identical/);
});

test('rejects authorization content with a stale canonical checksum', () => {
  const contracts = createOfficialContracts();
  const bundlePath = path.join(
    contracts,
    'product-authorization/product-surfaces-v1.bundle-v5.json'
  );
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  bundle.owner = `${bundle.owner}-drift`;
  const drifted = `${JSON.stringify(bundle, null, 2)}\n`;
  fs.writeFileSync(bundlePath, drifted);
  fs.writeFileSync(path.join(contracts, 'product-authorization/product-surfaces-v1.json'), drifted);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /checksum does not match canonical content/);
});

test('rejects a rollout inventory whose checksum is no longer bound to its product set', () => {
  const contracts = createOfficialContracts();
  const inventoryPath = path.join(
    contracts,
    'product-authorization/product-surface-rollout-inventory.v1.generated.json'
  );
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  inventory.checksum = 'a'.repeat(64);
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /rollout inventory checksum is invalid/);
});

test('rejects a non-DRAFT bundle before external activation approval', () => {
  const contracts = createOfficialContracts();
  const bundlePath = path.join(
    contracts,
    'product-authorization/product-surfaces-v1.bundle-v2.json'
  );
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  bundle.bundleStatus = 'ACTIVE';
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must remain DRAFT until external activation approval/);
});

test('rejects a stale future immutable bundle even when v1-v5 remain valid', () => {
  const contracts = createOfficialContracts();
  fs.copyFileSync(
    path.join(contracts, 'product-authorization/product-surfaces-v1.bundle-v5.json'),
    path.join(contracts, 'product-authorization/product-surfaces-v1.bundle-v6.json')
  );
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exactly immutable bundle v1-v5/);
});

test('fixture sync independently rejects a re-signed historical authorization bundle', () => {
  const contracts = createOfficialContracts();
  const authorizationDirectory = path.join(contracts, 'product-authorization');
  const fixturePath = path.join(authorizationDirectory, 'pilot-fixtures.v1.generated.json');
  const bundlePath = path.join(authorizationDirectory, 'product-surfaces-v1.bundle-v4.json');
  const indexPath = path.join(authorizationDirectory, 'product-surfaces-v1.index.json');
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  bundle.owner = `${bundle.owner}-re-signed`;
  const checksumInput = structuredClone(bundle);
  delete checksumInput.checksum;
  delete checksumInput.bundleStatus;
  bundle.checksum = sha256(checksumInput);
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  index.versions.find(({ version }) => version === 4).checksum = bundle.checksum;
  const indexChecksumInput = structuredClone(index);
  delete indexChecksumInput.indexChecksum;
  index.indexChecksum = sha256(indexChecksumInput);
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);

  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  fixture.registryLineage.indexSha256 = index.indexChecksum;
  fixture.registryLineage.versions.find(({ version }) => version === 4).sha256 = bundle.checksum;
  for (const testCase of fixture.testCases) {
    if (testCase.requiredRegistryRef.version === 4) {
      testCase.requiredRegistryRef.sha256 = bundle.checksum;
    }
  }
  for (const challenge of fixture.catalogs.stepUpChallenges) {
    if (challenge.requiredRegistryRef.version === 4) {
      challenge.requiredRegistryRef.sha256 = bundle.checksum;
    }
  }
  writeFixture(fixturePath, fixture);

  const result = runFixtureCheck(fixturePath, authorizationDirectory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /preserved v4 checksum changed/);
});

test('rejects an active pointer field even when its index checksum is recomputed', () => {
  const contracts = createOfficialContracts();
  const indexPath = path.join(contracts, 'product-authorization/product-surfaces-v1.index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  index.activeVersion = 2;
  const checksumInput = structuredClone(index);
  delete checksumInput.indexChecksum;
  index.indexChecksum = sha256(checksumInput);
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown field or active pointer/);
});

test('rejects fixture lineage checksums that are not bound to the authorization bundles', () => {
  const contracts = createOfficialContracts();
  const fixturePath = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const forgedChecksum = 'a'.repeat(64);
  fixture.registryLineage.versions.find(({ version }) => version === 2).sha256 = forgedChecksum;
  for (const testCase of fixture.testCases) {
    if (testCase.requiredRegistryRef.version === 2)
      testCase.requiredRegistryRef.sha256 = forgedChecksum;
  }
  for (const challenge of fixture.catalogs.stepUpChallenges) {
    if (challenge.requiredRegistryRef.version === 2) {
      challenge.requiredRegistryRef.sha256 = forgedChecksum;
    }
  }
  writeFixture(fixturePath, fixture);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /registryLineage v2 differs from the authorization bundle/);
});

test('rejects a step-up challenge whose audience differs from its ACTION binding', () => {
  const contracts = createOfficialContracts();
  const fixturePath = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  fixture.catalogs.stepUpChallenges[0].audience = 'dwp-people-server';
  writeFixture(fixturePath, fixture);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /metadata differs from its step-up command binding/);
});

test('rejects replacing a canonical step-up challenge context', () => {
  const contracts = createOfficialContracts();
  const fixturePath = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  fixture.catalogs.stepUpChallenges[0].contextKey = 'hcm-management';
  writeFixture(fixturePath, fixture);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /context, scope, or risk policy is outside the canonical fixture/);
});

test('rejects a self-selected fixture verification key', () => {
  const contracts = createOfficialContracts();
  const fixturePath = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  fixture.stepUpVerification.publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  writeFixture(fixturePath, fixture);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /differs from the immutable fixture key contract/);
});

test('rejects a canonical-looking step-up token with an invalid signature', () => {
  const contracts = createOfficialContracts();
  const fixturePath = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const challenge = fixture.catalogs.stepUpChallenges[0];
  const parts = challenge.compactToken.split('.');
  parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
  challenge.compactToken = parts.join('.');
  writeFixture(fixturePath, fixture);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /compactToken signature is invalid/);
});

test('rejects leaking a header-bound expected version into a challenge payload', () => {
  const contracts = createOfficialContracts();
  const fixturePath = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const challenge = fixture.catalogs.stepUpChallenges.find(
    ({ key }) => key === 'STEPUP_HIGH_RECOVERY_1'
  );
  challenge.payload[challenge.expectedObjectVersionName] = challenge.targetVersion;
  writeFixture(fixturePath, fixture);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /command-header payload leaks an object version/);
});

test('rejects a challenge that declares both target identity source fields', () => {
  const contracts = createOfficialContracts();
  const fixturePath = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  fixture.catalogs.stepUpChallenges[0].targetIdBodyFields = ['targetId'];
  writeFixture(fixturePath, fixture);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /step-up challenge field set is not exact/);
});

test('rejects delimiter-colliding values in a command-body target identity', () => {
  const contracts = createOfficialContracts();
  const fixturePath = path.join(
    contracts,
    'product-authorization/pilot-fixtures.v1.generated.json'
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const challenge = fixture.catalogs.stepUpChallenges.find(
    ({ key }) => key === 'STEPUP_CRITICAL_FRESH_1'
  );
  challenge.payload.dataset = 'DS:HCM:CORE';
  challenge.targetId = `${challenge.payload.dataset}:${challenge.payload.population}`;
  writeFixture(fixturePath, fixture);
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /targetId differs from its step-up command body binding/);
});

test('rejects non-canonical bytes in an authorization registry artifact', () => {
  const contracts = createOfficialContracts();
  fs.appendFileSync(
    path.join(contracts, 'product-authorization/product-surfaces-v1.index.json'),
    '\n'
  );
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /registry index serialization is not byte-canonical/);
});

test('rejects byte drift in the Gateway OpenAPI snapshot', () => {
  const contracts = createOfficialContracts();
  fs.appendFileSync(path.join(contracts, 'openapi/gateway-public.json'), '\n');
  const result = run(['--backend-contracts', contracts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Gateway OpenAPI snapshot is not byte-identical/);
});
