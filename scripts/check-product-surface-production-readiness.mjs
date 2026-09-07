#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';

import { getAuthorizationClosureReleaseBlocker } from './product-surface-readiness-authorization.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arguments_ = parseArguments(process.argv.slice(2));
const root = resolve(arguments_.root ?? repositoryRoot);
const manifestPath = resolve(
  arguments_.manifest ??
    resolve(root, 'docs/06-delivery/release-evidence/product-surface-production-readiness.json')
);
const schemaPath = resolve(
  arguments_.schema ??
    resolve(root, 'architecture/product-surface-production-readiness.schema.json')
);
const internalClosurePath = resolve(
  arguments_.closure ??
    resolve(root, 'architecture/product-surface-internal-closure.v1.generated.json')
);
const releaseTrustPolicyPath = resolve(
  arguments_.trustPolicy ??
    resolve(root, 'architecture/product-surface-release-trust-policy.v1.json')
);
const authorizationSnapshotPath = resolve(
  arguments_.authorization ?? resolve(root, 'architecture/product-surface-authorization.v1.json')
);
const trustedEvidenceCheckout = resolve(
  arguments_.evidenceCheckout ?? process.env.DWP_BACKEND_CHECKOUT ?? resolve(root, '../dwp-backend')
);
const trustedEvidenceRevision =
  arguments_.evidenceRevision ?? process.env.DWP_BACKEND_REVISION ?? null;
const TRUSTED_EVIDENCE_REPOSITORY = 'choijoonbin/dwp-backend';
const TRUSTED_EVIDENCE_ISSUER = 'dwp-release-attestor';
const TRUSTED_EVIDENCE_URL = new RegExp(
  `^https://github\\.com/${TRUSTED_EVIDENCE_REPOSITORY}/blob/([a-f0-9]{40})/(.+)$`,
  'u'
);
const TRUSTED_WORKFLOW_RUN_URL = new RegExp(
  `^https://github\\.com/${TRUSTED_EVIDENCE_REPOSITORY}/actions/runs/([1-9][0-9]*)/attempts/([1-9][0-9]*)$`,
  'u'
);
const TRUSTED_DEPLOYMENT_URL = new RegExp(
  `^https://github\\.com/${TRUSTED_EVIDENCE_REPOSITORY}/deployments/[1-9][0-9]*$`,
  'u'
);
const TRUSTED_REVIEW_URL = new RegExp(
  `^https://github\\.com/${TRUSTED_EVIDENCE_REPOSITORY}/pull/[1-9][0-9]*$`,
  'u'
);
const TRUSTED_AUTOMATED_WORKFLOW = Object.freeze({
  name: 'Backend quality gates',
  path: '.github/workflows/backend-quality-gates.yml',
  event: 'push',
  branch: 'dwp-dev',
  command: './gradlew --no-daemon check',
});

