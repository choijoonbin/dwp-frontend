import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const schemaUrl = new URL('./widget-registry-command.v1.schema.json', import.meta.url);
const goldenUrl = new URL('./widget-registry-command.v1.golden.json', import.meta.url);
const negativeUrl = new URL('./widget-registry-command.v1.negative.json', import.meta.url);
const manifestSchemaUrl = new URL('./widget-manifest.v1.schema.json', import.meta.url);

const schemaSource = readFileSync(schemaUrl, 'utf8');
const goldenSource = readFileSync(goldenUrl, 'utf8');
const negativeSource = readFileSync(negativeUrl, 'utf8');
const manifestSchemaSource = readFileSync(manifestSchemaUrl, 'utf8');

const anchors = Object.freeze({
  schemaFile: '69bd79dc88a5a463f6fb875fc8ad138718bb36b24e247f08e7c8e94e0488ba0c',
  goldenFile: '4affb65260c736ec63b5287bf53995823d9eda046183507ca5c3f0dac024c484',
  negativeFile: '0dbc45dd0fca5c800026fdfab4dc5fb302f2e875058e514843afe3331174e288',
  positiveCommandsCanonical: '32f54c025ea9419cb8d213a055d41b1a77b3f828235f72257c23a037305514af',
  commandCatalogCanonical: '2666c4642aaac9aadf60464170a688162bfee04a6ea66a1d9bad293d325e3802',
  negativeCatalogCanonical: 'e1476e50a91d88714ffdbf1c25c51c69700a8cf49f02cbbd4f63017308145798',
});

const envelopeKeys = Object.freeze([
  'commandId',
  'commandType',
  'correlationId',
  'expectedVersion',
  'operationId',
  'operatorRef',
  'payload',
  'permissionSetHash',
  'publicIdempotencyKey',
  'publicRequestFingerprint',
  'schemaVersion',
  'sessionRef',
  'sodArtifactIds',
  'target',
]);

const trustedDefaultKeys = Object.freeze([
  'actorScope',
  'currentProviderAuthorityRevision',
  'signedActorRef',
  'signedOwnerProductKeys',
  'signedProviderAuthorityRevision',
  'signedSessionRef',
  'signedSodArtifactIds',
]);

const rawVerificationContextKeys = Object.freeze([
  'resolvedSodFacts',
  'serviceScope',
  'signedCommandId',
  'signedCommandType',
  'signedOperationId',
  'signedPayloadHash',
  'signedPermissionCodes',
  'signedPublicIdempotencyKey',
  'signedPublicRequestFingerprint',
  'signedReasonDigest',
  'signedTarget',
  'trustedCurrentTarget',
]);

const expandedVerificationContextKeys = Object.freeze(
  [...trustedDefaultKeys, ...rawVerificationContextKeys].sort()
);

