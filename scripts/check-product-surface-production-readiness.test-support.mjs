import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checker = resolve(root, 'scripts/check-product-surface-production-readiness.mjs');
const temporaryDirectories = [];
const attackVectorIds = [
  'CROSS_TENANT',
  'SCOPE_ESCAPE',
  'STALE_AUTHORITY_REVISION',
  'CONFUSED_DEPUTY',
  'INTERNAL_HEADER_SPOOF',
];

export function cleanupReadinessFixtures() {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function createReadinessFixtureDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'dwp-product-surface-readiness-'));
  temporaryDirectories.push(directory);
  return directory;
}

export function run(value, arguments_ = [], environment = {}) {
  writeFileSync(value.path, `${JSON.stringify(value.manifest, null, 2)}\n`);
  writeFileSync(value.closurePath, `${JSON.stringify(value.closure, null, 2)}\n`);
  writeFileSync(value.authorizationPath, `${JSON.stringify(value.authorization, null, 2)}\n`);
  writeFileSync(value.trustPolicyPath, `${JSON.stringify(value.trustPolicy, null, 2)}\n`);
  const evidenceArguments = [];
  if (value.evidenceCheckout) {
    evidenceArguments.push('--evidence-checkout', value.evidenceCheckout);
  }
  if (value.evidenceRevision) {
    evidenceArguments.push('--evidence-revision', value.evidenceRevision);
  }
  return spawnSync(
    process.execPath,
    [
      checker,
      '--manifest',
      value.path,
      '--closure',
      value.closurePath,
      '--authorization',
      value.authorizationPath,
      '--trust-policy',
      value.trustPolicyPath,
      '--root',
      root,
      ...evidenceArguments,
      ...arguments_,
    ],
    { cwd: root, encoding: 'utf8', env: { ...process.env, ...environment } }
  );
}

function canonicalChecksum(value) {
  const canonicalize = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(canonicalize);
    if (!candidate || typeof candidate !== 'object') return candidate;
    return Object.fromEntries(
      Object.keys(candidate)
        .sort()
        .map((key) => [key, canonicalize(candidate[key])])
    );
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function recalculateClosure(value) {
  const closure = value.closure;
  const exactProducts = closure.products.filter(
    ({ contractStatus }) => contractStatus === 'EXACT'
  ).length;
  const qualifiedAttackCells = closure.products.reduce(
    (total, product) => total + product.qualifiedAttackIds.length,
    0
  );
  const productBlockers = closure.products.filter(({ blocker }) => blocker !== null).length;
  const internallyClosedProducts = closure.products.filter(
    (product) =>
      product.contractStatus === 'EXACT' &&
      product.missingAttackIds.length === 0 &&
      product.blocker === null
  ).length;
  const totalAttackCells = closure.products.length * closure.attackVectors.length;
  const completionState =
    exactProducts === closure.products.length &&
    qualifiedAttackCells === totalAttackCells &&
    productBlockers === 0
      ? 'COMPLETE'
      : 'PARTIAL';
  closure.summary = {
    productCount: closure.products.length,
    exactProducts,
    internallyClosedProducts,
    totalAttackCells,
    qualifiedAttackCells,
    missingAttackCells: totalAttackCells - qualifiedAttackCells,
    productBlockers,
    completionState,
  };
  const projection = {
    schemaVersion: 1,
    matrixId: closure.generatedFrom.negativeMatrix.matrixId,
    completionState,
    rolloutInventory: {
      reference:
        'contracts/product-authorization/product-surface-rollout-inventory.v1.generated.json',
      checksum: closure.generatedFrom.rolloutInventory.checksum,
    },
    exactContract: {
      reference: `contracts/product-authorization/${closure.generatedFrom.authorizationBundle.artifact}`,
      checksum: closure.generatedFrom.authorizationBundle.checksum,
      products: closure.products.map(({ productId }) => productId),
    },
    attackVectors: closure.attackVectors,
    products: closure.products.map((product) => ({
      productId: product.productId,
      contractStatus: product.contractStatus,
      ownerService: product.ownerService,
      attackEvidence: product.attackEvidence,
      missingAttackIds: product.missingAttackIds,
      blocker: product.blocker,
    })),
  };
  closure.generatedFrom.negativeMatrix.projectionChecksum = canonicalChecksum(projection);
}

export function makeInternalClosureComplete(value) {
  for (const product of value.closure.products) {
    for (const attackId of attackVectorIds) {
      if (product.attackEvidence[attackId].length === 0) {
        product.attackEvidence[attackId] = [
          `tests/test_product_surface_pep.py#test_${product.productId}_${attackId.toLowerCase()}`,
        ];
      }
    }
    product.qualifiedAttackIds = [...attackVectorIds];
    product.missingAttackIds = [];
    product.blocker = null;
  }
  recalculateClosure(value);
}

export function makeInternalClosurePartial(value) {
  const product = value.closure.products.find(({ productId }) => productId === 'dwaion');
  product.attackEvidence = Object.fromEntries(attackVectorIds.map((attackId) => [attackId, []]));
  product.qualifiedAttackIds = [];
  product.missingAttackIds = [...attackVectorIds];
  product.blocker = 'MISSING_DWAION_AGENT_RUNTIME_PEP_MATRIX';
  recalculateClosure(value);
}

export function makeManifestInternalPending(value) {
  for (const product of value.manifest.products) {
    product.state = 'PENDING_INTERNAL';
    product.blockers = ['INTERNAL_TEST_CLOSURE_PENDING'];
  }
  for (const id of ['X-01', 'X-03']) {
    const item = value.manifest.exitCriteria.find((candidate) => candidate.id === id);
    item.state = 'PENDING_INTERNAL';
    item.blockers = ['INTERNAL_TEST_CLOSURE_PENDING'];
  }
}