const EXPECTED_GATE_IDS = range('G-', 2, 7);
const EXPECTED_DECISION_IDS = range('PS-', 1, 11);
const EXPECTED_EXIT_IDS = range('X-', 1, 8);
const EXPECTED_NAVIGATION_IDS = range('NC-', 1, 5);
const EXPECTED_ATTACK_VECTOR_IDS = [
  'CROSS_TENANT',
  'SCOPE_ESCAPE',
  'STALE_AUTHORITY_REVISION',
  'CONFUSED_DEPUTY',
  'INTERNAL_HEADER_SPOOF',
];
const ALLOWED_STATES = new Set(['COMPLETE', 'PENDING_INTERNAL', 'BLOCKED_EXTERNAL']);
const ALLOWED_EVIDENCE_TYPES = new Set([
  'OWNER_APPROVAL',
  'OPENAPI',
  'CONTRACT_CHECKSUM',
  'ROLLBACK_REHEARSAL',
  'AUTOMATED_TEST_RUN',
  'PRIVACY_APPROVAL',
  'ACCESSIBILITY_MANUAL_AT',
  'PAGE_CONTRACT',
  'DATA_CONTRACT',
  'ACTION_CONTRACT',
  'GATEWAY_PEP_TEST',
  'SERVICE_PEP_TEST',
  'CROSS_TENANT_NEGATIVE_TEST',
  'DEPLOYMENT_TRUST_ATTESTATION',
  'ARTIFACT_ROUTING_MATRIX',
  'REVOCATION_SLO',
  'TELEMETRY_RETENTION',
  'USABILITY_STUDY',
  'CHAOS_TEST',
  'PENETRATION_TEST',
  'FEATURE_DISABLED_AT_RELEASE',
]);
const REQUIRED_PRODUCT_EVIDENCE = [
  'OWNER_APPROVAL',
  'PAGE_CONTRACT',
  'DATA_CONTRACT',
  'ACTION_CONTRACT',
  'GATEWAY_PEP_TEST',
  'SERVICE_PEP_TEST',
  'CROSS_TENANT_NEGATIVE_TEST',
  'CONTRACT_CHECKSUM',
  'AUTOMATED_TEST_RUN',
];
const EVIDENCE_FIELDS = ['type', 'owner', 'recordedAt', 'reference', 'checksum', 'provenance'];
const PROVENANCE_FIELDS = [
  'kind',
  'claim',
  'issuer',
  'sourceRevision',
  'attestationReference',
  'attestationChecksum',
];
const PROVENANCE_KINDS = new Set([
  'OWNER_APPROVAL_ATTESTATION',
  'REVIEWED_ARTIFACT_ATTESTATION',
  'AUTOMATED_RUN_ATTESTATION',
  'DEPLOYMENT_ATTESTATION',
  'INDEPENDENT_REVIEW_ATTESTATION',
]);
const PROVENANCE_KIND_BY_EVIDENCE_TYPE = new Map([
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
const REQUIRED_EVIDENCE_BY_ID = new Map([
  ['G-02', ['OWNER_APPROVAL', 'OPENAPI', 'CONTRACT_CHECKSUM', 'AUTOMATED_TEST_RUN']],
  ['G-03', ['OWNER_APPROVAL', 'CONTRACT_CHECKSUM', 'AUTOMATED_TEST_RUN']],
  ['G-04', ['OWNER_APPROVAL', 'CONTRACT_CHECKSUM', 'AUTOMATED_TEST_RUN']],
  ['G-05', ['OWNER_APPROVAL', 'CONTRACT_CHECKSUM', 'AUTOMATED_TEST_RUN']],
  ['G-06', ['OWNER_APPROVAL', 'AUTOMATED_TEST_RUN', 'FEATURE_DISABLED_AT_RELEASE']],
  [
    'G-07',
    [
      'OWNER_APPROVAL',
      'PRIVACY_APPROVAL',
      'TELEMETRY_RETENTION',
      'CONTRACT_CHECKSUM',
      'AUTOMATED_TEST_RUN',
    ],
  ],
  ...EXPECTED_DECISION_IDS.map((id) => [id, ['OWNER_APPROVAL', 'CONTRACT_CHECKSUM']]),
  [
    'X-01',
    [
      'OWNER_APPROVAL',
      'PAGE_CONTRACT',
      'DATA_CONTRACT',
      'ACTION_CONTRACT',
      'GATEWAY_PEP_TEST',
      'SERVICE_PEP_TEST',
      'CROSS_TENANT_NEGATIVE_TEST',
      'CONTRACT_CHECKSUM',
      'AUTOMATED_TEST_RUN',
    ],
  ],
  ['X-02', ['OWNER_APPROVAL', 'DEPLOYMENT_TRUST_ATTESTATION', 'AUTOMATED_TEST_RUN']],
  ['X-03', ['OWNER_APPROVAL', 'CROSS_TENANT_NEGATIVE_TEST', 'AUTOMATED_TEST_RUN']],
  ['X-04', ['OWNER_APPROVAL', 'REVOCATION_SLO', 'AUTOMATED_TEST_RUN']],
  ['X-05', ['OWNER_APPROVAL', 'ARTIFACT_ROUTING_MATRIX', 'AUTOMATED_TEST_RUN']],
  ['X-06', ['OWNER_APPROVAL', 'PRIVACY_APPROVAL', 'TELEMETRY_RETENTION', 'AUTOMATED_TEST_RUN']],
  ['X-07', ['OWNER_APPROVAL', 'ACCESSIBILITY_MANUAL_AT', 'USABILITY_STUDY']],
  ['X-08', ['OWNER_APPROVAL', 'CHAOS_TEST', 'ROLLBACK_REHEARSAL', 'PENETRATION_TEST']],
]);
const ROOT_FIELDS = [
  '$schema',
  'schemaVersion',
  'manifestId',
  'release',
  'asOf',
  'status',
  'adrReference',
  'navigationConveniencePolicy',
  'scopedJitReleasePolicy',
  'productionGates',
  'decisions',
  'products',
  'exitCriteria',
];
const ITEM_FIELDS = [
  'id',
  'owner',
  'state',
  'releaseRequired',
  'summary',
  'requiredEvidenceTypes',
  'approval',
  'evidence',
  'blockers',
  'failClosedEvidence',
];
const PRODUCT_FIELDS = [...ITEM_FIELDS, 'productId', 'routeKinds', 'rolloutDefault'];
const INTERNAL_CLOSURE_REFERENCE =
  'architecture/product-surface-internal-closure.v1.generated.json';
const RELEASE_TRUST_POLICY_STATES = new Set(['ACTIVE', 'BLOCKED_EXTERNAL']);
const REVIEWER_ASSIGNMENT_FIELDS = [
  'itemId',
  'ownerRole',
  'ownerApprovalReviewers',
  'artifactReviewers',
  'independentReviewers',
];
const PRODUCT_EXTERNAL_BLOCKERS = new Map(
  [
    'approvals',
    'communications',
    'services',
    'hcm',
    'dwaion',
    'notifications',
    'spaces',
    'calendar',
    'workplace',
    'mail',
    'messaging',
    'meetings',
  ].map((productId) => {
    const token = productId.toUpperCase();
    return [
      productId,
      [
        `EXTERNAL_${token}_PRODUCT_SECURITY_OWNER_APPROVAL`,
        `EXTERNAL_${token}_IMMUTABLE_RELEASE_ATTESTATION`,
      ],
    ];
  })
);
const INTERNAL_HANDOFF_BLOCKERS = new Map([
  [
    'X-01',
    [
      'EXTERNAL_X01_SECURITY_AND_PRODUCT_OWNER_APPROVALS',
      'EXTERNAL_X01_IMMUTABLE_AGGREGATE_RELEASE_ATTESTATION',
    ],
  ],
  [
    'X-03',
    ['EXTERNAL_X03_SECURITY_OWNER_APPROVAL', 'EXTERNAL_X03_IMMUTABLE_AUTOMATED_RUN_ATTESTATION'],
  ],
]);
const X04_EXTERNAL_BLOCKERS = [
  'EXTERNAL_X04_OWNER_APPROVAL',
  'EXTERNAL_APPROVED_PRODUCTION_REVOCATION_SLO',
  'EXTERNAL_STAGING_REAL_BROWSER_CAPABILITY_ATTESTATION',
];
const X04_FAIL_CLOSED_EVIDENCE = [
  'libs/shared-utils/src/auth/product-surface-context-provider.tsx',
  'libs/shared-utils/src/auth/product-surface-context-provider.x04.mounted.test.tsx',
  'scripts/x04-local-revocation-slo.config.json',
  'scripts/check-x04-local-revocation-slo.mjs',
  'docs/06-delivery/release-evidence/X-04-local-revocation-multitab.md',
];
const ATTESTATION_DETAIL_BY_KIND = new Map([
  ['OWNER_APPROVAL_ATTESTATION', 'approval'],
  ['REVIEWED_ARTIFACT_ATTESTATION', 'artifact'],
  ['AUTOMATED_RUN_ATTESTATION', 'run'],
  ['DEPLOYMENT_ATTESTATION', 'deployment'],
  ['INDEPENDENT_REVIEW_ATTESTATION', 'review'],
]);
let resolvedTrustedEvidenceRevision;
let resolvedTrustedEvidenceTree;
let trustedEvidenceTreeAttempted = false;
const remoteEvidenceClaims = [];
const githubJsonCache = new Map();
const githubBytesCache = new Map();
let trustedReleasePolicy;
let trustedReviewerAssignments = new Map();

const errors = [];
if (trustedEvidenceRevision !== null && !/^[a-f0-9]{40}$/.test(trustedEvidenceRevision)) {
  errors.push('official Backend evidence revision must be a full lowercase commit SHA.');
}
const schema = readJson(schemaPath, 'Product Surface readiness schema', errors);
const manifest = readJson(manifestPath, 'Product Surface readiness manifest', errors);
const internalClosure = readJson(
  internalClosurePath,
  'Product Surface internal closure snapshot',
  errors
);
const releaseTrustPolicy = readJson(
  releaseTrustPolicyPath,
  'Product Surface release trust policy',
  errors
);
const authorizationSnapshot = readJson(
  authorizationSnapshotPath,
  'Product Surface authorization snapshot',
  errors
);
if (schema && manifest && internalClosure && authorizationSnapshot && releaseTrustPolicy) {
  validateReleaseTrustPolicy(releaseTrustPolicy, manifest);
  validateManifest(manifest, schema, internalClosure, authorizationSnapshot);
  validateOnlineReleaseEvidence(manifest);
}

if (errors.length > 0) {
  console.error('Product Surface production readiness evidence is invalid:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const items = [
  ...manifest.productionGates,
  ...manifest.decisions,
  ...manifest.products,
  ...manifest.exitCriteria,
];
const incomplete = items.filter((item) => item.releaseRequired && item.state !== 'COMPLETE');
/*
 * Integrity validation accepts an attested immutable bundle even when a newer
 * draft is registered. Release authorization is stricter: registry head,
 * latest alias, and the attested closure must resolve to the same bytes.
 * That moving-head check stays separate from manifest integrity validation.
 */
const authorizationClosureBlocker = arguments_.release
  ? getAuthorizationClosureReleaseBlocker(
      internalClosure,
      authorizationSnapshot,
      canonicalJsonForChecksum
    )
  : null;
printSummary(manifest, incomplete, internalClosure);
if (arguments_.release && (authorizationClosureBlocker || incomplete.length > 0)) {
  console.error('\nProduct Surface production release is blocked by incomplete evidence:');
  if (authorizationClosureBlocker) console.error(`- ${authorizationClosureBlocker}`);
  incomplete.forEach((item) =>
    console.error(`- ${item.id} ${item.state}: ${item.blockers.join(', ')}`)
  );
  process.exit(2);
}
if (arguments_.release) console.log('\nProduct Surface production release gate passed.');

function validateManifest(value, schemaValue, closureValue, authorizationValue) {
  validateSchemaIdentity(schemaValue);
  validateClosedFields(value, ROOT_FIELDS, 'manifest');
  if (value.$schema !== '../../../architecture/product-surface-production-readiness.schema.json') {
    errors.push('manifest $schema must reference the repository readiness schema.');
  }
  if (value.schemaVersion !== 1) errors.push('manifest schemaVersion must be 1.');
  if (value.manifestId !== 'product-surface-production-readiness.v1') {
    errors.push('manifestId must be product-surface-production-readiness.v1.');
  }
  if (!nonBlank(value.release)) errors.push('manifest requires release.');
  if (!isoDate(value.asOf)) errors.push('manifest asOf must be an ISO date.');
  if (!['READY', 'BLOCKED'].includes(value.status)) {
    errors.push('manifest status must be READY or BLOCKED.');
  }
  validateRepositoryPath(value.adrReference, 'manifest adrReference');
  validateNavigationPolicy(value.navigationConveniencePolicy);
  validateScopedJitReleasePolicy(value.scopedJitReleasePolicy);
  validateSection(value.productionGates, EXPECTED_GATE_IDS, 'productionGates');
  validateSection(value.decisions, EXPECTED_DECISION_IDS, 'decisions');
  validateProducts(value.products);
  validateSection(value.exitCriteria, EXPECTED_EXIT_IDS, 'exitCriteria');
  validateInternalClosureHandoff(value, closureValue, authorizationValue);
  validateX04Boundary(value);

  const allItems = [
    ...(value.productionGates ?? []),
    ...(value.decisions ?? []),
    ...(value.products ?? []),
    ...(value.exitCriteria ?? []),
  ];
  validateEvidenceReferenceIsolation(
    allItems.flatMap((item) =>
      (item?.evidence ?? []).map((evidence) => ({ itemId: item.id, evidence }))
    ),
    'manifest'
  );
  const blocked = allItems.some((item) => item?.releaseRequired && item.state !== 'COMPLETE');
  if (value.status === 'READY' && blocked) {
    errors.push('manifest cannot be READY while release-required evidence is incomplete.');
  }
  if (value.status === 'BLOCKED' && !blocked) {
    errors.push('manifest cannot be BLOCKED when all release-required evidence is complete.');
  }
}

function validateSchemaIdentity(value) {
  if (value?.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('schema must declare JSON Schema draft 2020-12.');
  }
  if (
    value?.properties?.manifestId?.const !== 'product-surface-production-readiness.v1' ||
    value?.properties?.schemaVersion?.const !== 1
  ) {
    errors.push('schema identity constants do not match the v1 readiness contract.');
  }
  if (!sameSet(value?.required, ROOT_FIELDS)) {
    errors.push('schema root required fields have drifted from the validator contract.');
  }
  if (!sameSet(value?.$defs?.readinessItem?.required, ITEM_FIELDS)) {
    errors.push('schema readiness item fields have drifted from the validator contract.');
  }
  if (!sameSet(value?.$defs?.state?.enum, [...ALLOWED_STATES])) {
    errors.push('schema readiness states have drifted from the validator contract.');
  }
  if (!sameSet(value?.$defs?.evidence?.properties?.type?.enum, [...ALLOWED_EVIDENCE_TYPES])) {
    errors.push('schema evidence types have drifted from the validator contract.');
  }
  if (!sameSet(value?.$defs?.evidence?.required, EVIDENCE_FIELDS)) {
    errors.push('schema evidence fields have drifted from the validator contract.');
  }
  if (!sameSet(value?.$defs?.evidenceProvenance?.required, PROVENANCE_FIELDS)) {
    errors.push('schema evidence provenance fields have drifted from the validator contract.');
  }
  if (!sameSet(value?.$defs?.evidenceProvenance?.properties?.kind?.enum, [...PROVENANCE_KINDS])) {
    errors.push('schema evidence provenance kinds have drifted from the validator contract.');
  }
  if (
    value?.$defs?.navigationConveniencePolicy?.properties?.managementAutomaticRestore?.const !==
      'FORBIDDEN' ||
    value?.$defs?.navigationConveniencePolicy?.properties?.managementResume?.const !==
      'EXPLICIT_USER_ACTION_AND_REAUTHORIZE_ONLY'
  ) {
    errors.push('schema Management restoration policy has drifted from the ADR contract.');
  }
  const scopedJit = value?.$defs?.scopedJitReleasePolicy?.properties;
  if (
    scopedJit?.activation?.const !== 'DISABLED' ||
    scopedJit?.environmentOverride?.const !== 'FORBIDDEN' ||
    !sameSet(scopedJit?.allowedScopes?.const, [])
  ) {
    errors.push('schema scoped JIT disablement has drifted from the release contract.');
  }
}

function validateNavigationPolicy(value) {
  const fields = [
    'policyId',
    'workReturnLastRoute',
    'managementAutomaticRestore',
    'managementResume',
    'acceptanceCriteria',
  ];
  if (!isRecord(value)) {
    errors.push('navigationConveniencePolicy must be an object.');
    return;
  }
  validateClosedFields(value, fields, 'navigationConveniencePolicy');
  if (value.policyId !== 'product-surface-navigation-convenience.v1') {
    errors.push('navigation policyId must be product-surface-navigation-convenience.v1.');
  }
  if (value.workReturnLastRoute !== 'ALLOWED') {
    errors.push('last-route convenience must remain allowed only for Work return.');
  }
  if (value.managementAutomaticRestore !== 'FORBIDDEN') {
    errors.push('Management automatic last-route restoration must remain FORBIDDEN.');
  }
  if (value.managementResume !== 'EXPLICIT_USER_ACTION_AND_REAUTHORIZE_ONLY') {
    errors.push('Management resume must require explicit user action and reauthorization.');
  }
  validateExactIds(value.acceptanceCriteria, EXPECTED_NAVIGATION_IDS, 'navigation acceptance');
  for (const criterion of value.acceptanceCriteria ?? []) {
    validateClosedFields(criterion, ['id', 'requirement', 'testReference'], criterion.id);
    if (!nonBlank(criterion.requirement)) errors.push(`${criterion.id} requires requirement.`);
    validateRepositoryPath(criterion.testReference, `${criterion.id} testReference`);
  }
}

function validateScopedJitReleasePolicy(value) {
  const fields = [
    'policyId',
    'activation',
    'environmentOverride',
    'allowedScopes',
    'controlIds',
    'reenablementRequirements',
  ];
  const controls = [
    'AUTH_SERVICE_ROLLOUT_GATE',
    'DB_POLICY_MODE_TRIGGER',
    'DB_REQUEST_STATE_TRIGGER',
    'DB_ACTIVE_GRANT_TRIGGER',
  ];
  const requirements = [
    'EXACT_SCOPE_PEP',
    'EXPIRY_REVALIDATION',
    'AUTHORITY_REVISION_BINDING',
    'CROSS_SCOPE_NEGATIVE_MATRIX',
    'IDENTITY_SECURITY_OWNER_APPROVAL',
  ];
  if (!isRecord(value)) {
    errors.push('scopedJitReleasePolicy must be an object.');
    return;
  }
  validateClosedFields(value, fields, 'scopedJitReleasePolicy');
  if (value.policyId !== 'scoped-jit-release-disablement.v1') {
    errors.push('scoped JIT policyId must remain scoped-jit-release-disablement.v1.');
  }
  if (value.activation !== 'DISABLED' || value.environmentOverride !== 'FORBIDDEN') {
    errors.push('scoped JIT must remain disabled without an environment override.');
  }
  if (!sameSet(value.allowedScopes, [])) {
    errors.push('scoped JIT cannot expose any release scope while disabled.');
  }
  if (!sameSet(value.controlIds, controls)) {
    errors.push('scoped JIT disablement controls do not match the fixed release contract.');
  }
  if (!sameSet(value.reenablementRequirements, requirements)) {
    errors.push('scoped JIT re-enablement requirements do not match the fixed release contract.');
  }
}

function validateSection(value, expectedIds, label) {
  validateExactIds(value, expectedIds, label);
  for (const item of value ?? []) validateItem(item, ITEM_FIELDS);
}

function validateProducts(value) {
  if (!Array.isArray(value)) {
    errors.push('products must be an array.');
    return;
  }
  const inventory = readJson(
    resolve(root, 'architecture/frontend-apps.json'),
    'app inventory',
    errors
  );
  const expectedProducts = inventory?.governedProductSurfaces?.map((item) => item.productId) ?? [];
  validateExactIds(value, expectedProducts, 'products', (item) => item?.productId);
  const inventoryByProduct = new Map(
    (inventory?.governedProductSurfaces ?? []).map((item) => [item.productId, item])
  );
  for (const item of value) {
    validateItem(item, PRODUCT_FIELDS);
    if (!nonBlank(item.productId)) errors.push(`${item.id} requires productId.`);
    if (!sameSet(item.routeKinds, ['PAGE', 'DATA', 'ACTION'])) {
      errors.push(`${item.id} routeKinds must be exactly PAGE, DATA, ACTION.`);
    }
    const inventoryEntry = inventoryByProduct.get(item.productId);
    if (item.rolloutDefault !== inventoryEntry?.rolloutDefault || item.rolloutDefault !== '000') {
      errors.push(`${item.id} rolloutDefault must match the fail-closed inventory value 000.`);
    }
    requireEvidenceTypes(item, REQUIRED_PRODUCT_EVIDENCE);
  }
}

function validateInternalClosureHandoff(manifestValue, closure, authorization) {
  const closureFields = [
    'schemaVersion',
    'closureKey',
    'generatedFrom',
    'attackVectors',
    'products',
    'summary',
  ];
  const sourceFields = [
    'backend',
    'authorizationBundle',
    'negativeMatrix',
    'rolloutInventory',
    'agentEvidence',
  ];
  const productFields = [
    'productId',
    'contractStatus',
    'routeKinds',
    'ownerService',
    'attackEvidence',
    'qualifiedAttackIds',
    'missingAttackIds',
    'blocker',
  ];
  const summaryFields = [
    'productCount',
    'exactProducts',
    'internallyClosedProducts',
    'totalAttackCells',
    'qualifiedAttackCells',
    'missingAttackCells',
    'productBlockers',
    'completionState',
  ];
  if (!isRecord(closure)) {
    errors.push('internal closure snapshot must be an object.');
    return;
  }
  validateClosedFields(closure, closureFields, 'internal closure snapshot');
  if (closure.schemaVersion !== 1 || closure.closureKey !== 'product-surface-internal-closure.v1') {
    errors.push('internal closure snapshot identity is invalid.');
  }
  validateClosedFields(closure.generatedFrom, sourceFields, 'internal closure generatedFrom');
  validateClosedFields(
    closure.generatedFrom?.backend,
    ['repository', 'revision'],
    'internal closure Backend source'
  );
  validateClosedFields(
    closure.generatedFrom?.authorizationBundle,
    ['artifact', 'version', 'checksum'],
    'internal closure authorizationBundle'
  );
  validateClosedFields(
    closure.generatedFrom?.negativeMatrix,
    ['artifact', 'matrixId', 'artifactChecksum', 'projectionChecksum'],
    'internal closure negativeMatrix'
  );
  validateClosedFields(
    closure.generatedFrom?.rolloutInventory,
    ['artifact', 'checksum'],
    'internal closure rolloutInventory'
  );
  validateClosedFields(
    closure.generatedFrom?.agentEvidence,
    ['artifact', 'repository', 'revision', 'checksum', 'artifactChecksum', 'sourceCiRun'],
    'internal closure Agent evidence'
  );
  validateClosedFields(
    closure.generatedFrom?.agentEvidence?.sourceCiRun,
    ['provider', 'workflow', 'runId', 'url', 'headSha', 'conclusion'],
    'internal closure Agent source CI run'
  );
  if (
    closure.generatedFrom?.backend?.repository !== 'https://github.com/choijoonbin/dwp-backend' ||
    !/^[a-f0-9]{40}$/.test(closure.generatedFrom?.backend?.revision ?? '') ||
    closure.generatedFrom?.authorizationBundle?.artifact !== 'product-surfaces-v1.bundle-v4.json' ||
    closure.generatedFrom?.authorizationBundle?.version !== 4 ||
    !/^[a-f0-9]{64}$/.test(closure.generatedFrom?.authorizationBundle?.checksum ?? '') ||
    closure.generatedFrom?.negativeMatrix?.artifact !== 'authorization-negative-matrix.v1.json' ||
    closure.generatedFrom?.negativeMatrix?.matrixId !==
      'product-authorization-negative-matrix.v1' ||
    !/^[a-f0-9]{64}$/.test(closure.generatedFrom?.negativeMatrix?.artifactChecksum ?? '') ||
    !/^[a-f0-9]{64}$/.test(closure.generatedFrom?.negativeMatrix?.projectionChecksum ?? '') ||
    closure.generatedFrom?.rolloutInventory?.artifact !==
      'product-surface-rollout-inventory.v1.generated.json' ||
    !/^[a-f0-9]{64}$/.test(closure.generatedFrom?.rolloutInventory?.checksum ?? '')
  ) {
    errors.push('internal closure source identity or checksum metadata is invalid.');
  }
  const agentEvidence = closure.generatedFrom?.agentEvidence;
  const agentRun = agentEvidence?.sourceCiRun;
  if (
    agentEvidence?.artifact !== 'dwaion-agent-pep-attestation.v1.json' ||
    agentEvidence?.repository !== 'https://github.com/choijoonbin/aura_agent' ||
    !/^[a-f0-9]{40}$/.test(agentEvidence?.revision ?? '') ||
    !/^[a-f0-9]{64}$/.test(agentEvidence?.checksum ?? '') ||
    !/^[a-f0-9]{64}$/.test(agentEvidence?.artifactChecksum ?? '') ||
    agentRun?.provider !== 'GITHUB_ACTIONS' ||
    agentRun?.workflow !== 'Agent quality' ||
    agentRun?.url !== `${agentEvidence?.repository}/actions/runs/${agentRun?.runId}` ||
    agentRun?.headSha !== agentEvidence?.revision ||
    agentRun?.conclusion !== 'success'
  ) {
    errors.push('internal closure Agent evidence provenance is invalid.');
  }
  if (!sameOrderedValues(closure.attackVectors, EXPECTED_ATTACK_VECTOR_IDS)) {
    errors.push('internal closure attack vectors must match the fixed five-vector matrix.');
  }
  validateClosedFields(closure.summary, summaryFields, 'internal closure summary');
  const inventoryProducts = authorization?.rolloutInventory?.products ?? [];
  const closureBundleReference = closure.generatedFrom?.authorizationBundle;
  const closureVersion = closureBundleReference?.version;
  const closureBundles = (authorization?.bundles ?? []).filter(
    (item) => item?.version === closureVersion
  );
  const closureIndexEntries = (authorization?.index?.versions ?? []).filter(
    (item) => item?.version === closureVersion
  );
  const closureBundle = closureBundles.length === 1 ? closureBundles[0] : undefined;
  const closureIndexEntry = closureIndexEntries.length === 1 ? closureIndexEntries[0] : undefined;
  if (
    !closureBundle ||
    !closureIndexEntry ||
    closureIndexEntry.artifact !== closureBundleReference?.artifact ||
    closureIndexEntry.checksum !== closureBundleReference?.checksum ||
    closureBundle?.checksum !== closureBundleReference?.checksum ||
    closure.generatedFrom?.rolloutInventory?.checksum !== authorization?.rolloutInventory?.checksum
  ) {
    errors.push('internal closure snapshot is not bound to its immutable authorization bundle.');
  }
  validateExactIds(
    closure.products,
    inventoryProducts,
    'internal closure products',
    (item) => item?.productId
  );
  const routeKindsByProduct = new Map(inventoryProducts.map((productId) => [productId, new Set()]));
  for (const route of closureBundle?.routes ?? []) {
    if (route?.subject?.type !== 'PRODUCT') continue;
    if (!routeKindsByProduct.has(route.subject.productKey)) {
      errors.push(
        `authorization snapshot contains product outside rollout inventory: ${route.subject.productKey}.`
      );
      continue;
    }
    routeKindsByProduct.get(route.subject.productKey).add(route.routeKind);
  }

  const closureByProduct = new Map();
  let exactProducts = 0;
  let internallyClosedProducts = 0;
  let qualifiedAttackCells = 0;
  let productBlockers = 0;
  for (const product of closure.products ?? []) {
    const label = `internal closure ${product?.productId ?? 'product'}`;
    if (!isRecord(product)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    validateClosedFields(product, productFields, label);
    closureByProduct.set(product.productId, product);
    const expectedRouteKinds = ['PAGE', 'DATA', 'ACTION'].filter((routeKind) =>
      routeKindsByProduct.get(product.productId)?.has(routeKind)
    );
    const expectedContractStatus =
      expectedRouteKinds.length === 0
        ? 'MISSING'
        : sameOrderedValues(expectedRouteKinds, ['PAGE', 'DATA', 'ACTION'])
          ? 'EXACT'
          : 'INCOMPLETE_KINDS';
    if (
      !sameOrderedValues(product.routeKinds, expectedRouteKinds) ||
      product.contractStatus !== expectedContractStatus
    ) {
      errors.push(
        `${label} route kinds or contract status differ from the v4 authorization bundle.`
      );
    }
    if (expectedContractStatus === 'EXACT') exactProducts += 1;
    if (!nonBlank(product.ownerService)) errors.push(`${label} requires ownerService.`);
    if (!isRecord(product.attackEvidence)) {
      errors.push(`${label} attackEvidence must be an object.`);
      continue;
    }
    validateClosedFields(product.attackEvidence, EXPECTED_ATTACK_VECTOR_IDS, `${label} evidence`);
    const calculatedQualified = [];
    for (const attackId of EXPECTED_ATTACK_VECTOR_IDS) {
      const references = product.attackEvidence[attackId];
      if (!Array.isArray(references)) {
        errors.push(`${label} ${attackId} evidence must be an array.`);
        continue;
      }
      validateUnique(references, `${label} ${attackId} evidence`);
      if (references.length > 0) calculatedQualified.push(attackId);
    }
    const calculatedMissing = EXPECTED_ATTACK_VECTOR_IDS.filter(
      (attackId) => !calculatedQualified.includes(attackId)
    );
    if (
      !sameOrderedValues(product.qualifiedAttackIds, calculatedQualified) ||
      !sameOrderedValues(product.missingAttackIds, calculatedMissing)
    ) {
      errors.push(`${label} qualified and missing attack cells must be calculation-derived.`);
    }
    qualifiedAttackCells += calculatedQualified.length;
    const internallyClosed =
      expectedContractStatus === 'EXACT' &&
      calculatedMissing.length === 0 &&
      product.blocker === null;
    if (!internallyClosed && !nonBlank(product.blocker)) {
      errors.push(`${label} requires a blocker while its internal closure is incomplete.`);
    }
    if (internallyClosed) internallyClosedProducts += 1;
    if (product.blocker !== null) productBlockers += 1;
  }

  const productCount = inventoryProducts.length;
  const totalAttackCells = productCount * EXPECTED_ATTACK_VECTOR_IDS.length;
  const completionState =
    exactProducts === productCount &&
    qualifiedAttackCells === totalAttackCells &&
    productBlockers === 0
      ? 'COMPLETE'
      : 'PARTIAL';
  const expectedSummary = {
    productCount,
    exactProducts,
    internallyClosedProducts,
    totalAttackCells,
    qualifiedAttackCells,
    missingAttackCells: totalAttackCells - qualifiedAttackCells,
    productBlockers,
    completionState,
  };
  if (canonicalJsonForChecksum(closure.summary) !== canonicalJsonForChecksum(expectedSummary)) {
    errors.push('internal closure summary contains non-calculated values.');
  }

  const matrixProjection = {
    schemaVersion: 1,
    matrixId: closure.generatedFrom?.negativeMatrix?.matrixId,
    completionState,
    rolloutInventory: {
      reference:
        'contracts/product-authorization/product-surface-rollout-inventory.v1.generated.json',
      checksum: closure.generatedFrom?.rolloutInventory?.checksum,
    },
    exactContract: {
      reference: `contracts/product-authorization/${closureBundleReference?.artifact}`,
      checksum: closure.generatedFrom?.authorizationBundle?.checksum,
      products: inventoryProducts,
    },
    attackVectors: EXPECTED_ATTACK_VECTOR_IDS,
    products: inventoryProducts.map((productId) => {
      const product = closureByProduct.get(productId) ?? {};
      return {
        productId,
        contractStatus: product.contractStatus,
        ownerService: product.ownerService,
        attackEvidence: product.attackEvidence,
        missingAttackIds: product.missingAttackIds,
        blocker: product.blocker,
      };
    }),
  };
  if (
    closure.generatedFrom?.negativeMatrix?.projectionChecksum !== canonicalSha256(matrixProjection)
  ) {
    errors.push('internal closure matrix projection checksum does not match its evidence.');
  }

  const readinessByProduct = new Map(
    (manifestValue.products ?? []).map((product) => [product.productId, product])
  );
  for (const productId of inventoryProducts) {
    const readiness = readinessByProduct.get(productId);
    const internal = closureByProduct.get(productId);
    if (readiness?.state === 'BLOCKED_EXTERNAL' || readiness?.state === 'COMPLETE') {
      if (
        internal?.contractStatus !== 'EXACT' ||
        internal?.missingAttackIds?.length !== 0 ||
        internal?.blocker !== null
      ) {
        errors.push(`${readiness.id} cannot hand off externally before exact internal closure.`);
      }
      if (readiness?.state === 'BLOCKED_EXTERNAL') {
        requireExactExternalHandoff(readiness, PRODUCT_EXTERNAL_BLOCKERS.get(productId));
      }
    }
  }

  const exitById = new Map((manifestValue.exitCriteria ?? []).map((item) => [item.id, item]));
  const x01 = exitById.get('X-01');
  const x03 = exitById.get('X-03');
  if (completionState === 'COMPLETE') {
    for (const product of manifestValue.products ?? []) {
      if (product.state === 'PENDING_INTERNAL') {
        errors.push(`${product.id} cannot remain PENDING_INTERNAL after 12/12 and 60/60 closure.`);
      }
    }
    for (const item of [x01, x03]) {
      if (item?.state === 'PENDING_INTERNAL') {
        errors.push(`${item.id} cannot remain PENDING_INTERNAL after calculated internal closure.`);
      }
      if (item?.state === 'BLOCKED_EXTERNAL') {
        requireExactExternalHandoff(item, INTERNAL_HANDOFF_BLOCKERS.get(item.id));
      }
    }
  } else {
    for (const product of manifestValue.products ?? []) {
      if (product.state !== 'PENDING_INTERNAL') {
        errors.push(`${product.id} must remain PENDING_INTERNAL until 12/12 and 60/60 closure.`);
      }
    }
    if (x01?.state !== 'PENDING_INTERNAL') {
      errors.push('X-01 must remain PENDING_INTERNAL while any product closure is incomplete.');
    }
    if (x03?.state !== 'PENDING_INTERNAL') {
      errors.push('X-03 must remain PENDING_INTERNAL while the five-vector matrix is PARTIAL.');
    }
  }
}

function requireExactExternalHandoff(item, expectedBlockers) {
  if (!sameSet(item?.blockers, expectedBlockers ?? [])) {
    errors.push(`${item?.id ?? 'item'} external handoff blockers do not match the fixed contract.`);
  }
  if (!(item?.failClosedEvidence ?? []).includes(INTERNAL_CLOSURE_REFERENCE)) {
    errors.push(
      `${item?.id ?? 'item'} external handoff must retain the internal closure snapshot.`
    );
  }
}

function validateX04Boundary(manifestValue) {
  const x04 = (manifestValue.exitCriteria ?? []).find((item) => item.id === 'X-04');
  if (x04?.state === 'COMPLETE') return;
  if (x04?.state !== 'BLOCKED_EXTERNAL' || !sameSet(x04?.blockers, X04_EXTERNAL_BLOCKERS)) {
    errors.push('X-04 must remain BLOCKED_EXTERNAL on the approved production evidence boundary.');
  }
  if (
    !X04_FAIL_CLOSED_EVIDENCE.every((reference) => x04?.failClosedEvidence?.includes(reference))
  ) {
    errors.push('X-04 must retain the deterministic local fail-closed evidence set.');
  }
}

function validateItem(item, allowedFields) {
  if (!isRecord(item)) {
    errors.push('readiness section contains a non-object item.');
    return;
  }
  const label = item.id ?? 'unknown item';
  validateClosedFields(item, allowedFields, label);
  for (const field of allowedFields) {
    if (!(field in item)) errors.push(`${label} requires ${field}.`);
  }
  if (!nonBlank(item.id) || !nonBlank(item.owner) || !nonBlank(item.summary)) {
    errors.push(`${label} requires non-empty id, owner, and summary.`);
  }
  if (!ALLOWED_STATES.has(item.state)) errors.push(`${label} has invalid state ${item.state}.`);
  if (item.releaseRequired !== true) errors.push(`${label} must remain releaseRequired.`);
  for (const field of ['requiredEvidenceTypes', 'evidence', 'blockers', 'failClosedEvidence']) {
    if (!Array.isArray(item[field])) errors.push(`${label} ${field} must be an array.`);
  }
  validateUnique(item.requiredEvidenceTypes, `${label} requiredEvidenceTypes`);
  validateUnique(item.blockers, `${label} blockers`);
  validateUnique(item.failClosedEvidence, `${label} failClosedEvidence`);
  for (const type of item.requiredEvidenceTypes ?? []) {
    if (!ALLOWED_EVIDENCE_TYPES.has(type))
      errors.push(`${label} has unknown evidence type ${type}.`);
  }
  requireEvidenceTypes(item, REQUIRED_EVIDENCE_BY_ID.get(item.id));
  validateApproval(item);
  for (const evidence of item.evidence ?? []) validateEvidence(evidence, item);
  validateEvidenceReferenceIsolation(item.evidence ?? [], label);
  for (const reference of item.failClosedEvidence ?? []) {
    validateRepositoryPath(reference, `${label} failClosedEvidence`);
  }

  if (item.state === 'COMPLETE') {
    const presentTypes = new Set((item.evidence ?? []).map((entry) => entry.type));
    const missing = (item.requiredEvidenceTypes ?? []).filter((type) => !presentTypes.has(type));
    if (missing.length > 0)
      errors.push(`${label} COMPLETE is missing ${missing.join(', ')} evidence.`);
    if ((item.blockers ?? []).length > 0) errors.push(`${label} COMPLETE cannot retain blockers.`);
    if ((item.failClosedEvidence ?? []).length > 0) {
      errors.push(`${label} COMPLETE cannot substitute failClosedEvidence for release evidence.`);
    }
  } else {
    if ((item.blockers ?? []).length === 0)
      errors.push(`${label} incomplete item requires blockers.`);
    if ((item.failClosedEvidence ?? []).length === 0) {
      errors.push(`${label} incomplete item requires failClosedEvidence.`);
    }
    const prefix = item.state === 'PENDING_INTERNAL' ? 'INTERNAL_' : 'EXTERNAL_';
    if ((item.blockers ?? []).some((blocker) => !blocker.startsWith(prefix))) {
      errors.push(`${label} ${item.state} blockers must use ${prefix} codes.`);
    }
  }
}

function validateReleaseTrustPolicy(policy, manifestValue) {
  const fields = [
    'schemaVersion',
    'policyId',
    'repository',
    'status',
    'asOf',
    'automatedWorkflow',
    'assignments',
    'deploymentEnvironments',
  ];
  validateClosedFields(policy, fields, 'release trust policy');
  if (
    policy.schemaVersion !== 1 ||
    policy.policyId !== 'product-surface-release-trust-policy.v1' ||
    policy.repository !== TRUSTED_EVIDENCE_REPOSITORY ||
    !RELEASE_TRUST_POLICY_STATES.has(policy.status) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(policy.asOf ?? '') ||
    !Array.isArray(policy.assignments) ||
    !Array.isArray(policy.deploymentEnvironments)
  ) {
    errors.push('release trust policy identity or lifecycle is invalid.');
    return;
  }
  validateClosedFields(
    policy.automatedWorkflow,
    ['name', 'path', 'event', 'branch', 'checksum'],
    'release trust automated workflow'
  );
  if (
    policy.automatedWorkflow?.name !== TRUSTED_AUTOMATED_WORKFLOW.name ||
    policy.automatedWorkflow?.path !== TRUSTED_AUTOMATED_WORKFLOW.path ||
    policy.automatedWorkflow?.event !== TRUSTED_AUTOMATED_WORKFLOW.event ||
    policy.automatedWorkflow?.branch !== TRUSTED_AUTOMATED_WORKFLOW.branch ||
    !(
      policy.automatedWorkflow?.checksum === null ||
      /^sha256:[a-f0-9]{64}$/u.test(policy.automatedWorkflow?.checksum ?? '')
    )
  ) {
    errors.push('release trust automated workflow identity or checksum is invalid.');
  }
  const items = [
    ...(manifestValue.productionGates ?? []),
    ...(manifestValue.decisions ?? []),
    ...(manifestValue.products ?? []),
    ...(manifestValue.exitCriteria ?? []),
  ];
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const assignments = new Map();
  for (const assignment of policy.assignments) {
    if (!isRecord(assignment)) {
      errors.push('release reviewer assignment must be an object.');
      continue;
    }
    validateClosedFields(assignment, REVIEWER_ASSIGNMENT_FIELDS, 'release reviewer assignment');
    const item = itemsById.get(assignment.itemId);
    if (!item || assignment.ownerRole !== item.owner) {
      errors.push(`${assignment.itemId ?? 'unknown'} reviewer assignment owner is invalid.`);
    }
    if (assignments.has(assignment.itemId)) {
      errors.push(`release reviewer policy contains duplicate ${assignment.itemId} assignments.`);
    }
    for (const field of ['ownerApprovalReviewers', 'artifactReviewers', 'independentReviewers']) {
      const reviewers = assignment[field];
      if (!Array.isArray(reviewers)) {
        errors.push(`${assignment.itemId ?? 'unknown'} ${field} must be an array.`);
        continue;
      }
      validateUnique(reviewers, `${assignment.itemId} ${field}`);
      if (
        reviewers.some((reviewer) => !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/u.test(reviewer)) ||
        !sameOrderedValues(reviewers, [...reviewers].sort())
      ) {
        errors.push(`${assignment.itemId} ${field} must contain sorted canonical GitHub logins.`);
      }
    }
    assignments.set(assignment.itemId, assignment);
  }
  const deploymentEnvironments = new Map();
  for (const binding of policy.deploymentEnvironments) {
    validateClosedFields(
      binding,
      ['itemId', 'claim', 'environment'],
      'release deployment environment binding'
    );
    const key = `${binding?.itemId}:${binding?.claim}`;
    const item = itemsById.get(binding?.itemId);
    if (
      !item ||
      !(item.requiredEvidenceTypes ?? []).includes(binding?.claim) ||
      PROVENANCE_KIND_BY_EVIDENCE_TYPE.get(binding?.claim) !== 'DEPLOYMENT_ATTESTATION' ||
      !/^[a-z][a-z0-9-]{1,62}$/u.test(binding?.environment ?? '') ||
      deploymentEnvironments.has(key)
    ) {
      errors.push(`${key} release deployment environment binding is invalid.`);
    }
    deploymentEnvironments.set(key, binding?.environment);
  }
  if (policy.status === 'ACTIVE') {
    validateExactIds(
      policy.assignments,
      items.map(({ id }) => id),
      'release reviewer assignments',
      (entry) => entry?.itemId
    );
    for (const item of items) {
      const assignment = assignments.get(item.id);
      if (
        !assignment ||
        (assignment.ownerApprovalReviewers?.length ?? 0) === 0 ||
        (assignment.artifactReviewers?.length ?? 0) === 0 ||
        ((item.requiredEvidenceTypes ?? []).some((type) =>
          [
            'PRIVACY_APPROVAL',
            'ACCESSIBILITY_MANUAL_AT',
            'TELEMETRY_RETENTION',
            'USABILITY_STUDY',
            'PENETRATION_TEST',
          ].includes(type)
        ) &&
          (assignment.independentReviewers?.length ?? 0) === 0)
      ) {
        errors.push(`${item.id} active reviewer assignment is incomplete.`);
      }
      for (const type of (item.requiredEvidenceTypes ?? []).filter(
        (candidate) => PROVENANCE_KIND_BY_EVIDENCE_TYPE.get(candidate) === 'DEPLOYMENT_ATTESTATION'
      )) {
        if (!deploymentEnvironments.has(`${item.id}:${type}`)) {
          errors.push(`${item.id}:${type} active deployment environment binding is missing.`);
        }
      }
    }
    if (!/^sha256:[a-f0-9]{64}$/u.test(policy.automatedWorkflow?.checksum ?? '')) {
      errors.push('active release trust policy requires an immutable workflow checksum.');
    }
  }
  trustedReleasePolicy = { ...policy, deploymentEnvironments };
  trustedReviewerAssignments = assignments;
}

function validateApproval(item) {
  const approval = item.approval;
  if (!isRecord(approval)) {
    errors.push(`${item.id} approval must be an object.`);
    return;
  }
  validateClosedFields(approval, ['approvedBy', 'approvedAt'], `${item.id} approval`);
  if (!Array.isArray(approval.approvedBy)) errors.push(`${item.id} approvedBy must be an array.`);
  validateUnique(approval.approvedBy, `${item.id} approvedBy`);
  if (item.state === 'COMPLETE') {
    if (!(approval.approvedBy ?? []).every(nonBlank) || approval.approvedBy.length === 0) {
      errors.push(`${item.id} COMPLETE requires named approvers.`);
    }
    if (!isoDateTime(approval.approvedAt)) errors.push(`${item.id} COMPLETE requires approvedAt.`);
    const assignment = trustedReviewerAssignments.get(item.id);
    if (trustedReleasePolicy?.status !== 'ACTIVE' || !assignment) {
      errors.push(`${item.id} COMPLETE requires an active immutable reviewer assignment.`);
    } else if (!sameSet(approval.approvedBy, assignment.ownerApprovalReviewers)) {
      errors.push(`${item.id} approvedBy does not match its immutable reviewer policy.`);
    }
  } else if ((approval.approvedBy ?? []).length > 0 || approval.approvedAt !== null) {
    errors.push(`${item.id} incomplete approval must remain empty and undated.`);
  }
}

function validateEvidence(value, item) {
  const label = item.id;
  if (!isRecord(value)) {
    errors.push(`${label} evidence must be an object.`);
    return;
  }
  validateClosedFields(value, EVIDENCE_FIELDS, `${label} evidence`);
  for (const field of EVIDENCE_FIELDS)
    if (!(field in value)) errors.push(`${label} evidence requires ${field}.`);
  if (!ALLOWED_EVIDENCE_TYPES.has(value.type)) errors.push(`${label} evidence type is invalid.`);
  if (!nonBlank(value.owner)) errors.push(`${label} evidence requires owner.`);
  if (value.owner !== item.owner) errors.push(`${label} evidence owner must equal its item owner.`);
  if (!isoDateTime(value.recordedAt)) errors.push(`${label} evidence requires an ISO date-time.`);
  if (!/^sha256:[a-f0-9]{64}$/.test(value.checksum ?? '')) {
    errors.push(`${label} evidence requires an immutable sha256 checksum.`);
  }
  const evidenceReference = parseTrustedEvidenceReference(
    value.reference,
    value.provenance?.sourceRevision,
    `${label} evidence reference`
  );
  const evidenceBytes = evidenceReference
    ? readTrustedEvidenceFile(evidenceReference, `${label} evidence`)
    : undefined;
  if (
    evidenceBytes &&
    /^sha256:[a-f0-9]{64}$/.test(value.checksum ?? '') &&
    value.checksum !== digestBytes(evidenceBytes)
  ) {
    errors.push(`${label} evidence checksum does not match its revision-bound file.`);
  }
  validateEvidenceProvenance(value.provenance, value.type, item, value, evidenceReference);
}

function validateEvidenceProvenance(value, evidenceType, item, evidence, evidenceReference) {
  const label = item.id;
  if (!isRecord(value)) {
    errors.push(`${label} evidence provenance must be an object.`);
    return;
  }
  validateClosedFields(value, PROVENANCE_FIELDS, `${label} evidence provenance`);
  for (const field of PROVENANCE_FIELDS) {
    if (!(field in value)) errors.push(`${label} evidence provenance requires ${field}.`);
  }
  const expectedKind = PROVENANCE_KIND_BY_EVIDENCE_TYPE.get(evidenceType);
  if (!PROVENANCE_KINDS.has(value.kind) || value.kind !== expectedKind) {
    errors.push(`${label} ${evidenceType} evidence requires ${expectedKind} provenance.`);
  }
  if (value.claim !== evidenceType) {
    errors.push(`${label} evidence provenance claim must equal ${evidenceType}.`);
  }
  if (value.issuer !== TRUSTED_EVIDENCE_ISSUER) {
    errors.push(`${label} evidence provenance issuer is not trusted.`);
  }
  if (!/^[a-f0-9]{40}$/.test(value.sourceRevision ?? '')) {
    errors.push(`${label} evidence provenance requires a full lowercase source revision.`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(value.attestationChecksum ?? '')) {
    errors.push(`${label} evidence provenance requires an immutable attestation checksum.`);
  }
  const attestationReference = parseTrustedEvidenceReference(
    value.attestationReference,
    value.sourceRevision,
    `${label} evidence attestation`
  );
  const attestationBytes = attestationReference
    ? readTrustedEvidenceFile(attestationReference, `${label} evidence attestation`)
    : undefined;
  if (!attestationBytes) return;
  if (value.attestationChecksum !== digestBytes(attestationBytes)) {
    errors.push(`${label} evidence attestation checksum does not match its revision-bound file.`);
    return;
  }
  let attestation;
  try {
    attestation = JSON.parse(attestationBytes.toString('utf8'));
  } catch (error) {
    errors.push(`${label} evidence attestation is not valid JSON: ${error.message}.`);
    return;
  }
  validateTrustedAttestation(
    attestation,
    value,
    evidence,
    item,
    evidenceReference,
    attestationReference
  );
}

function parseTrustedEvidenceReference(value, expectedRevision, label) {
  if (typeof value !== 'string') {
    errors.push(`${label} must be an HTTPS permalink in the trusted evidence repository.`);
    return undefined;
  }
  const match = TRUSTED_EVIDENCE_URL.exec(value);
  if (!match) {
    errors.push(`${label} is not in trusted repository ${TRUSTED_EVIDENCE_REPOSITORY}.`);
    return undefined;
  }
  const [, revision, repositoryPath] = match;
  if (revision !== expectedRevision) {
    errors.push(`${label} revision differs from evidence provenance sourceRevision.`);
  }
  if (!safeRepositoryPath(repositoryPath)) {
    errors.push(`${label} path escapes the trusted evidence repository.`);
    return undefined;
  }
  return { revision, repositoryPath };
}

function safeRepositoryPath(value) {
  if (!nonBlank(value) || value.includes('\\') || value.includes('?') || value.includes('#')) {
    return false;
  }
  const parts = value.split('/');
  return (
    !value.startsWith('/') && parts.every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

function readTrustedEvidenceFile(reference, label) {
  if (arguments_.release && !trustedEvidenceRevision) {
    errors.push(
      `${label} requires an explicit official Backend evidence revision in release mode.`
    );
    return undefined;
  }
  if (trustedEvidenceRevision && trustedEvidenceRevision !== reference.revision) {
    errors.push(`${label} revision differs from the official Backend evidence revision.`);
    return undefined;
  }
  if (!loadTrustedEvidenceTree(label)) return undefined;
  if (resolvedTrustedEvidenceRevision !== reference.revision) {
    errors.push(`${label} trusted Backend checkout is not the declared immutable revision.`);
    return undefined;
  }
  const treeEntry = resolvedTrustedEvidenceTree.get(reference.repositoryPath);
  if (!treeEntry || treeEntry.type !== 'blob' || !['100644', '100755'].includes(treeEntry.mode)) {
    errors.push(`${label} revision-bound file does not exist: ${reference.repositoryPath}.`);
    return undefined;
  }
  try {
    const bytes = readFileSync(resolve(trustedEvidenceCheckout, reference.repositoryPath));
    if (gitBlobId(bytes) !== treeEntry.objectId) {
      errors.push(`${label} working file differs from its revision-bound Git object.`);
      return undefined;
    }
    return bytes;
  } catch {
    errors.push(`${label} revision-bound file does not exist: ${reference.repositoryPath}.`);
    return undefined;
  }
}

function loadTrustedEvidenceTree(label) {
  if (resolvedTrustedEvidenceTree) return true;
  if (trustedEvidenceTreeAttempted) return false;
  trustedEvidenceTreeAttempted = true;
  try {
    const origin = execFileSync(
      'git',
      ['-C', trustedEvidenceCheckout, 'remote', 'get-url', 'origin'],
      { encoding: 'utf8' }
    ).trim();
    if (
      ![
        `https://github.com/${TRUSTED_EVIDENCE_REPOSITORY}`,
        `https://github.com/${TRUSTED_EVIDENCE_REPOSITORY}.git`,
        `git@github.com:${TRUSTED_EVIDENCE_REPOSITORY}.git`,
      ].includes(origin)
    ) {
      errors.push(`${label} trusted Backend checkout origin is not approved.`);
      return false;
    }
    resolvedTrustedEvidenceRevision = execFileSync(
      'git',
      ['-C', trustedEvidenceCheckout, 'rev-parse', 'HEAD'],
      { encoding: 'utf8' }
    ).trim();
    const entries = execFileSync(
      'git',
      ['-C', trustedEvidenceCheckout, 'ls-tree', '-r', '-z', '--full-tree', 'HEAD'],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    resolvedTrustedEvidenceTree = new Map(
      entries
        .split('\0')
        .filter(Boolean)
        .map((entry) => {
          const [metadata, repositoryPath] = entry.split('\t');
          const [mode, type, objectId] = metadata.split(' ');
          return [repositoryPath, { mode, type, objectId }];
        })
    );
    return true;
  } catch (error) {
    errors.push(`${label} trusted Backend checkout is unavailable: ${error.message}.`);
    return false;
  }
}

function gitBlobId(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function digestBytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function validateTrustedAttestation(
  attestation,
  provenance,
  evidence,
  item,
  evidenceReference,
  attestationReference
) {
  const label = `${item.id} evidence attestation`;
  const detailField = ATTESTATION_DETAIL_BY_KIND.get(provenance.kind);
  const fields = [
    'schemaVersion',
    'attestationId',
    'repository',
    'kind',
    'claim',
    'issuer',
    'recordedAt',
    'subject',
    'evidence',
    detailField,
  ];
  if (!isRecord(attestation)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  validateClosedFields(attestation, fields, label);
  if (
    attestation.schemaVersion !== 1 ||
    attestation.attestationId !== `${item.id}.${evidence.type}.v1` ||
    attestation.repository !== TRUSTED_EVIDENCE_REPOSITORY ||
    attestation.kind !== provenance.kind ||
    attestation.claim !== evidence.type ||
    attestation.issuer !== provenance.issuer ||
    attestation.recordedAt !== evidence.recordedAt
  ) {
    errors.push(`${label} identity or claim binding is invalid.`);
  }
  validateClosedFields(
    attestation.subject,
    ['readinessItemId', 'evidenceOwner'],
    `${label} subject`
  );
  if (
    attestation.subject?.readinessItemId !== item.id ||
    attestation.subject?.evidenceOwner !== evidence.owner
  ) {
    errors.push(`${label} subject does not match the readiness item and evidence owner.`);
  }
  validateClosedFields(attestation.evidence, ['path', 'checksum'], `${label} evidence`);
  if (
    attestation.evidence?.path !== evidenceReference?.repositoryPath ||
    attestation.evidence?.checksum !== evidence.checksum ||
    attestationReference?.repositoryPath === evidenceReference?.repositoryPath
  ) {
    errors.push(`${label} does not bind a distinct evidence file and checksum.`);
  }
  validateAttestationKindDetail(attestation, provenance, item, label);
  remoteEvidenceClaims.push({ attestation, evidence, item, provenance });
}

function validateAttestationKindDetail(attestation, provenance, item, label) {
  const { kind } = provenance;
  if (kind === 'OWNER_APPROVAL_ATTESTATION') {
    validateClosedFields(
      attestation.approval,
      ['approvedBy', 'approvedAt', 'sourceReference', 'headRevision'],
      `${label} approval`
    );
    if (
      !sameOrderedValues(attestation.approval?.approvedBy, item.approval?.approvedBy) ||
      attestation.approval?.approvedAt !== item.approval?.approvedAt ||
      !TRUSTED_REVIEW_URL.test(attestation.approval?.sourceReference ?? '') ||
      !/^[a-f0-9]{40}$/.test(attestation.approval?.headRevision ?? '')
    ) {
      errors.push(`${label} approval does not match the readiness approval.`);
    }
    return;
  }
  if (kind === 'REVIEWED_ARTIFACT_ATTESTATION') {
    validateClosedFields(
      attestation.artifact,
      ['reviewDecision', 'reviewer', 'sourceReference', 'headRevision'],
      `${label} artifact`
    );
    if (
      attestation.artifact?.reviewDecision !== 'APPROVED' ||
      !trustedReviewerAssignments
        .get(item.id)
        ?.artifactReviewers.includes(attestation.artifact?.reviewer) ||
      !TRUSTED_REVIEW_URL.test(attestation.artifact?.sourceReference ?? '') ||
      !/^[a-f0-9]{40}$/.test(attestation.artifact?.headRevision ?? '')
    ) {
      errors.push(`${label} artifact review must be APPROVED.`);
    }
    return;
  }
  if (kind === 'AUTOMATED_RUN_ATTESTATION') {
    validateClosedFields(
      attestation.run,
      [
        'command',
        'result',
        'passed',
        'failed',
        'workflowName',
        'workflowReference',
        'headRevision',
        'artifactDigest',
        'artifactName',
        'artifactEntryPath',
      ],
      `${label} run`
    );
    if (
      !nonBlank(attestation.run?.command) ||
      attestation.run?.result !== 'PASS' ||
      !Number.isInteger(attestation.run?.passed) ||
      attestation.run.passed < 1 ||
      attestation.run?.failed !== 0 ||
      !nonBlank(attestation.run?.workflowName) ||
      !TRUSTED_WORKFLOW_RUN_URL.test(attestation.run?.workflowReference ?? '') ||
      !/^[a-f0-9]{40}$/.test(attestation.run?.headRevision ?? '') ||
      !/^sha256:[a-f0-9]{64}$/.test(attestation.run?.artifactDigest ?? '') ||
      attestation.run?.artifactName !== `${item.id}.${provenance.claim}.v1` ||
      attestation.run?.artifactEntryPath !== attestation.evidence?.path
    ) {
      errors.push(`${label} automated run must record a passing immutable workflow result.`);
    }
    return;
  }
  if (kind === 'DEPLOYMENT_ATTESTATION') {
    validateClosedFields(
      attestation.deployment,
      ['environment', 'result', 'sourceReference', 'headRevision'],
      `${label} deployment`
    );
    if (
      trustedReleasePolicy?.status !== 'ACTIVE' ||
      attestation.deployment?.environment !==
        trustedReleasePolicy?.deploymentEnvironments.get(`${item.id}:${provenance.claim}`) ||
      attestation.deployment?.result !== 'PASS' ||
      !TRUSTED_DEPLOYMENT_URL.test(attestation.deployment?.sourceReference ?? '') ||
      !/^[a-f0-9]{40}$/.test(attestation.deployment?.headRevision ?? '')
    ) {
      errors.push(
        `${label} deployment must match the immutable environment policy and passing external source.`
      );
    }
    return;
  }
  if (kind === 'INDEPENDENT_REVIEW_ATTESTATION') {
    validateClosedFields(
      attestation.review,
      ['reviewer', 'decision', 'sourceReference', 'headRevision'],
      `${label} review`
    );
    if (
      !trustedReviewerAssignments
        .get(item.id)
        ?.independentReviewers.includes(attestation.review?.reviewer) ||
      attestation.review?.decision !== 'APPROVED' ||
      !TRUSTED_REVIEW_URL.test(attestation.review?.sourceReference ?? '') ||
      !/^[a-f0-9]{40}$/.test(attestation.review?.headRevision ?? '')
    ) {
      errors.push(`${label} independent review must record an approved external source.`);
    }
  }
}

function validateOnlineReleaseEvidence(manifestValue) {
  if (!arguments_.release) return;
  const completeIds = new Set(
    [
      ...(manifestValue.productionGates ?? []),
      ...(manifestValue.decisions ?? []),
      ...(manifestValue.products ?? []),
      ...(manifestValue.exitCriteria ?? []),
    ]
      .filter((item) => item.state === 'COMPLETE')
      .map((item) => item.id)
  );
  const claims = remoteEvidenceClaims.filter(({ item }) => completeIds.has(item.id));
  if (claims.length === 0) return;
  if (process.env.GITHUB_ACTIONS !== 'true' || !nonBlank(process.env.GH_TOKEN)) {
    errors.push(
      'COMPLETE release evidence requires online GitHub verification in the trusted release workflow.'
    );
    return;
  }
  const headRevisions = new Set(
    claims.map(
      ({ attestation, provenance }) => attestationDetail(attestation, provenance)?.headRevision
    )
  );
  const sourceRevisions = new Set(claims.map(({ provenance }) => provenance.sourceRevision));
  if (headRevisions.size !== 1 || sourceRevisions.size !== 1) {
    errors.push(
      'COMPLETE release evidence must share one attested release revision and one evidence-only successor revision.'
    );
  }
  const allowedAttestationPaths = new Set(
    claims
      .map(
        ({ provenance }) =>
          parseTrustedEvidenceReference(
            provenance.attestationReference,
            provenance.sourceRevision,
            'online evidence attestation reference'
          )?.repositoryPath
      )
      .filter(Boolean)
  );
  for (const claim of claims) validateOnlineEvidenceClaim(claim, allowedAttestationPaths);
}

function attestationDetail(attestation, provenance) {
  if (provenance.kind === 'OWNER_APPROVAL_ATTESTATION') return attestation.approval;
  if (provenance.kind === 'REVIEWED_ARTIFACT_ATTESTATION') return attestation.artifact;
  if (provenance.kind === 'AUTOMATED_RUN_ATTESTATION') return attestation.run;
  if (provenance.kind === 'DEPLOYMENT_ATTESTATION') return attestation.deployment;
  return attestation.review;
}

function githubFileAtRevision(repositoryPath, revision, label) {
  const encodedPath = repositoryPath.split('/').map(encodeURIComponent).join('/');
  const file = githubApi(
    `repos/${TRUSTED_EVIDENCE_REPOSITORY}/contents/${encodedPath}?ref=${revision}`,
    label
  );
  if (file?.type !== 'file' || file?.encoding !== 'base64' || typeof file?.content !== 'string') {
    errors.push(`${label} is not a revision-bound GitHub file.`);
    return undefined;
  }
  try {
    return Buffer.from(file.content.replace(/\s/gu, ''), 'base64');
  } catch {
    errors.push(`${label} has invalid base64 content.`);
    return undefined;
  }
}

function validateOnlineClaimSource(
  { attestation, evidence, provenance },
  label,
  allowedAttestationPaths
) {
  const detail = attestationDetail(attestation, provenance);
  const headRevision = detail?.headRevision;
  const sourceRevision = provenance.sourceRevision;
  const attestationPath = parseTrustedEvidenceReference(
    provenance.attestationReference,
    sourceRevision,
    `${label} attestation reference`
  )?.repositoryPath;
  if (!/^[a-f0-9]{40}$/u.test(headRevision ?? '')) return undefined;
  if (headRevision === sourceRevision) {
    errors.push(`${label} attestation must be recorded in a distinct evidence-only successor.`);
  } else {
    const comparison = githubApi(
      `repos/${TRUSTED_EVIDENCE_REPOSITORY}/compare/${headRevision}...${sourceRevision}`,
      `${label} source lineage`
    );
    const successorCommit = comparison?.commits?.[0];
    const changedFiles = comparison?.files ?? [];
    const changedPaths = changedFiles.map(({ filename }) => filename);
    if (
      comparison?.status !== 'ahead' ||
      comparison?.merge_base_commit?.sha !== headRevision ||
      comparison?.ahead_by !== 1 ||
      comparison?.behind_by !== 0 ||
      comparison?.total_commits !== 1 ||
      comparison?.commits?.length !== 1 ||
      successorCommit?.sha !== sourceRevision ||
      !successorCommit?.parents?.some(({ sha }) => sha === headRevision) ||
      changedPaths.length === 0 ||
      changedFiles.some(
        ({ status, previous_filename: previousFilename }) =>
          !['added', 'modified'].includes(status) || previousFilename !== undefined
      ) ||
      changedPaths.some((path) => !allowedAttestationPaths.has(path)) ||
      !changedPaths.includes(attestationPath)
    ) {
      errors.push(
        `${label} evidence revision must be the direct, attestation-only successor of the attested revision.`
      );
    }
  }
  const evidenceBytes = githubFileAtRevision(
    attestation.evidence?.path ?? '',
    headRevision,
    `${label} evidence at attested revision`
  );
  if (evidenceBytes && digestBytes(evidenceBytes) !== evidence.checksum) {
    errors.push(`${label} evidence bytes differ from the attested source revision.`);
  }
  return { detail, headRevision };
}

function validateOnlineEvidenceClaim(
  { attestation, evidence, provenance, item },
  allowedAttestationPaths
) {
  const label = `${item.id} ${provenance.claim} online evidence`;
  const source = validateOnlineClaimSource(
    { attestation, evidence, provenance, item },
    label,
    allowedAttestationPaths
  );
  if (!source) return;
  if (provenance.kind === 'AUTOMATED_RUN_ATTESTATION') {
    const match = TRUSTED_WORKFLOW_RUN_URL.exec(attestation.run?.workflowReference ?? '');
    const runId = match?.[1];
    const runAttempt = Number(match?.[2]);
    const run = githubApi(
      `repos/${TRUSTED_EVIDENCE_REPOSITORY}/actions/runs/${runId}`,
      `${label} workflow run`
    );
    if (
      attestation.run?.workflowName !== TRUSTED_AUTOMATED_WORKFLOW.name ||
      attestation.run?.command !== TRUSTED_AUTOMATED_WORKFLOW.command ||
      run?.name !== TRUSTED_AUTOMATED_WORKFLOW.name ||
      run?.path !== TRUSTED_AUTOMATED_WORKFLOW.path ||
      run?.event !== TRUSTED_AUTOMATED_WORKFLOW.event ||
      run?.head_branch !== TRUSTED_AUTOMATED_WORKFLOW.branch ||
      run?.head_sha !== attestation.run?.headRevision ||
      run?.run_attempt !== runAttempt ||
      run?.status !== 'completed' ||
      run?.conclusion !== 'success' ||
      run?.html_url !== attestation.run?.workflowReference?.replace(/\/attempts\/[1-9][0-9]*$/u, '')
    ) {
      errors.push(`${label} workflow name, head SHA or successful conclusion is not verified.`);
    }
    const workflowBytes = githubFileAtRevision(
      TRUSTED_AUTOMATED_WORKFLOW.path,
      source.headRevision,
      `${label} workflow definition`
    );
    const workflowSource = workflowBytes?.toString('utf8') ?? '';
    if (
      workflowBytes &&
      digestBytes(workflowBytes) !== trustedReleasePolicy?.automatedWorkflow?.checksum
    ) {
      errors.push(`${label} workflow bytes differ from the immutable release trust policy.`);
    }
    if (
      !workflowSource.includes(TRUSTED_AUTOMATED_WORKFLOW.command) ||
      !workflowSource.includes(`name: ${attestation.run?.artifactName}`) ||
      !workflowSource.includes(`path: ${attestation.run?.artifactEntryPath}`)
    ) {
      errors.push(`${label} workflow does not execute and upload the exact evidence claim.`);
    }
    const artifacts = githubApi(
      `repos/${TRUSTED_EVIDENCE_REPOSITORY}/actions/runs/${runId}/artifacts?per_page=100`,
      `${label} workflow artifacts`
    );
    const matchingArtifacts = (artifacts?.artifacts ?? []).filter(
      (artifact) =>
        artifact?.expired === false &&
        Number.isInteger(artifact?.id) &&
        artifact?.name === attestation.run?.artifactName &&
        artifact?.digest === attestation.run?.artifactDigest
    );
    if (matchingArtifacts.length !== 1) {
      errors.push(`${label} artifact digest is not present on the trusted workflow run.`);
    } else {
      const [artifact] = matchingArtifacts;
      const archive = githubApiBytes(
        `repos/${TRUSTED_EVIDENCE_REPOSITORY}/actions/artifacts/${artifact.id}/zip`,
        `${label} workflow artifact`
      );
      if (archive && digestBytes(archive) !== attestation.run?.artifactDigest) {
        errors.push(`${label} downloaded artifact archive differs from its GitHub digest.`);
      }
      const entry = archive
        ? readZipEntry(
            archive,
            attestation.run?.artifactEntryPath ?? '',
            `${label} workflow artifact`
          )
        : undefined;
      if (entry && digestBytes(entry) !== evidence.checksum) {
        errors.push(`${label} artifact entry bytes differ from the immutable evidence checksum.`);
      }
    }
    return;
  }
  if (provenance.kind === 'DEPLOYMENT_ATTESTATION') {
    const deploymentId = attestation.deployment?.sourceReference?.split('/deployments/')[1];
    const deployment = githubApi(
      `repos/${TRUSTED_EVIDENCE_REPOSITORY}/deployments/${deploymentId}`,
      `${label} deployment`
    );
    const statuses = githubApi(
      `repos/${TRUSTED_EVIDENCE_REPOSITORY}/deployments/${deploymentId}/statuses?per_page=100`,
      `${label} deployment statuses`
    );
    if (
      deployment?.sha !== attestation.deployment?.headRevision ||
      deployment?.ref !== 'dwp-dev' ||
      deployment?.environment !== attestation.deployment?.environment ||
      statuses?.[0]?.state !== 'success'
    ) {
      errors.push(`${label} deployment revision, environment or success status is not verified.`);
    }
    return;
  }
  const detail = source.detail;
  const pullId = detail?.sourceReference?.split('/pull/')[1];
  const pull = githubApi(
    `repos/${TRUSTED_EVIDENCE_REPOSITORY}/pulls/${pullId}`,
    `${label} pull request`
  );
  const reviews = githubApiArray(
    `repos/${TRUSTED_EVIDENCE_REPOSITORY}/pulls/${pullId}/reviews`,
    `${label} reviews`
  );
  const expectedReviewers =
    provenance.kind === 'OWNER_APPROVAL_ATTESTATION'
      ? attestation.approval?.approvedBy
      : [detail?.reviewer];
  const latestReviewByLogin = new Map();
  for (const review of reviews ?? []) {
    const login = review?.user?.login;
    if (
      !nonBlank(login) ||
      !['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review?.state)
    ) {
      continue;
    }
    const current = latestReviewByLogin.get(login);
    const currentTime = Date.parse(current?.submitted_at ?? '');
    const candidateTime = Date.parse(review?.submitted_at ?? '');
    if (
      !Number.isNaN(candidateTime) &&
      (!current ||
        Number.isNaN(currentTime) ||
        candidateTime > currentTime ||
        (candidateTime === currentTime && Number(review?.id) > Number(current?.id)))
    ) {
      latestReviewByLogin.set(login, review);
    }
  }
  const reviewersVerified = (expectedReviewers ?? []).every((reviewer) => {
    const review = latestReviewByLogin.get(reviewer);
    return (
      review?.state === 'APPROVED' &&
      review?.commit_id === pull?.head?.sha &&
      Date.parse(review?.submitted_at ?? '') <= Date.parse(pull?.merged_at ?? '')
    );
  });
  if (
    pull?.merged_at == null ||
    pull?.base?.ref !== 'dwp-dev' ||
    pull?.base?.repo?.full_name !== TRUSTED_EVIDENCE_REPOSITORY ||
    pull?.merge_commit_sha !== detail?.headRevision ||
    !reviewersVerified
  ) {
    errors.push(`${label} merged revision or required approving reviewers are not verified.`);
  }
}

function githubApiArray(endpoint, label) {
  const values = [];
  for (let page = 1; page <= 100; page += 1) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const result = githubApi(
      `${endpoint}${separator}per_page=100&page=${page}`,
      `${label} page ${page}`
    );
    if (!Array.isArray(result)) {
      errors.push(`${label} did not return a paginated array.`);
      return values;
    }
    values.push(...result);
    if (result.length < 100) return values;
  }
  errors.push(`${label} exceeds the supported pagination limit.`);
  return values;
}

function githubApiBytes(endpoint, label) {
  if (githubBytesCache.has(endpoint)) return githubBytesCache.get(endpoint);
  try {
    const value = execFileSync('gh', ['api', '--method', 'GET', endpoint], {
      encoding: null,
      env: process.env,
      maxBuffer: 50 * 1024 * 1024,
    });
    githubBytesCache.set(endpoint, value);
    return value;
  } catch (error) {
    errors.push(`${label} could not be downloaded through GitHub API: ${error.message}.`);
    return undefined;
  }
}

function readZipEntry(archive, expectedPath, label) {
  if (!Buffer.isBuffer(archive) || archive.length < 22 || !safeRepositoryPath(expectedPath)) {
    errors.push(`${label} is not a valid bounded ZIP archive entry.`);
    return undefined;
  }
  const minimumEocdOffset = Math.max(0, archive.length - 65_557);
  let eocdOffset = -1;
  for (let offset = archive.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    errors.push(`${label} has no valid ZIP central directory.`);
    return undefined;
  }
  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);
  if (entryCount < 1 || entryCount > 10_000 || centralOffset >= eocdOffset) {
    errors.push(`${label} has an invalid or oversized ZIP directory.`);
    return undefined;
  }
  const matches = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== 0x02014b50) {
      errors.push(`${label} has a malformed ZIP directory.`);
      return undefined;
    }
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > archive.length) {
      errors.push(`${label} has a truncated ZIP directory.`);
      return undefined;
    }
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (name === expectedPath) {
      matches.push({ compressedSize, flags, localOffset, method, uncompressedSize });
    }
    offset = nextOffset;
  }
  if (matches.length !== 1) {
    errors.push(`${label} must contain the exact evidence entry once.`);
    return undefined;
  }
  const [entry] = matches;
  if (
    entry.flags & 0x1 ||
    ![0, 8].includes(entry.method) ||
    entry.uncompressedSize > 10 * 1024 * 1024 ||
    entry.localOffset + 30 > archive.length ||
    archive.readUInt32LE(entry.localOffset) !== 0x04034b50
  ) {
    errors.push(`${label} evidence entry uses an unsupported ZIP encoding.`);
    return undefined;
  }
  const localNameLength = archive.readUInt16LE(entry.localOffset + 26);
  const localExtraLength = archive.readUInt16LE(entry.localOffset + 28);
  const dataOffset = entry.localOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > archive.length) {
    errors.push(`${label} evidence entry is truncated.`);
    return undefined;
  }
  try {
    const compressed = archive.subarray(dataOffset, dataEnd);
    const value = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    if (value.length !== entry.uncompressedSize) {
      errors.push(`${label} evidence entry length is invalid.`);
      return undefined;
    }
    return value;
  } catch (error) {
    errors.push(`${label} evidence entry could not be decompressed: ${error.message}.`);
    return undefined;
  }
}

function githubApi(endpoint, label) {
  if (githubJsonCache.has(endpoint)) return githubJsonCache.get(endpoint);
  try {
    const value = JSON.parse(
      execFileSync('gh', ['api', '--method', 'GET', endpoint], {
        encoding: 'utf8',
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      })
    );
    githubJsonCache.set(endpoint, value);
    return value;
  } catch (error) {
    errors.push(`${label} could not be verified through GitHub API: ${error.message}.`);
    return undefined;
  }
}

function validateEvidenceReferenceIsolation(evidenceClaims, label) {
  const typesByReference = new Map();
  const typesByAttestationReference = new Map();
  for (const claim of evidenceClaims) {
    const item = claim?.evidence ?? claim;
    const claimIdentity = claim?.itemId ? `${claim.itemId}:${item?.type}` : item?.type;
    if (!nonBlank(item?.reference) || !nonBlank(item?.type)) continue;
    const types = typesByReference.get(item.reference) ?? new Set();
    types.add(claimIdentity);
    typesByReference.set(item.reference, types);
    if (nonBlank(item.provenance?.attestationReference)) {
      const attestationTypes =
        typesByAttestationReference.get(item.provenance.attestationReference) ?? new Set();
      attestationTypes.add(claimIdentity);
      typesByAttestationReference.set(item.provenance.attestationReference, attestationTypes);
    }
  }
  for (const [reference, types] of typesByReference) {
    if (types.size > 1) {
      errors.push(
        `${label} evidence reference ${reference} is reused across distinct claims: ${[
          ...types,
        ].join(', ')}.`
      );
    }
  }
  for (const [reference, types] of typesByAttestationReference) {
    if (types.size > 1) {
      errors.push(
        `${label} evidence attestation ${reference} is reused across distinct claims: ${[
          ...types,
        ].join(', ')}.`
      );
    }
  }
}

function requireEvidenceTypes(item, expected) {
  if (!expected) return;
  if (!sameSet(item.requiredEvidenceTypes, expected)) {
    errors.push(`${item.id} requiredEvidenceTypes do not match the fixed release contract.`);
  }
}

function validateExactIds(items, expectedIds, label, select = (item) => item?.id) {
  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  const ids = items.map(select);
  if (new Set(ids).size !== ids.length) errors.push(`${label} contains duplicate IDs.`);
  const missing = expectedIds.filter((id) => !ids.includes(id));
  const unknown = ids.filter((id) => !expectedIds.includes(id));
  if (missing.length > 0) errors.push(`${label} is missing ${missing.join(', ')}.`);
  if (unknown.length > 0) errors.push(`${label} has unknown IDs ${unknown.join(', ')}.`);
}

function validateRepositoryPath(value, label) {
  if (!safeRelativePath(value)) {
    errors.push(`${label} must be a repository-relative path.`);
    return;
  }
  if (!existsSync(resolve(root, value))) errors.push(`${label} does not exist: ${value}.`);
}

function safeRelativePath(value) {
  if (!nonBlank(value) || isAbsolute(value) || value.includes('\\') || value.includes('://')) {
    return false;
  }
  const target = resolve(root, value);
  const fromRoot = relative(root, target);
  return fromRoot !== '' && !fromRoot.startsWith('..') && !isAbsolute(fromRoot);
}

function validateClosedFields(value, allowed, label) {
  if (!isRecord(value)) return;
  const unknown = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unknown.length > 0) errors.push(`${label} has unknown fields: ${unknown.join(', ')}.`);
}

function validateUnique(value, label) {
  if (!Array.isArray(value)) return;
  if (value.some((entry) => !nonBlank(entry))) errors.push(`${label} contains an empty value.`);
  if (new Set(value).size !== value.length) errors.push(`${label} contains duplicates.`);
}

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((value) => actual.includes(value))
  );
}

function sameOrderedValues(actual, expected) {
  return Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(expected);
}

function canonicalizeForChecksum(value) {
  if (Array.isArray(value)) return value.map(canonicalizeForChecksum);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalizeForChecksum(value[key])])
  );
}