const commandMatrix = Object.freeze([
  Object.freeze({
    commandType: 'CREATE_DEFINITION',
    operationId: 'createWidgetDefinition',
    branchRef: 'branchCreateDefinition',
    targetRef: 'targetDefinitionKeyHash',
    payloadRef: 'payloadDefinitionCreate',
    serviceScope: 'widget-registry.write',
    providerPermission: 'WIDGET_DEFINITION_WRITE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definitions',
    targetBinding: 'DEFINITION_KEY_HASH',
  }),
  Object.freeze({
    commandType: 'CREATE_VERSION',
    operationId: 'createWidgetDefinitionVersion',
    branchRef: 'branchCreateVersion',
    targetRef: 'targetDefinitionSemverHash',
    payloadRef: 'payloadVersionCreate',
    serviceScope: 'widget-registry.write',
    providerPermission: 'WIDGET_DEFINITION_WRITE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definitions/{definitionId}/versions',
    targetBinding: 'DEFINITION_SEMVER_HASH',
  }),
  Object.freeze({
    commandType: 'UPDATE_VERSION',
    operationId: 'updateWidgetDefinitionVersion',
    branchRef: 'branchUpdateVersion',
    targetRef: 'targetVersion',
    payloadRef: 'payloadVersionUpdate',
    serviceScope: 'widget-registry.write',
    providerPermission: 'WIDGET_DEFINITION_WRITE',
    method: 'PUT',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'VALIDATE',
    operationId: 'validateWidgetDefinitionVersion',
    branchRef: 'branchValidate',
    targetRef: 'targetVersion',
    payloadRef: 'payloadValidate',
    serviceScope: 'widget-registry.write',
    providerPermission: 'WIDGET_DEFINITION_WRITE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/validate',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'SUBMIT',
    operationId: 'submitWidgetDefinitionVersion',
    branchRef: 'branchSubmit',
    targetRef: 'targetVersion',
    payloadRef: 'payloadTransition',
    serviceScope: 'widget-registry.write',
    providerPermission: 'WIDGET_DEFINITION_WRITE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/submit',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'DECIDE',
    operationId: 'decideWidgetDefinitionVersion',
    branchRef: 'branchDecide',
    targetRef: 'targetVersion',
    payloadRef: 'payloadDecision',
    serviceScope: 'widget-registry.review',
    providerPermission: 'WIDGET_DEFINITION_REVIEW',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/decision',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'REWORK',
    operationId: 'reworkWidgetDefinitionVersion',
    branchRef: 'branchRework',
    targetRef: 'targetVersion',
    payloadRef: 'payloadRework',
    serviceScope: 'widget-registry.write',
    providerPermission: 'WIDGET_DEFINITION_WRITE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/rework',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'RECORD_EVIDENCE',
    operationId: 'recordWidgetCertificationEvidence',
    branchRef: 'branchRecordEvidence',
    targetRef: 'targetVersion',
    payloadRef: 'payloadEvidenceCreate',
    serviceScope: 'widget-registry.review',
    providerPermission: 'WIDGET_DEFINITION_REVIEW',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/evidence',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'WAIVE_EVIDENCE',
    operationId: 'waiveWidgetCertificationEvidence',
    branchRef: 'branchWaiveEvidence',
    targetRef: 'targetEvidence',
    payloadRef: 'payloadEvidenceWaiver',
    serviceScope: 'widget-registry.waive',
    providerPermission: 'WIDGET_EVIDENCE_WAIVE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/evidence/{evidenceId}/waive',
    targetBinding: 'EVIDENCE',
  }),
  Object.freeze({
    commandType: 'PUBLISH',
    operationId: 'publishWidgetDefinitionVersion',
    branchRef: 'branchPublish',
    targetRef: 'targetVersion',
    payloadRef: 'payloadPublish',
    serviceScope: 'widget-registry.release',
    providerPermission: 'WIDGET_DEFINITION_RELEASE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/publish',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'DEPRECATE',
    operationId: 'deprecateWidgetDefinitionVersion',
    branchRef: 'branchDeprecate',
    targetRef: 'targetVersion',
    payloadRef: 'payloadDeprecate',
    serviceScope: 'widget-registry.release',
    providerPermission: 'WIDGET_DEFINITION_RELEASE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/deprecate',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'QUARANTINE',
    operationId: 'quarantineWidgetDefinitionVersion',
    branchRef: 'branchQuarantine',
    targetRef: 'targetVersion',
    payloadRef: 'payloadSafetyTransition',
    serviceScope: 'widget-registry.safety',
    providerPermission: 'WIDGET_DEFINITION_REVOKE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/quarantine',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'APPROVE_QUARANTINE_CLEARANCE',
    operationId: 'approveWidgetQuarantineClearance',
    branchRef: 'branchApproveQuarantineClearance',
    targetRef: 'targetVersion',
    payloadRef: 'payloadClearanceApproval',
    serviceScope: 'widget-registry.review',
    providerPermission: 'WIDGET_DEFINITION_REVIEW',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/clear-quarantine-approvals',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'CLEAR_QUARANTINE',
    operationId: 'clearWidgetVersionQuarantine',
    branchRef: 'branchClearQuarantine',
    targetRef: 'targetVersion',
    payloadRef: 'payloadClearanceExecution',
    serviceScope: 'widget-registry.release',
    providerPermission: 'WIDGET_DEFINITION_RELEASE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/clear-quarantine',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'REVOKE',
    operationId: 'revokeWidgetDefinitionVersion',
    branchRef: 'branchRevoke',
    targetRef: 'targetVersion',
    payloadRef: 'payloadSafetyTransition',
    serviceScope: 'widget-registry.safety',
    providerPermission: 'WIDGET_DEFINITION_REVOKE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definition-versions/{versionId}/revoke',
    targetBinding: 'VERSION',
  }),
  Object.freeze({
    commandType: 'RETIRE',
    operationId: 'retireWidgetDefinition',
    branchRef: 'branchRetire',
    targetRef: 'targetDefinition',
    payloadRef: 'payloadDefinitionRetire',
    serviceScope: 'widget-registry.release',
    providerPermission: 'WIDGET_DEFINITION_RELEASE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definitions/{definitionId}/retire',
    targetBinding: 'DEFINITION',
  }),
  Object.freeze({
    commandType: 'PROMOTE',
    operationId: 'promoteWidgetReleaseChannel',
    branchRef: 'branchPromote',
    targetRef: 'targetDefinitionChannelHash',
    payloadRef: 'payloadChannelTransition',
    serviceScope: 'widget-registry.release',
    providerPermission: 'WIDGET_DEFINITION_RELEASE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definitions/{definitionId}/channels/{channel}/promote',
    targetBinding: 'DEFINITION_CHANNEL_HASH',
  }),
  Object.freeze({
    commandType: 'ROLLBACK',
    operationId: 'rollbackWidgetReleaseChannel',
    branchRef: 'branchRollback',
    targetRef: 'targetDefinitionChannelHash',
    payloadRef: 'payloadChannelRollback',
    serviceScope: 'widget-registry.release',
    providerPermission: 'WIDGET_DEFINITION_RELEASE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-definitions/{definitionId}/channels/{channel}/rollback',
    targetBinding: 'DEFINITION_CHANNEL_HASH',
  }),
  Object.freeze({
    commandType: 'DISABLE_RUNTIME_CONTROL',
    operationId: 'disableWidgetRuntimeControl',
    branchRef: 'branchDisableRuntimeControl',
    targetRef: 'targetRuntimeControlScopeHash',
    payloadRef: 'payloadRuntimeDisable',
    serviceScope: 'widget-registry.safety',
    providerPermission: 'WIDGET_DEFINITION_REVOKE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-runtime-controls/disable',
    targetBinding: 'RUNTIME_CONTROL_SCOPE_HASH',
  }),
  Object.freeze({
    commandType: 'APPROVE_RUNTIME_CONTROL_ENABLE',
    operationId: 'approveWidgetRuntimeControlEnable',
    branchRef: 'branchApproveRuntimeControlEnable',
    targetRef: 'targetRuntimeControl',
    payloadRef: 'payloadRuntimeEnableApproval',
    serviceScope: 'widget-registry.review',
    providerPermission: 'WIDGET_DEFINITION_REVIEW',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-runtime-controls/{controlId}/enable-approvals',
    targetBinding: 'RUNTIME_CONTROL',
  }),
  Object.freeze({
    commandType: 'ENABLE_RUNTIME_CONTROL',
    operationId: 'enableWidgetRuntimeControl',
    branchRef: 'branchEnableRuntimeControl',
    targetRef: 'targetRuntimeControl',
    payloadRef: 'payloadRuntimeEnable',
    serviceScope: 'widget-registry.release',
    providerPermission: 'WIDGET_DEFINITION_RELEASE',
    method: 'POST',
    pathTemplate: '/v1/admin/widget-runtime-controls/{controlId}/enable',
    targetBinding: 'RUNTIME_CONTROL',
  }),
]);

