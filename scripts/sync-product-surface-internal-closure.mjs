#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const snapshotPath = path.join(
  root,
  'architecture/product-surface-internal-closure.v1.generated.json'
);
const authorizationSnapshotPath = path.join(
  root,
  'architecture/product-surface-authorization.v1.json'
);
const MATRIX_FILE = 'authorization-negative-matrix.v1.json';
const BUNDLE_FILE = 'product-surfaces-v1.bundle-v4.json';
const INVENTORY_FILE = 'product-surface-rollout-inventory.v1.generated.json';
const AGENT_ATTESTATION_FILE = 'dwaion-agent-pep-attestation.v1.json';
const BACKEND_REPOSITORY = 'https://github.com/choijoonbin/dwp-backend';
const ROUTE_KINDS = ['PAGE', 'DATA', 'ACTION'];
const SHA_256 = /^[a-f0-9]{64}$/u;

function fail(message) {
  throw new Error(`Product surface internal closure error: ${message}`);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function validateExactFields(value, fields, label) {
  const actual = Object.keys(requireRecord(value, label)).sort();
  const expected = [...fields].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${label} field set is not exact`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function readJson(filePath, label = filePath) {
  if (!fs.existsSync(filePath)) fail(`${label} is missing: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sameArray(actual, expected) {
  return Array.isArray(actual) && canonicalJson(actual) === canonicalJson(expected);
}

function bundleChecksum(bundle) {
  const payload = structuredClone(bundle);
  delete payload.checksum;
  delete payload.bundleStatus;
  return sha256(payload);
}

function validateInventory(value) {
  const inventory = requireRecord(value, 'rollout inventory');
  if (
    inventory.schemaVersion !== 1 ||
    inventory.inventoryKey !== 'product-surface-rollout-products.v1' ||
    inventory.checksumAlgorithm !== 'SHA-256' ||
    !SHA_256.test(inventory.checksum)
  ) {
    fail('rollout inventory identity or checksum metadata is invalid');
  }
  const products = requireArray(inventory.products, 'rollout inventory products').map(
    (product, index) => requireString(product, `rollout inventory products[${index}]`)
  );
  if (new Set(products).size !== products.length) fail('rollout inventory products are duplicated');
  const payload = structuredClone(inventory);
  delete payload.checksum;
  if (sha256(payload) !== inventory.checksum) fail('rollout inventory checksum is invalid');
  return { inventory, products };
}

function validateBundle(value, expectedProducts) {
  const bundle = requireRecord(value, 'v4 authorization bundle');
  if (
    bundle.schemaVersion !== 1 ||
    bundle.bundleKey !== 'product-surfaces' ||
    bundle.version !== 4 ||
    bundle.bundleStatus !== 'DRAFT' ||
    bundle.checksumAlgorithm !== 'SHA-256' ||
    !SHA_256.test(bundle.checksum) ||
    bundleChecksum(bundle) !== bundle.checksum
  ) {
    fail('v4 authorization bundle identity or checksum is invalid');
  }
  const routeKindsByProduct = new Map(expectedProducts.map((productId) => [productId, new Set()]));
  for (const route of requireArray(bundle.routes, 'v4 authorization routes')) {
    const subject = requireRecord(route?.subject, `${route?.routeContractKey ?? 'route'}.subject`);
    if (subject.type !== 'PRODUCT') continue;
    if (!routeKindsByProduct.has(subject.productKey)) {
      fail(`v4 authorization bundle contains an unknown product ${String(subject.productKey)}`);
    }
    if (!ROUTE_KINDS.includes(route.routeKind)) {
      fail(`${route.routeContractKey} has an invalid route kind`);
    }
    routeKindsByProduct.get(subject.productKey).add(route.routeKind);
  }
  return {
    bundle,
    routeKindsByProduct: new Map(
      [...routeKindsByProduct].map(([productId, routeKinds]) => [
        productId,
        ROUTE_KINDS.filter((routeKind) => routeKinds.has(routeKind)),
      ])
    ),
  };
}

function contractStatus(routeKinds) {
  if (routeKinds.length === 0) return 'MISSING';
  return sameArray(routeKinds, ROUTE_KINDS) ? 'EXACT' : 'INCOMPLETE_KINDS';
}

function normalizeMatrixProjection(matrix, productIds, attackVectors) {
  const productsById = new Map(
    requireArray(matrix.products, 'negative matrix products').map((product) => [
      product?.productId,
      product,
    ])
  );
  return {
    schemaVersion: matrix.schemaVersion,
    matrixId: matrix.matrixId,
    completionState: matrix.completionState,
    rolloutInventory: matrix.rolloutInventory,
    exactContract: matrix.exactContract,
    attackVectors,
    products: productIds.map((productId) => {
      const product = requireRecord(productsById.get(productId), `negative matrix ${productId}`);
      const attackEvidence = requireRecord(
        product.attackEvidence,
        `negative matrix ${productId}.attackEvidence`
      );
      const unknownAttackIds = Object.keys(attackEvidence).filter(
        (attackId) => !attackVectors.includes(attackId)
      );
      if (unknownAttackIds.length > 0) {
        fail(`${productId} declares unknown attack evidence ${unknownAttackIds.join(', ')}`);
      }
      return {
        productId,
        contractStatus: product.contractStatus,
        ownerService: product.ownerService,
        attackEvidence: Object.fromEntries(
          attackVectors.map((attackId) => {
            const references = requireArray(
              attackEvidence[attackId] ?? [],
              `${productId}.${attackId}`
            ).map((reference, index) =>
              requireString(reference, `${productId}.${attackId}[${index}]`)
            );
            if (new Set(references).size !== references.length) {
              fail(`${productId}.${attackId} evidence references are duplicated`);
            }
            return [attackId, references];
          })
        ),
        missingAttackIds: product.missingAttackIds,
        blocker: product.blocker,
      };
    }),
  };
}

function validateAgentEvidence(value) {
  const attestation = requireRecord(value, 'DWAI Agent PEP attestation');
  const payload = structuredClone(attestation);
  delete payload.checksum;
  if (
    attestation.schemaVersion !== 1 ||
    attestation.attestationId !== 'dwaion-agent-owner-pep.v1' ||
    attestation.repository !== 'https://github.com/choijoonbin/aura_agent' ||
    !/^[a-f0-9]{40}$/u.test(attestation.revision ?? '') ||
    !SHA_256.test(attestation.checksum ?? '') ||
    sha256(payload) !== attestation.checksum
  ) {
    fail('DWAI Agent PEP attestation identity, revision or checksum is invalid');
  }
  const sourceCiRun = requireRecord(attestation.sourceCiRun, 'DWAI Agent source CI run');
  const runId = requireString(sourceCiRun.runId, 'DWAI Agent source CI run ID');
  if (
    sourceCiRun.provider !== 'GITHUB_ACTIONS' ||
    sourceCiRun.workflow !== 'Agent quality' ||
    sourceCiRun.url !== `${attestation.repository}/actions/runs/${runId}` ||
    sourceCiRun.headSha !== attestation.revision ||
    sourceCiRun.conclusion !== 'success'
  ) {
    fail('DWAI Agent PEP attestation is not bound to its immutable successful CI run');
  }
  return {
    artifact: AGENT_ATTESTATION_FILE,
    repository: attestation.repository,
    revision: attestation.revision,
    checksum: attestation.checksum,
    artifactChecksum: sha256(attestation),
    sourceCiRun: {
      provider: sourceCiRun.provider,
      workflow: sourceCiRun.workflow,
      runId,
      url: sourceCiRun.url,
      headSha: sourceCiRun.headSha,
      conclusion: sourceCiRun.conclusion,
    },
  };
}

function buildSnapshot(
  authorizationBundle,
  inventoryValue,
  matrixValue,
  agentAttestationValue,
  sourceBindings = {}
) {
  const { inventory, products: productIds } = validateInventory(inventoryValue);
  const { bundle, routeKindsByProduct } = validateBundle(authorizationBundle, productIds);
  const matrix = requireRecord(matrixValue, 'authorization negative matrix');
  const agentEvidence =
    sourceBindings.agentEvidence ?? validateAgentEvidence(agentAttestationValue);
  const matrixArtifactChecksum = sourceBindings.matrixArtifactChecksum ?? sha256(matrix);
  const backend = requireRecord(sourceBindings.backend, 'official backend source');
  if (
    matrix.schemaVersion !== 1 ||
    matrix.matrixId !== 'product-authorization-negative-matrix.v1'
  ) {
    fail('authorization negative matrix identity is invalid');
  }
  if (!['PARTIAL', 'COMPLETE'].includes(matrix.completionState)) {
    fail('authorization negative matrix completionState is invalid');
  }
  if (
    matrix.exactContract?.reference !== `contracts/product-authorization/${BUNDLE_FILE}` ||
    matrix.exactContract?.checksum !== bundle.checksum ||
    !sameArray([...(matrix.exactContract?.products ?? [])].sort(), [...productIds].sort())
  ) {
    fail('authorization negative matrix is not bound to the v4 bundle and rollout inventory');
  }
  if (
    matrix.rolloutInventory?.reference !== `contracts/product-authorization/${INVENTORY_FILE}` ||
    matrix.rolloutInventory?.checksum !== inventory.checksum
  ) {
    fail('authorization negative matrix rollout inventory binding is invalid');
  }
  const attackVectors = requireArray(matrix.attackVectors, 'negative matrix attackVectors').map(
    (vector, index) => requireString(vector?.id, `negative matrix attackVectors[${index}].id`)
  );
  if (attackVectors.length !== 5 || new Set(attackVectors).size !== attackVectors.length) {
    fail('authorization negative matrix must declare five unique attack vectors');
  }
  const matrixProducts = requireArray(matrix.products, 'negative matrix products');
  if (
    matrixProducts.length !== productIds.length ||
    !sameArray(matrixProducts.map((product) => product?.productId).sort(), [...productIds].sort())
  ) {
    fail('authorization negative matrix product inventory is not exact');
  }

  const matrixProjection = normalizeMatrixProjection(matrix, productIds, attackVectors);
  const projectedProducts = matrixProjection.products.map((product) => {
    const routeKinds = routeKindsByProduct.get(product.productId);
    const expectedContractStatus = contractStatus(routeKinds);
    if (product.contractStatus !== expectedContractStatus) {
      fail(`${product.productId} matrix contract status differs from the v4 route kinds`);
    }
    const qualifiedAttackIds = attackVectors.filter(
      (attackId) => product.attackEvidence[attackId].length > 0
    );
    const expectedMissing = attackVectors.filter(
      (attackId) => !qualifiedAttackIds.includes(attackId)
    );
    if (!sameArray(product.missingAttackIds, expectedMissing)) {
      fail(`${product.productId} missing attack vector declaration is not calculated`);
    }
    const internallyClosed =
      expectedContractStatus === 'EXACT' &&
      expectedMissing.length === 0 &&
      product.blocker === null;
    if ((internallyClosed && product.blocker !== null) || (!internallyClosed && !product.blocker)) {
      fail(`${product.productId} matrix blocker does not match its calculated closure`);
    }
    return {
      productId: product.productId,
      contractStatus: expectedContractStatus,
      routeKinds,
      ownerService: requireString(product.ownerService, `${product.productId}.ownerService`),
      attackEvidence: product.attackEvidence,
      qualifiedAttackIds,
      missingAttackIds: expectedMissing,
      blocker: product.blocker,
    };
  });

  const exactProducts = projectedProducts.filter(
    (product) => product.contractStatus === 'EXACT'
  ).length;
  const qualifiedAttackCells = projectedProducts.reduce(
    (total, product) => total + product.qualifiedAttackIds.length,
    0
  );
  const totalAttackCells = productIds.length * attackVectors.length;
  const productBlockers = projectedProducts.filter((product) => product.blocker !== null).length;
  const internallyClosedProducts = projectedProducts.filter(
    (product) =>
      product.contractStatus === 'EXACT' &&
      product.missingAttackIds.length === 0 &&
      product.blocker === null
  ).length;
  const completionState =
    exactProducts === productIds.length &&
    qualifiedAttackCells === totalAttackCells &&
    productBlockers === 0
      ? 'COMPLETE'
      : 'PARTIAL';
  if (matrix.completionState !== completionState) {
    fail(`authorization negative matrix completionState must be ${completionState}`);
  }

  return {
    schemaVersion: 1,
    closureKey: 'product-surface-internal-closure.v1',
    generatedFrom: {
      backend,
      authorizationBundle: {
        artifact: BUNDLE_FILE,
        version: 4,
        checksum: bundle.checksum,
      },
      negativeMatrix: {
        artifact: MATRIX_FILE,
        matrixId: matrix.matrixId,
        artifactChecksum: matrixArtifactChecksum,
        projectionChecksum: sha256(matrixProjection),
      },
      rolloutInventory: {
        artifact: INVENTORY_FILE,
        checksum: inventory.checksum,
      },
      agentEvidence,
    },
    attackVectors,
    products: projectedProducts,
    summary: {
      productCount: productIds.length,
      exactProducts,
      internallyClosedProducts,
      totalAttackCells,
      qualifiedAttackCells,
      missingAttackCells: totalAttackCells - qualifiedAttackCells,
      productBlockers,
      completionState,
    },
  };
}

function validateSnapshot(value, authorizationSnapshot) {
  validateExactFields(
    value,
    ['schemaVersion', 'closureKey', 'generatedFrom', 'attackVectors', 'products', 'summary'],
    'internal closure snapshot'
  );
  if (value.schemaVersion !== 1 || value.closureKey !== 'product-surface-internal-closure.v1') {
    fail('internal closure snapshot identity is invalid');
  }
  validateExactFields(
    value.generatedFrom,
    ['backend', 'authorizationBundle', 'negativeMatrix', 'rolloutInventory', 'agentEvidence'],
    'internal closure generatedFrom'
  );
  validateExactFields(
    value.generatedFrom.backend,
    ['repository', 'revision'],
    'internal closure backend source'
  );
  if (
    value.generatedFrom.backend.repository !== BACKEND_REPOSITORY ||
    !/^[a-f0-9]{40}$/u.test(value.generatedFrom.backend.revision ?? '')
  ) {
    fail('internal closure backend source is not an immutable trusted revision');
  }
  validateExactFields(
    value.generatedFrom.authorizationBundle,
    ['artifact', 'version', 'checksum'],
    'internal closure authorizationBundle'
  );
  validateExactFields(
    value.generatedFrom.negativeMatrix,
    ['artifact', 'matrixId', 'artifactChecksum', 'projectionChecksum'],
    'internal closure negativeMatrix'
  );
  validateExactFields(
    value.generatedFrom.rolloutInventory,
    ['artifact', 'checksum'],
    'internal closure rolloutInventory'
  );
  validateExactFields(
    value.generatedFrom.agentEvidence,
    ['artifact', 'repository', 'revision', 'checksum', 'artifactChecksum', 'sourceCiRun'],
    'internal closure Agent evidence'
  );
  validateExactFields(
    value.generatedFrom.agentEvidence.sourceCiRun,
    ['provider', 'workflow', 'runId', 'url', 'headSha', 'conclusion'],
    'internal closure Agent source CI run'
  );
  if (
    !SHA_256.test(value.generatedFrom.negativeMatrix.artifactChecksum ?? '') ||
    !SHA_256.test(value.generatedFrom.negativeMatrix.projectionChecksum ?? '') ||
    !SHA_256.test(value.generatedFrom.agentEvidence.checksum ?? '') ||
    !SHA_256.test(value.generatedFrom.agentEvidence.artifactChecksum ?? '') ||
    !/^[a-f0-9]{40}$/u.test(value.generatedFrom.agentEvidence.revision ?? '')
  ) {
    fail('internal closure matrix or Agent evidence digest is invalid');
  }
  const agentEvidence = value.generatedFrom.agentEvidence;
  const agentRun = agentEvidence.sourceCiRun;
  if (
    agentEvidence.artifact !== AGENT_ATTESTATION_FILE ||
    agentEvidence.repository !== 'https://github.com/choijoonbin/aura_agent' ||
    agentRun.provider !== 'GITHUB_ACTIONS' ||
    agentRun.workflow !== 'Agent quality' ||
    agentRun.url !== `${agentEvidence.repository}/actions/runs/${agentRun.runId}` ||
    agentRun.headSha !== agentEvidence.revision ||
    agentRun.conclusion !== 'success'
  ) {
    fail('internal closure Agent evidence provenance is invalid');
  }
  const authorization = requireRecord(authorizationSnapshot, 'frontend authorization snapshot');
  const authorizationBundles = requireArray(
    authorization.bundles,
    'frontend authorization bundles'
  );
  const closureReference = value.generatedFrom.authorizationBundle;
  const closureBundles = authorizationBundles.filter(
    (bundle) => bundle?.version === closureReference.version
  );
  const indexEntries = requireArray(
    authorization.index?.versions,
    'frontend authorization index versions'
  ).filter((entry) => entry?.version === closureReference.version);
  const closureBundle = closureBundles.length === 1 ? closureBundles[0] : undefined;
  const indexEntry = indexEntries.length === 1 ? indexEntries[0] : undefined;
  const inventory = requireRecord(authorization.rolloutInventory, 'frontend rollout inventory');
  if (
    closureReference.artifact !== BUNDLE_FILE ||
    closureReference.version !== 4 ||
    !closureBundle ||
    !indexEntry ||
    indexEntry.artifact !== closureReference.artifact ||
    indexEntry.checksum !== closureReference.checksum ||
    closureBundle.checksum !== closureReference.checksum ||
    value.generatedFrom.rolloutInventory.artifact !== INVENTORY_FILE ||
    value.generatedFrom.rolloutInventory.checksum !== inventory.checksum
  ) {
    fail('internal closure snapshot is outside or differs from its immutable authorization bundle');
  }
  const expected = buildSnapshot(
    closureBundle,
    inventory,
    {
      schemaVersion: 1,
      matrixId: value.generatedFrom.negativeMatrix.matrixId,
      completionState: value.summary?.completionState,
      rolloutInventory: {
        reference: `contracts/product-authorization/${INVENTORY_FILE}`,
        checksum: inventory.checksum,
      },
      exactContract: {
        reference: `contracts/product-authorization/${BUNDLE_FILE}`,
        checksum: closureBundle.checksum,
        products: inventory.products,
      },
      attackVectors: value.attackVectors?.map((id) => ({ id })),
      products: value.products,
    },
    undefined,
    {
      agentEvidence: value.generatedFrom.agentEvidence,
      matrixArtifactChecksum: value.generatedFrom.negativeMatrix.artifactChecksum,
      backend: value.generatedFrom.backend,
    }
  );
  if (
    value.generatedFrom.negativeMatrix.projectionChecksum !==
    expected.generatedFrom.negativeMatrix.projectionChecksum
  ) {
    fail('internal closure matrix projection checksum does not match its projected evidence');
  }
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail('internal closure snapshot contains stale or non-calculated values');
  }
  return value;
}

function parseArguments(argv) {
  const mode = argv.shift();
  if (!['--sync', '--check'].includes(mode)) return usage();
  let officialDirectory;
  if (argv[0] && !argv[0].startsWith('--')) officialDirectory = path.resolve(argv.shift());
  officialDirectory ??= process.env.DWP_PRODUCT_AUTHORIZATION_DIR
    ? path.resolve(process.env.DWP_PRODUCT_AUTHORIZATION_DIR)
    : undefined;
  const options = {};
  while (argv.length > 0) {
    const option = argv.shift();
    const key = {
      '--backend-checkout': 'backendCheckout',
      '--source-revision': 'sourceRevision',
    }[option];
    const value = argv.shift();
    if (!key || !value || value.startsWith('--') || options[key]) return usage();
    options[key] = value;
  }
  const backendCheckout = path.resolve(
    options.backendCheckout ?? process.env.DWP_BACKEND_CHECKOUT ?? ''
  );
  const sourceRevision = options.sourceRevision ?? process.env.DWP_BACKEND_REVISION;
  if (mode === '--sync' && !officialDirectory) return usage();
  if (officialDirectory && !options.backendCheckout && !process.env.DWP_BACKEND_CHECKOUT) {
    return usage();
  }
  if (officialDirectory && !sourceRevision) return usage();
  return {
    mode: mode.slice(2),
    artifactDirectory: mode === '--sync' ? officialDirectory : undefined,
    officialDirectory: mode === '--check' ? officialDirectory : undefined,
    backendCheckout: officialDirectory ? backendCheckout : undefined,
    sourceRevision,
  };
}

function usage() {
  console.error(
    'Usage: node scripts/sync-product-surface-internal-closure.mjs ' +
      '--sync <official backend authorization directory> --backend-checkout <path> ' +
      '--source-revision <40-hex-sha> | --check [official backend authorization directory ' +
      '--backend-checkout <path> --source-revision <40-hex-sha>]'
  );
  process.exit(2);
}

function validateBackendSource(artifactDirectory, backendCheckout, sourceRevision) {
  if (!/^[a-f0-9]{40}$/u.test(sourceRevision ?? '')) {
    fail('official backend source revision must be a full lowercase commit SHA');
  }
  if (!fs.statSync(backendCheckout, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`official backend checkout is missing: ${backendCheckout}`);
  }
  const origin = execFileSync('git', ['-C', backendCheckout, 'remote', 'get-url', 'origin'], {
    encoding: 'utf8',
  }).trim();
  if (![BACKEND_REPOSITORY, `${BACKEND_REPOSITORY}.git`].includes(origin)) {
    fail('official backend checkout origin is not trusted');
  }
  const actualRevision = execFileSync('git', ['-C', backendCheckout, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  if (actualRevision !== sourceRevision) {
    fail('official backend checkout HEAD differs from the declared source revision');
  }
  const dirtyArtifacts = execFileSync(
    'git',
    [
      '-C',
      backendCheckout,
      'status',
      '--porcelain',
      '--untracked-files=all',
      '--',
      'contracts/product-authorization',
    ],
    { encoding: 'utf8' }
  ).trim();
  if (dirtyArtifacts) {
    fail('official backend authorization artifacts differ from the declared source revision');
  }
  const expectedDirectory = fs.realpathSync(
    path.join(backendCheckout, 'contracts/product-authorization')
  );
  if (fs.realpathSync(artifactDirectory) !== expectedDirectory) {
    fail('official authorization directory is not owned by the trusted backend checkout');
  }
  return { repository: BACKEND_REPOSITORY, revision: sourceRevision };
}

function readOfficialSnapshot(artifactDirectory, backendCheckout, sourceRevision) {
  if (!fs.statSync(artifactDirectory, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`official authorization directory is missing: ${artifactDirectory}`);
  }
  const backend = validateBackendSource(artifactDirectory, backendCheckout, sourceRevision);
  const readOfficialJson = (fileName, label, requireCanonicalBytes = true) => {
    const filePath = path.join(artifactDirectory, fileName);
    const value = readJson(filePath, label);
    const canonicalBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    if (requireCanonicalBytes && !fs.readFileSync(filePath).equals(canonicalBytes)) {
      fail(`official ${label} serialization is not byte-canonical: ${filePath}`);
    }
    return value;
  };
  return buildSnapshot(
    readOfficialJson(BUNDLE_FILE, 'v4 authorization bundle'),
    readOfficialJson(INVENTORY_FILE, 'rollout inventory'),
    readOfficialJson(MATRIX_FILE, 'authorization negative matrix', false),
    readOfficialJson(AGENT_ATTESTATION_FILE, 'DWAI Agent PEP attestation'),
    { backend }
  );
}

function writeOrCheck(snapshot, mode) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (mode === 'sync') {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, serialized, 'utf8');
    return;
  }
  if (!fs.existsSync(snapshotPath)) fail(`internal closure snapshot is missing: ${snapshotPath}`);
  if (fs.readFileSync(snapshotPath, 'utf8') !== serialized) {
    fail('internal closure snapshot is stale; synchronize official backend closure artifacts');
  }
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const authorizationSnapshot = readJson(
    authorizationSnapshotPath,
    'frontend authorization snapshot'
  );
  if (args.mode === 'sync') {
    const snapshot = readOfficialSnapshot(
      args.artifactDirectory,
      args.backendCheckout,
      args.sourceRevision
    );
    validateSnapshot(snapshot, authorizationSnapshot);
    writeOrCheck(snapshot, 'sync');
    console.log(
      `PASS synchronized internal closure ${snapshot.summary.internallyClosedProducts}/${snapshot.summary.productCount} products, ` +
        `${snapshot.summary.qualifiedAttackCells}/${snapshot.summary.totalAttackCells} PEP cells (${snapshot.summary.completionState}).`
    );
    return;
  }
  const snapshot = readJson(snapshotPath, 'internal closure snapshot');
  validateSnapshot(snapshot, authorizationSnapshot);
  if (args.officialDirectory) {
    const official = readOfficialSnapshot(
      args.officialDirectory,
      args.backendCheckout,
      args.sourceRevision
    );
    if (canonicalJson(snapshot) !== canonicalJson(official)) {
      fail('frontend internal closure snapshot differs from official backend artifacts');
    }
  }
  writeOrCheck(snapshot, 'check');
  console.log(
    `PASS internal closure ${snapshot.summary.internallyClosedProducts}/${snapshot.summary.productCount} products, ` +
      `${snapshot.summary.qualifiedAttackCells}/${snapshot.summary.totalAttackCells} PEP cells (${snapshot.summary.completionState})` +
      `${args.officialDirectory ? '; official backend artifacts matched.' : '.'}`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
