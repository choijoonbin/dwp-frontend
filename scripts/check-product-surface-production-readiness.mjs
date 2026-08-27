#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const EXPECTED_GATE_IDS = range('G-', 2, 7);
const EXPECTED_DECISION_IDS = range('PS-', 1, 11);
const EXPECTED_EXIT_IDS = range('X-', 1, 8);
const EXPECTED_NAVIGATION_IDS = range('NC-', 1, 5);
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
const REPOSITORY_ARTIFACT_EVIDENCE_TYPES = new Set([
  'OPENAPI',
  'CONTRACT_CHECKSUM',
  'PAGE_CONTRACT',
  'DATA_CONTRACT',
  'ACTION_CONTRACT',
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

const errors = [];
const schema = readJson(schemaPath, 'Product Surface readiness schema', errors);
const manifest = readJson(manifestPath, 'Product Surface readiness manifest', errors);
if (schema && manifest) validateManifest(manifest, schema);

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
printSummary(manifest, incomplete);
if (arguments_.release && incomplete.length > 0) {
  console.error('\nProduct Surface production release is blocked by incomplete evidence:');
  incomplete.forEach((item) =>
    console.error(`- ${item.id} ${item.state}: ${item.blockers.join(', ')}`)
  );
  process.exit(2);
}
if (arguments_.release) console.log('\nProduct Surface production release gate passed.');

function validateManifest(value, schemaValue) {
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

  const allItems = [
    ...(value.productionGates ?? []),
    ...(value.decisions ?? []),
    ...(value.products ?? []),
    ...(value.exitCriteria ?? []),
  ];
  validateEvidenceReferenceIsolation(
    allItems.flatMap((item) => item?.evidence ?? []),
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
  for (const evidence of item.evidence ?? []) validateEvidence(evidence, label);
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
  } else if ((approval.approvedBy ?? []).length > 0 || approval.approvedAt !== null) {
    errors.push(`${item.id} incomplete approval must remain empty and undated.`);
  }
}

function validateEvidence(value, label) {
  if (!isRecord(value)) {
    errors.push(`${label} evidence must be an object.`);
    return;
  }
  validateClosedFields(value, EVIDENCE_FIELDS, `${label} evidence`);
  for (const field of EVIDENCE_FIELDS)
    if (!(field in value)) errors.push(`${label} evidence requires ${field}.`);
  if (!ALLOWED_EVIDENCE_TYPES.has(value.type)) errors.push(`${label} evidence type is invalid.`);
  if (!nonBlank(value.owner)) errors.push(`${label} evidence requires owner.`);
  if (!isoDateTime(value.recordedAt)) errors.push(`${label} evidence requires an ISO date-time.`);
  if (!/^sha256:[a-f0-9]{64}$/.test(value.checksum ?? '')) {
    errors.push(`${label} evidence requires an immutable sha256 checksum.`);
  }
  if (typeof value.reference !== 'string') {
    errors.push(`${label} evidence requires reference.`);
  } else if (!value.reference.startsWith('https://')) {
    if (!REPOSITORY_ARTIFACT_EVIDENCE_TYPES.has(value.type)) {
      errors.push(`${label} ${value.type} evidence requires an HTTPS evidence reference.`);
    }
    validateRepositoryPath(value.reference, `${label} evidence reference`);
    const evidencePath = resolve(root, value.reference);
    if (existsSync(evidencePath) && /^sha256:[a-f0-9]{64}$/.test(value.checksum ?? '')) {
      const actualChecksum = `sha256:${createHash('sha256')
        .update(readFileSync(evidencePath))
        .digest('hex')}`;
      if (value.checksum !== actualChecksum) {
        errors.push(`${label} evidence checksum does not match ${value.reference}.`);
      }
    }
  }
  validateEvidenceProvenance(value.provenance, value.type, label);
}

function validateEvidenceProvenance(value, evidenceType, label) {
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
  if (!nonBlank(value.issuer)) errors.push(`${label} evidence provenance requires issuer.`);
  if (!/^[a-f0-9]{40}$/.test(value.sourceRevision ?? '')) {
    errors.push(`${label} evidence provenance requires a full lowercase source revision.`);
  }
  if (!/^https:\/\/.+/.test(value.attestationReference ?? '')) {
    errors.push(`${label} evidence provenance requires an HTTPS attestation reference.`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(value.attestationChecksum ?? '')) {
    errors.push(`${label} evidence provenance requires an immutable attestation checksum.`);
  }
}

function validateEvidenceReferenceIsolation(evidence, label) {
  const typesByReference = new Map();
  const typesByAttestationReference = new Map();
  for (const item of evidence) {
    if (!nonBlank(item?.reference) || !nonBlank(item?.type)) continue;
    const types = typesByReference.get(item.reference) ?? new Set();
    types.add(item.type);
    typesByReference.set(item.reference, types);
    if (nonBlank(item.provenance?.attestationReference)) {
      const attestationTypes =
        typesByAttestationReference.get(item.provenance.attestationReference) ?? new Set();
      attestationTypes.add(item.type);
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
    const key = { '--manifest': 'manifest', '--schema': 'schema', '--root': 'root' }[argument];
    if (!key || !argv[index + 1] || argv[index + 1].startsWith('--')) usage();
    parsed[key] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function usage() {
  console.error(
    'usage: node scripts/check-product-surface-production-readiness.mjs ' +
      '[--manifest <path>] [--schema <path>] [--root <repository-root>] [--release]'
  );
  process.exit(2);
}

function printSummary(value, incomplete) {
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
    `- exact product closure: ${value.products.filter((item) => item.state === 'COMPLETE').length}/12`
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