const commandByType = new Map(commandMatrix.map((entry) => [entry.commandType, entry]));
const actorHistoryRoles = Object.freeze([
  'APPROVER',
  'AUTHOR',
  'CLEARANCE_APPROVER',
  'DISABLER',
  'ENABLE_APPROVER',
  'EVIDENCE_REVIEWER',
  'QUARANTINER',
  'WAIVER_ACTOR',
]);
const sodPolicyCatalog = Object.freeze([
  Object.freeze({ commandType: 'CREATE_DEFINITION', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'CREATE_VERSION', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'UPDATE_VERSION', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'VALIDATE', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'SUBMIT', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'DECIDE', minimumArtifacts: 1, separationRoles: ['AUTHOR'] }),
  Object.freeze({ commandType: 'REWORK', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'RECORD_EVIDENCE', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({
    commandType: 'WAIVE_EVIDENCE',
    minimumArtifacts: 1,
    separationRoles: ['AUTHOR', 'EVIDENCE_REVIEWER'],
  }),
  Object.freeze({ commandType: 'PUBLISH', minimumArtifacts: 1, separationRoles: ['APPROVER'] }),
  Object.freeze({ commandType: 'DEPRECATE', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'QUARANTINE', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({
    commandType: 'APPROVE_QUARANTINE_CLEARANCE',
    minimumArtifacts: 1,
    separationRoles: ['QUARANTINER'],
  }),
  Object.freeze({
    commandType: 'CLEAR_QUARANTINE',
    minimumArtifacts: 1,
    separationRoles: ['QUARANTINER', 'CLEARANCE_APPROVER'],
  }),
  Object.freeze({ commandType: 'REVOKE', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'RETIRE', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'PROMOTE', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({ commandType: 'ROLLBACK', minimumArtifacts: 0, separationRoles: [] }),
  Object.freeze({
    commandType: 'DISABLE_RUNTIME_CONTROL',
    minimumArtifacts: 0,
    separationRoles: [],
  }),
  Object.freeze({
    commandType: 'APPROVE_RUNTIME_CONTROL_ENABLE',
    minimumArtifacts: 1,
    separationRoles: ['DISABLER'],
  }),
  Object.freeze({
    commandType: 'ENABLE_RUNTIME_CONTROL',
    minimumArtifacts: 1,
    separationRoles: ['DISABLER', 'ENABLE_APPROVER'],
  }),
]);
const sodPolicyByCommand = new Map(sodPolicyCatalog.map((entry) => [entry.commandType, entry]));
const sodVerificationInstant = '2026-08-27T10:00:30Z';
const sodVerificationEpoch = Date.parse(sodVerificationInstant);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const upperCodePattern = /^[A-Z][A-Z0-9_]{0,63}$/;
const lowerKeyPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

class ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new ContractError(code, message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assert(value.normalize('NFC') === value, 'Canonical JSON strings must be NFC.');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0),
      'Only safe non-negative integer vectors are allowed.'
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  assert(value && typeof value === 'object', 'Canonical JSON contains non-JSON data.');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`;
}

function canonicalHash(value) {
  return sha256(Buffer.from(canonicalize(value), 'utf8'));
}

function deepEqual(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function exactKeys(value, expected, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(code, `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    fail(code, `${label} keys are not closed.`);
  }
}

function assertSortedUnique(values, code, label) {
  if (!Array.isArray(values)) fail(code, `${label} must be an array.`);
  if (new Set(values).size !== values.length) fail(code, `${label} contains duplicates.`);
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] >= values[index]) fail(code, `${label} must use ascending ASCII order.`);
  }
}

function containsAsciiControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function assertOpaque(value, code, label) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    containsAsciiControlCharacter(value) ||
    value.normalize('NFC') !== value
  ) {
    fail(code, `${label} is not a valid opaque ref.`);
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function resolveJsonPointer(root, pointer) {
  return pointer
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((current, part) => current[part], root);
}

function schemaErrors(value, node, root, path, externalSchemas) {
  const errors = [];
  if (!node || typeof node !== 'object') return errors;

  if (node.$ref) {
    let referenced;
    let referencedRoot = root;
    if (node.$ref.startsWith('#/')) {
      referenced = resolveJsonPointer(root, node.$ref);
    } else {
      const [schemaId, fragment] = node.$ref.split('#');
      referencedRoot = externalSchemas.get(schemaId);
      if (!referencedRoot) return [`${path}: unresolved schema ${schemaId}`];
      referenced = fragment ? resolveJsonPointer(referencedRoot, `#${fragment}`) : referencedRoot;
    }
    errors.push(...schemaErrors(value, referenced, referencedRoot, path, externalSchemas));
  }

  if (node.oneOf) {
    const matches = node.oneOf.filter(
      (candidate) => schemaErrors(value, candidate, root, path, externalSchemas).length === 0
    ).length;
    if (matches !== 1) errors.push(`${path}: expected exactly one oneOf branch, got ${matches}`);
  }
  if (node.allOf) {
    for (const candidate of node.allOf) {
      errors.push(...schemaErrors(value, candidate, root, path, externalSchemas));
    }
  }
  if (node.not && schemaErrors(value, node.not, root, path, externalSchemas).length === 0) {
    errors.push(`${path}: matched forbidden schema`);
  }

  if (node.const !== undefined && !deepEqual(value, node.const))
    errors.push(`${path}: const mismatch`);
  if (node.enum && !node.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push(`${path}: enum mismatch`);
  }

  if (node.type) {
    const typeMatches =
      (node.type === 'object' && isPlainObject(value)) ||
      (node.type === 'array' && Array.isArray(value)) ||
      (node.type === 'string' && typeof value === 'string') ||
      (node.type === 'integer' && Number.isSafeInteger(value)) ||
      (node.type === 'number' && typeof value === 'number' && Number.isFinite(value)) ||
      (node.type === 'boolean' && typeof value === 'boolean') ||
      (node.type === 'null' && value === null);
    if (!typeMatches) return [...errors, `${path}: type ${node.type} mismatch`];
  }

  if (typeof value === 'string') {
    if (node.minLength !== undefined && [...value].length < node.minLength)
      errors.push(`${path}: too short`);
    if (node.maxLength !== undefined && [...value].length > node.maxLength)
      errors.push(`${path}: too long`);
    if (node.pattern && !new RegExp(node.pattern, 'u').test(value))
      errors.push(`${path}: pattern mismatch`);
    if (node.format === 'date-time') {
      const parsed = Date.parse(value);
      if (!Number.isFinite(parsed) || !value.endsWith('Z'))
        errors.push(`${path}: invalid date-time`);
    }
  }
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) errors.push(`${path}: below minimum`);
    if (node.maximum !== undefined && value > node.maximum) errors.push(`${path}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems)
      errors.push(`${path}: too few items`);
    if (node.maxItems !== undefined && value.length > node.maxItems)
      errors.push(`${path}: too many items`);
    if (node.uniqueItems && new Set(value.map(canonicalize)).size !== value.length) {
      errors.push(`${path}: duplicate items`);
    }
    if (node.items) {
      value.forEach((item, index) => {
        errors.push(...schemaErrors(item, node.items, root, `${path}/${index}`, externalSchemas));
      });
    }
  }
  if (isPlainObject(value)) {
    for (const required of node.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${path}: missing ${required}`);
    }
    const properties = node.properties ?? {};
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        errors.push(...schemaErrors(value[key], child, root, `${path}/${key}`, externalSchemas));
      }
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) errors.push(`${path}: unknown ${key}`);
      }
    }
  }
  return errors;
}