function canonicalJsonForChecksum(value) {
  return JSON.stringify(canonicalizeForChecksum(value));
}

function canonicalSha256(value) {
  return createHash('sha256').update(canonicalJsonForChecksum(value)).digest('hex');
}

function readJson(path, label, targetErrors) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    targetErrors.push(`${label} is unreadable: ${error.message}`);
    return undefined;
  }
}

function parseArguments(argv) {
  const parsed = { release: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--release') {
      parsed.release = true;
      continue;
    }
    const key = {
      '--manifest': 'manifest',
      '--schema': 'schema',
      '--closure': 'closure',
      '--authorization': 'authorization',
      '--trust-policy': 'trustPolicy',
      '--root': 'root',
      '--evidence-checkout': 'evidenceCheckout',
      '--evidence-revision': 'evidenceRevision',
    }[argument];
    if (!key || !argv[index + 1] || argv[index + 1].startsWith('--')) usage();
    parsed[key] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function usage() {
  console.error(
    'usage: node scripts/check-product-surface-production-readiness.mjs ' +
      '[--manifest <path>] [--schema <path>] [--closure <path>] ' +
      '[--authorization <path>] ' +
      '[--trust-policy <path>] ' +
      '[--root <repository-root>] [--evidence-checkout <path>] ' +
      '[--evidence-revision <40-hex-sha>] [--release]'
  );
  process.exit(2);
}

function printSummary(value, incomplete, closure) {
  const all = [
    ...value.productionGates,
    ...value.decisions,
    ...value.products,
    ...value.exitCriteria,
  ];
  console.log('Product Surface production readiness evidence');
  console.log(`- manifest: ${value.manifestId}`);
  console.log(`- status: ${value.status}`);
  console.log(`- complete: ${all.length - incomplete.length}/${all.length}`);
  console.log(
    `- exact product contracts: ${closure.summary.exactProducts}/${closure.summary.productCount}`
  );
  console.log(
    `- internally closed products: ${closure.summary.internallyClosedProducts}/${closure.summary.productCount}`
  );
  console.log(
    `- owner-service PEP cells: ${closure.summary.qualifiedAttackCells}/${closure.summary.totalAttackCells}`
  );
  console.log(
    `- release-approved product closure: ${value.products.filter((item) => item.state === 'COMPLETE').length}/12`
  );
  console.log(
    `- internal evidence pending: ${all.filter((item) => item.state === 'PENDING_INTERNAL').length}`
  );
  console.log(`- incomplete release evidence: ${incomplete.length}`);
  console.log(
    `- mode: ${arguments_.release ? 'production release authorization' : 'schema and integrity only'}`
  );
}

function range(prefix, start, end) {
  return Array.from(
    { length: end - start + 1 },
    (_, index) => `${prefix}${String(start + index).padStart(2, '0')}`
  );
}

function isoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && Number.isFinite(Date.parse(value));
}

function isoDateTime(value) {
  return typeof value === 'string' && value.includes('T') && Number.isFinite(Date.parse(value));
}

function nonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