function publicRequestFingerprint(request, context, matrix) {
  return canonicalHash({
    method: matrix.method,
    pathTemplate: matrix.pathTemplate,
    body: request.payload,
    expectedVersion: request.expectedVersion,
    actorScope: context.actorScope,
  });
}

function permissionSetHash(context) {
  return canonicalHash({
    schemaVersion: 1,
    permissionCodes: context.signedPermissionCodes,
    ownerProductKeys: context.signedOwnerProductKeys,
    providerAuthorityRevision: context.signedProviderAuthorityRevision,
  });
}

function reasonDigest(payload) {
  return canonicalHash({ reasonCode: payload.reasonCode, reasonText: payload.reasonText });
}

function validateTargetBinding(request, matrix) {
  const { target, payload } = request;
  let expectedTargetId;
  switch (matrix.targetBinding) {
    case 'DEFINITION_KEY_HASH':
      expectedTargetId = sha256(Buffer.from(payload.definitionKey, 'utf8'));
      break;
    case 'DEFINITION_SEMVER_HASH':
      expectedTargetId = sha256(
        Buffer.from(`${target.definitionId}\n${payload.semanticVersion}`, 'utf8')
      );
      break;
    case 'VERSION':
      if (target.targetId !== target.versionId)
        fail('TARGET_BINDING', 'Version targetId must equal versionId.');
      return;
    case 'EVIDENCE':
      if (target.targetId !== target.evidenceId)
        fail('TARGET_BINDING', 'Evidence targetId must equal evidenceId.');
      return;
    case 'DEFINITION':
      if (target.targetId !== target.definitionId) {
        fail('TARGET_BINDING', 'Definition targetId must equal definitionId.');
      }
      return;
    case 'DEFINITION_CHANNEL_HASH':
      expectedTargetId = sha256(Buffer.from(`${target.definitionId}\n${target.channel}`, 'utf8'));
      break;
    case 'RUNTIME_CONTROL_SCOPE_HASH': {
      if (
        target.controlScope !== payload.scope ||
        target.runtimeTargetType !== payload.targetType ||
        target.runtimeTargetId !== payload.targetId
      ) {
        fail(
          'TARGET_BINDING',
          'Runtime control target fields must equal the public payload fields.'
        );
      }
      const normalizedId = target.runtimeTargetId ?? 'GLOBAL';
      expectedTargetId = sha256(
        Buffer.from(`${target.controlScope}\n${target.runtimeTargetType}\n${normalizedId}`, 'utf8')
      );
      break;
    }
    case 'RUNTIME_CONTROL':
      if (target.targetId !== target.controlId)
        fail('TARGET_BINDING', 'Control targetId must equal controlId.');
      return;
    default:
      fail('BRANCH_BINDING', `Unknown target binding ${matrix.targetBinding}.`);
  }
  if (target.targetId !== expectedTargetId) fail('TARGET_BINDING', 'Derived target hash mismatch.');
}

function validateOwnerAndSodAuthority(request, context) {
  const trustedTarget = context.trustedCurrentTarget;
  const resolvedFacts = context.resolvedSodFacts;
  exactKeys(
    trustedTarget,
    ['targetType', 'targetId', 'ownerProductKey', 'riskTier', 'actorHistory'],
    'FIXTURE_SHAPE',
    'trusted current target'
  );
  exactKeys(
    trustedTarget.actorHistory,
    actorHistoryRoles,
    'FIXTURE_SHAPE',
    'trusted actor history'
  );
  exactKeys(
    resolvedFacts,
    [
      'artifactState',
      'artifactIds',
      'authorityRevision',
      'currentAuthorityRevision',
      'verifiedAt',
      'validUntil',
      'targetType',
      'targetId',
      'targetOwnerProductKey',
      'separationActors',
    ],
    'FIXTURE_SHAPE',
    'resolved SoD facts'
  );
  if (
    trustedTarget.targetType !== request.target.targetType ||
    trustedTarget.targetId !== request.target.targetId ||
    resolvedFacts.targetType !== request.target.targetType ||
    resolvedFacts.targetId !== request.target.targetId
  ) {
    fail('TARGET_AUTHORITY_BINDING', 'Trusted target and SoD facts must bind the command target.');
  }
  if (
    trustedTarget.ownerProductKey !== resolvedFacts.targetOwnerProductKey ||
    !context.signedOwnerProductKeys.includes(trustedTarget.ownerProductKey)
  ) {
    fail('OWNER_SCOPE', 'Signed owner scope does not contain the current target owner.');
  }
  const payloadOwner =
    request.payload.ownerProductKey ?? request.payload.manifest?.owner?.productKey ?? null;
  if (payloadOwner !== null && payloadOwner !== trustedTarget.ownerProductKey) {
    fail('OWNER_SCOPE', 'Payload owner differs from the authoritative target owner.');
  }
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(trustedTarget.riskTier)) {
    fail('FIXTURE_SHAPE', 'Trusted target risk tier is invalid.');
  }
  for (const role of actorHistoryRoles) {
    assertOpaque(trustedTarget.actorHistory[role], 'FIXTURE_SHAPE', `actor history ${role}`);
  }

  assertSortedUnique(resolvedFacts.artifactIds, 'SORT_UNIQUE', 'resolved SoD artifactIds');
  if (
    !deepEqual(request.sodArtifactIds, resolvedFacts.artifactIds) ||
    !deepEqual(context.signedSodArtifactIds, resolvedFacts.artifactIds)
  ) {
    fail('SOD_ARTIFACT_BINDING', 'Envelope, signed claim, and resolved SoD artifacts differ.');
  }
  if (resolvedFacts.artifactState !== 'ACTIVE') {
    fail('SOD_AUTHORITY_STALE', 'Resolved SoD artifact state is not ACTIVE.');
  }
  const verifiedAtEpoch = Date.parse(resolvedFacts.verifiedAt);
  const validUntilEpoch = Date.parse(resolvedFacts.validUntil);
  if (
    resolvedFacts.authorityRevision !== resolvedFacts.currentAuthorityRevision ||
    !Number.isFinite(verifiedAtEpoch) ||
    !Number.isFinite(validUntilEpoch) ||
    verifiedAtEpoch > sodVerificationEpoch ||
    validUntilEpoch <= sodVerificationEpoch
  ) {
    fail('SOD_AUTHORITY_STALE', 'Resolved SoD authority snapshot is stale or expired.');
  }

  const policy = sodPolicyByCommand.get(request.commandType);
  if (!policy) fail('BRANCH_BINDING', 'SoD policy is missing for the command branch.');
  if (resolvedFacts.artifactIds.length < policy.minimumArtifacts) {
    fail('SOD_ARTIFACT_REQUIRED', 'The command requires a current durable SoD artifact.');
  }
  if (!Array.isArray(resolvedFacts.separationActors)) {
    fail('FIXTURE_SHAPE', 'Resolved separation actors must be an array.');
  }
  const actualRoles = [];
  for (const fact of resolvedFacts.separationActors) {
    exactKeys(fact, ['role', 'actorRef'], 'FIXTURE_SHAPE', 'resolved actor separation');
    if (!actorHistoryRoles.includes(fact.role))
      fail('FIXTURE_SHAPE', 'Unknown actor-history role.');
    if (fact.actorRef !== trustedTarget.actorHistory[fact.role]) {
      fail('SOD_ARTIFACT_BINDING', `Resolved ${fact.role} actor differs from target history.`);
    }
    actualRoles.push(fact.role);
    if (fact.actorRef === request.operatorRef) {
      fail('SOD_ACTOR_CONFLICT', `Operator must differ from prior ${fact.role}.`);
    }
  }
  assertSortedUnique(actualRoles, 'SORT_UNIQUE', 'resolved separation roles');
  if (!deepEqual(actualRoles, [...policy.separationRoles].sort())) {
    fail('SOD_ARTIFACT_REQUIRED', 'Resolved facts do not cover the branch separation policy.');
  }
}

function validateExpandedCase(expandedCase, schema, manifestSchema, externalSchemas) {
  exactKeys(
    expandedCase,
    ['caseId', 'request', 'verificationContext'],
    'FIXTURE_SHAPE',
    'expanded case'
  );
  const { request, verificationContext: context } = expandedCase;
  exactKeys(request, envelopeKeys, 'SCHEMA_VALIDATION', 'command envelope');
  exactKeys(context, expandedVerificationContextKeys, 'FIXTURE_SHAPE', 'verification context');

  const errors = schemaErrors(request, schema, schema, '$', externalSchemas);
  if (errors.length > 0) fail('SCHEMA_VALIDATION', errors.slice(0, 3).join('; '));

  const matrix = commandByType.get(request.commandType);
  if (!matrix || request.operationId !== matrix.operationId) {
    fail('BRANCH_BINDING', 'operationId and commandType are not a closed branch.');
  }
  if (request.expectedVersion !== request.payload.expectedVersion) {
    fail('EXPECTED_VERSION_BINDING', 'Envelope and payload expectedVersion differ.');
  }
  validateTargetBinding(request, matrix);

  if (!uuidPattern.test(request.commandId) || !uuidPattern.test(request.publicIdempotencyKey)) {
    fail('SCHEMA_VALIDATION', 'Command and idempotency IDs must be lowercase UUIDs.');
  }
  if (
    !sha256Pattern.test(request.publicRequestFingerprint) ||
    !sha256Pattern.test(request.permissionSetHash)
  ) {
    fail('SCHEMA_VALIDATION', 'Command hashes must be lowercase SHA-256.');
  }
  if (!upperCodePattern.test(request.payload.reasonCode)) {
    fail('SCHEMA_VALIDATION', 'reasonCode must be a closed ASCII token shape.');
  }
  if (request.payload.definitionKey && !lowerKeyPattern.test(request.payload.definitionKey)) {
    fail('SCHEMA_VALIDATION', 'definitionKey is not canonical.');
  }

  assertSortedUnique(request.sodArtifactIds, 'SORT_UNIQUE', 'envelope sodArtifactIds');
  assertSortedUnique(context.signedSodArtifactIds, 'SORT_UNIQUE', 'signed sodArtifactIds');
  assertSortedUnique(context.signedPermissionCodes, 'SORT_UNIQUE', 'signed permissionCodes');
  assertSortedUnique(context.signedOwnerProductKeys, 'SORT_UNIQUE', 'signed ownerProductKeys');
  for (const value of request.sodArtifactIds)
    assertOpaque(value, 'SCHEMA_VALIDATION', 'sodArtifactId');
  for (const value of context.signedPermissionCodes) {
    if (!upperCodePattern.test(value))
      fail('FIXTURE_SHAPE', 'Signed permission code is malformed.');
  }
  for (const value of context.signedOwnerProductKeys) {
    if (!lowerKeyPattern.test(value))
      fail('FIXTURE_SHAPE', 'Signed owner product key is malformed.');
  }

  if (context.serviceScope !== matrix.serviceScope) {
    fail('SERVICE_SCOPE', `Expected ${matrix.serviceScope}, got ${context.serviceScope}.`);
  }
  if (!context.signedPermissionCodes.includes(matrix.providerPermission)) {
    fail('REQUIRED_PERMISSION', `Missing ${matrix.providerPermission}.`);
  }
  if (context.signedProviderAuthorityRevision !== context.currentProviderAuthorityRevision) {
    fail('AUTHORITY_STALE', 'Provider authority revision is stale.');
  }

  if (
    request.operatorRef !== context.signedActorRef ||
    request.sessionRef !== context.signedSessionRef
  ) {
    fail('ACTOR_BINDING', 'Operator or session ref differs from the signed claim.');
  }
  if (!deepEqual(request.sodArtifactIds, context.signedSodArtifactIds)) {
    fail('SOD_BINDING', 'SoD artifact IDs differ from the signed claim.');
  }
  validateOwnerAndSodAuthority(request, context);
  if (
    request.commandId !== context.signedCommandId ||
    request.operationId !== context.signedOperationId ||
    request.commandType !== context.signedCommandType ||
    request.publicIdempotencyKey !== context.signedPublicIdempotencyKey ||
    !deepEqual(request.target, context.signedTarget)
  ) {
    fail('ASSERTION_BINDING', 'Signed command identity or target differs from the envelope.');
  }

  const computedFingerprint = publicRequestFingerprint(request, context, matrix);
  if (
    request.publicRequestFingerprint !== computedFingerprint ||
    context.signedPublicRequestFingerprint !== computedFingerprint
  ) {
    fail('PUBLIC_REQUEST_FINGERPRINT', 'Public request fingerprint mismatch.');
  }
  const computedPayloadHash = canonicalHash(request.payload);
  if (context.signedPayloadHash !== computedPayloadHash)
    fail('PAYLOAD_HASH', 'Signed payload hash mismatch.');
  const computedReasonDigest = reasonDigest(request.payload);
  if (context.signedReasonDigest !== computedReasonDigest) {
    fail('REASON_DIGEST', 'Signed reason digest mismatch.');
  }
  const computedPermissionSetHash = permissionSetHash(context);
  if (request.permissionSetHash !== computedPermissionSetHash) {
    fail('PERMISSION_SET_HASH', 'Permission set hash mismatch.');
  }

  if (request.payload.manifest) {
    const manifestErrors = schemaErrors(
      request.payload.manifest,
      manifestSchema,
      manifestSchema,
      '$/payload/manifest',
      externalSchemas
    );
    if (manifestErrors.length > 0) fail('SCHEMA_VALIDATION', manifestErrors.slice(0, 3).join('; '));
  }
  return { matrix, computedFingerprint };
}

function expandCase(rawCase, defaults) {
  exactKeys(rawCase, ['caseId', 'request', 'verificationContext'], 'FIXTURE_SHAPE', 'golden case');
  exactKeys(
    rawCase.verificationContext,
    rawVerificationContextKeys,
    'FIXTURE_SHAPE',
    'raw verification context'
  );
  return {
    caseId: rawCase.caseId,
    request: structuredClone(rawCase.request),
    verificationContext: {
      ...structuredClone(defaults),
      ...structuredClone(rawCase.verificationContext),
    },
  };
}

function receiptBindingKey(expandedCase) {
  const { request, verificationContext: context } = expandedCase;
  return canonicalize({
    actorRef: context.signedActorRef,
    operationId: request.operationId,
    targetType: request.target.targetType,
    targetId: request.target.targetId,
    publicIdempotencyKey: request.publicIdempotencyKey,
  });
}

function permanentCommandBinding(expandedCase) {
  const { request, verificationContext: context } = expandedCase;
  return canonicalize({
    commandId: request.commandId,
    publicRequestFingerprint: request.publicRequestFingerprint,
    actorRef: context.signedActorRef,
    operationId: request.operationId,
    commandType: request.commandType,
    target: request.target,
  });
}

function registerCase(expandedCase, receiptRegistry, commandRegistry) {
  const receiptKey = receiptBindingKey(expandedCase);
  const priorReceipt = receiptRegistry.get(receiptKey);
  if (priorReceipt) {
    if (
      priorReceipt.request.publicRequestFingerprint !==
      expandedCase.request.publicRequestFingerprint
    ) {
      fail('IDEMPOTENCY_KEY_REUSED', 'Public idempotency key was reused with another fingerprint.');
    }
    if (priorReceipt.request.commandId !== expandedCase.request.commandId) {
      fail(
        'COMMAND_BINDING_MISMATCH',
        'A completed public receipt cannot acquire a new commandId.'
      );
    }
  } else {
    receiptRegistry.set(receiptKey, expandedCase);
  }

  const commandKey = expandedCase.request.commandId;
  const binding = permanentCommandBinding(expandedCase);
  const priorCommand = commandRegistry.get(commandKey);
  if (priorCommand && priorCommand !== binding) {
    fail('COMMAND_BINDING_MISMATCH', 'Permanent commandId binding changed.');
  }
  commandRegistry.set(commandKey, binding);
}

function decodePointer(pointer) {
  if (!pointer.startsWith('/')) fail('FIXTURE_SHAPE', `Invalid mutation pointer ${pointer}.`);
  return pointer
    .slice(1)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function applyMutation(candidate, mutation) {
  const allowed = mutation.op === 'remove' ? ['op', 'path'] : ['op', 'path', 'value'];
  exactKeys(mutation, allowed, 'FIXTURE_SHAPE', 'negative mutation');
  if (!['add', 'replace', 'remove'].includes(mutation.op))
    fail('FIXTURE_SHAPE', 'Unknown mutation op.');
  const parts = decodePointer(mutation.path);
  const leaf = parts.pop();
  let parent = candidate;
  for (const part of parts) {
    if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, part)) {
      fail('FIXTURE_SHAPE', `Mutation parent ${mutation.path} does not exist.`);
    }
    parent = parent[part];
  }
  if (mutation.op === 'remove') {
    if (!Object.hasOwn(parent, leaf))
      fail('FIXTURE_SHAPE', `Mutation leaf ${mutation.path} is absent.`);
    delete parent[leaf];
  } else {
    if (mutation.op === 'replace' && !Object.hasOwn(parent, leaf)) {
      fail('FIXTURE_SHAPE', `Replacement leaf ${mutation.path} is absent.`);
    }
    parent[leaf] = structuredClone(mutation.value);
  }
}

function recomputeDerived(candidate, fields) {
  if (!fields || fields.length === 0) return;
  const matrix = commandByType.get(candidate.request.commandType);
  if (!matrix)
    fail('FIXTURE_SHAPE', 'Cannot recompute a derived value for an unknown command type.');
  for (const field of fields ?? []) {
    switch (field) {
      case 'publicRequestFingerprint': {
        const value = publicRequestFingerprint(
          candidate.request,
          candidate.verificationContext,
          matrix
        );
        candidate.request.publicRequestFingerprint = value;
        break;
      }
      case 'signedPublicRequestFingerprint':
        candidate.verificationContext.signedPublicRequestFingerprint = publicRequestFingerprint(
          candidate.request,
          candidate.verificationContext,
          matrix
        );
        break;
      case 'signedPayloadHash':
        candidate.verificationContext.signedPayloadHash = canonicalHash(candidate.request.payload);
        break;
      case 'signedReasonDigest':
        candidate.verificationContext.signedReasonDigest = reasonDigest(candidate.request.payload);
        break;
      case 'permissionSetHash':
        candidate.request.permissionSetHash = permissionSetHash(candidate.verificationContext);
        break;
      default:
        fail('FIXTURE_SHAPE', `Unknown derived field ${field}.`);
    }
  }
}

function pin(actual, expected, label) {
  assert(actual === expected, `${label} changed: expected ${expected}, actual ${actual}`);
}

pin(sha256(schemaSource), anchors.schemaFile, 'Registry command schema bytes');
pin(sha256(goldenSource), anchors.goldenFile, 'Registry command golden bytes');
pin(sha256(negativeSource), anchors.negativeFile, 'Registry command negative bytes');

const schema = JSON.parse(schemaSource);
const golden = JSON.parse(goldenSource);
const negative = JSON.parse(negativeSource);
const manifestSchema = JSON.parse(manifestSchemaSource);
const externalSchemas = new Map([[manifestSchema.$id, manifestSchema]]);

assert(
  schema.$id.endsWith('/widget-registry-command.v1.schema.json'),
  'Unexpected command schema ID.'
);
assert(
  schema.type === 'object' && schema.additionalProperties === false,
  'Envelope must be a closed object.'
);
assert(
  JSON.stringify([...schema.required].sort()) === JSON.stringify(envelopeKeys),
  'Envelope required keys drifted.'
);
assert(schema.oneOf.length === 21, 'Command schema must contain exactly 21 branches.');
assert(commandMatrix.length === 21, 'Independent command matrix must contain exactly 21 branches.');
assert(
  new Set(commandMatrix.map((entry) => entry.commandType)).size === 21,
  'Command types are duplicated.'
);
assert(
  new Set(commandMatrix.map((entry) => entry.operationId)).size === 21,
  'Operation IDs are duplicated.'
);
assert(sodPolicyCatalog.length === 21, 'Independent SoD policy must cover 21 command branches.');
assert(
  new Set(sodPolicyCatalog.map((entry) => entry.commandType)).size === 21 &&
    sodPolicyCatalog.every((entry) => commandByType.has(entry.commandType)),
  'SoD policy branches are missing or duplicated.'
);
for (const policy of sodPolicyCatalog) {
  assert(
    Number.isSafeInteger(policy.minimumArtifacts) && policy.minimumArtifacts >= 0,
    `${policy.commandType}: invalid minimum SoD artifact count.`
  );
  assert(
    new Set(policy.separationRoles).size === policy.separationRoles.length &&
      policy.separationRoles.every((role) => actorHistoryRoles.includes(role)),
    `${policy.commandType}: invalid actor separation policy.`
  );
}
assert(
  JSON.stringify(schema.properties.commandType.enum) ===
    JSON.stringify(commandMatrix.map((entry) => entry.commandType)),
  'Schema commandType enum differs from the independent matrix.'
);
assert(
  JSON.stringify(schema.properties.operationId.enum) ===
    JSON.stringify(commandMatrix.map((entry) => entry.operationId)),
  'Schema operationId enum differs from the independent matrix.'
);

for (const [index, matrix] of commandMatrix.entries()) {
  const schemaBranch = schema.oneOf[index];
  assert(
    schemaBranch.$ref === `#/$defs/${matrix.branchRef}`,
    `${matrix.commandType}: branch ref mismatch.`
  );
  assert(
    schemaBranch['x-dwp-requiredServiceScope'] === matrix.serviceScope,
    `${matrix.commandType}: service scope annotation mismatch.`
  );
  assert(
    schemaBranch['x-dwp-requiredProviderPermission'] === matrix.providerPermission,
    `${matrix.commandType}: Provider permission annotation mismatch.`
  );
  const branch = schema.$defs[matrix.branchRef];
  assert(
    branch.properties.commandType.const === matrix.commandType,
    `${matrix.commandType}: const mismatch.`
  );
  assert(
    branch.properties.operationId.const === matrix.operationId,
    `${matrix.commandType}: operation mismatch.`
  );
  assert(
    branch.properties.target.$ref === `#/$defs/${matrix.targetRef}`,
    `${matrix.commandType}: target mismatch.`
  );
  assert(
    branch.properties.payload.$ref === `#/$defs/${matrix.payloadRef}`,
    `${matrix.commandType}: payload mismatch.`
  );
  assert(
    schema.$defs[matrix.targetRef].additionalProperties === false,
    `${matrix.commandType}: target is open.`
  );
  assert(
    schema.$defs[matrix.payloadRef].additionalProperties === false,
    `${matrix.commandType}: payload is open.`
  );
}
assert(
  schema.$defs.payloadClearanceApproval.properties.reviewDecision.const === 'APPROVE' &&
    schema.$defs.payloadClearanceApproval.properties.reviewDecision.enum === undefined,
  'Quarantine clearance approval command must be approval-only.'
);

const expectedHashContract = Object.freeze({
  algorithm: 'SHA-256',
  encoding: 'UTF-8',
  canonicalization: 'RFC8785-JCS',
  publicRequestFingerprintFields: [
    'method',
    'pathTemplate',
    'body',
    'expectedVersion',
    'actorScope',
  ],
  permissionSetHashFields: [
    'schemaVersion',
    'permissionCodes',
    'ownerProductKeys',
    'providerAuthorityRevision',
  ],
  reasonDigestFields: ['reasonCode', 'reasonText'],
});
assert(
  deepEqual(schema['x-dwp-canonicalHashContracts'], expectedHashContract),
  'Canonical hash annotations drifted.'
);

exactKeys(
  golden,
  ['fixtureVersion', 'canonicalization', 'trustedContextDefaults', 'commands'],
  'FIXTURE_SHAPE',
  'golden fixture'
);
assert(golden.fixtureVersion === 1, 'Golden fixture version must be 1.');
exactKeys(golden.trustedContextDefaults, trustedDefaultKeys, 'FIXTURE_SHAPE', 'trusted defaults');
assert(
  deepEqual(golden.canonicalization, {
    algorithm: 'RFC8785-JCS',
    encoding: 'UTF-8',
    hash: 'SHA-256',
    publicRequestFingerprintInput: [
      'method',
      'pathTemplate',
      'body',
      'expectedVersion',
      'actorScope',
    ],
    permissionSetHashInput: [
      'schemaVersion',
      'permissionCodes',
      'ownerProductKeys',
      'providerAuthorityRevision',
    ],
    reasonDigestInput: ['reasonCode', 'reasonText'],
  }),
  'Golden canonicalization declaration drifted.'
);

const expandedGolden = golden.commands.map((rawCase) =>
  expandCase(rawCase, golden.trustedContextDefaults)
);
assert(
  expandedGolden.length === 21,
  'Golden fixture must contain one case for every command branch.'
);
assert(
  new Set(expandedGolden.map((entry) => entry.caseId)).size === 21,
  'Golden case IDs are duplicated.'
);
assert(
  new Set(expandedGolden.map((entry) => entry.request.commandType)).size === 21,
  'Golden command branches are missing or duplicated.'
);

const receiptRegistry = new Map();
const commandRegistry = new Map();
for (const expandedCase of expandedGolden) {
  validateExpandedCase(expandedCase, schema, manifestSchema, externalSchemas);
  registerCase(expandedCase, receiptRegistry, commandRegistry);
}

pin(
  canonicalHash(expandedGolden.map((entry) => entry.request)),
  anchors.positiveCommandsCanonical,
  'Positive command canonical digest'
);
pin(
  canonicalHash({ commandMatrix, sodPolicyCatalog, actorHistoryRoles, sodVerificationInstant }),
  anchors.commandCatalogCanonical,
  'Command catalog canonical digest'
);

exactKeys(negative, ['fixtureVersion', 'cases'], 'FIXTURE_SHAPE', 'negative fixture');
assert(negative.fixtureVersion === 1, 'Negative fixture version must be 1.');
assert(Array.isArray(negative.cases) && negative.cases.length > 0, 'Negative cases are required.');
assert(
  new Set(negative.cases.map((entry) => entry.caseId)).size === negative.cases.length,
  'Negative IDs duplicate.'
);
const goldenById = new Map(expandedGolden.map((entry) => [entry.caseId, entry]));

for (const negativeCase of negative.cases) {
  const optional = [];
  if (Object.hasOwn(negativeCase, 'recomputeDerived')) optional.push('recomputeDerived');
  if (Object.hasOwn(negativeCase, 'checkAgainstGolden')) optional.push('checkAgainstGolden');
  exactKeys(
    negativeCase,
    ['caseId', 'baseCaseId', 'mutations', 'expectedError', ...optional],
    'FIXTURE_SHAPE',
    `negative ${negativeCase.caseId}`
  );
  const base = goldenById.get(negativeCase.baseCaseId);
  assert(base, `${negativeCase.caseId}: unknown base ${negativeCase.baseCaseId}.`);
  assert(
    Array.isArray(negativeCase.mutations) && negativeCase.mutations.length > 0,
    'Mutation list is empty.'
  );
  const candidate = structuredClone(base);
  for (const mutation of negativeCase.mutations) applyMutation(candidate, mutation);
  recomputeDerived(candidate, negativeCase.recomputeDerived);
  let actualError = null;
  try {
    validateExpandedCase(candidate, schema, manifestSchema, externalSchemas);
    if (negativeCase.checkAgainstGolden) {
      const replayReceipts = new Map(receiptRegistry);
      const replayCommands = new Map(commandRegistry);
      registerCase(candidate, replayReceipts, replayCommands);
    }
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    actualError = error.code;
  }
  assert(
    actualError === negativeCase.expectedError,
    `${negativeCase.caseId}: expected ${negativeCase.expectedError}, got ${actualError ?? 'PASS'}.`
  );
}

pin(
  canonicalHash(
    negative.cases.map((entry) => ({
      caseId: entry.caseId,
      baseCaseId: entry.baseCaseId,
      expectedError: entry.expectedError,
    }))
  ),
  anchors.negativeCatalogCanonical,
  'Negative catalog canonical digest'
);

console.log(
  `Widget Registry Command contract verification passed: ${commandMatrix.length} closed branches, ` +
    `${expandedGolden.length} positive vectors, ${negative.cases.length} negative mutations.`
);
