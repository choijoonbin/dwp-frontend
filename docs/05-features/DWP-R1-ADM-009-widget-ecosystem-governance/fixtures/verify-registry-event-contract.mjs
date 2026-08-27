import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ajv = require('ajv');

const schemaUrl = new URL('./widget-registry-event.v1.schema.json', import.meta.url);
const examplesUrl = new URL('./widget-registry-event.v1.examples.json', import.meta.url);
const schemaSource = readFileSync(schemaUrl, 'utf8');
const examplesSource = readFileSync(examplesUrl, 'utf8');

const anchors = Object.freeze({
  schemaFile: '575779651c58eb658a0a06b5c50514d08c6d2406a676102b5e8cd0311e2d911b',
  examplesFile: 'e5775ccaa9b9f90a26588ed47119abf5254e0e8fea4d88eded0e870314db9d50',
  positiveEventsCanonical: '3a0ab471b5324da1adb0bde464e3b4c73cf1e06feddf8de7eb98f04e1ed9ae34',
  eventCatalogCanonical: '45e7c68a48a90188f9ac414c18977e2c2bb1312981ad433d76806c3ff2104074',
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const occurredAtPattern =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?Z$/;
const tenantRefPattern = /^tnr_[a-z0-9_-]{16,120}$/;
const shadowAggregateRefPattern = /^agg_[a-z0-9_-]{16,120}$/;

const diffBuckets = Object.freeze([
  'STATIC_ONLY',
  'SHADOW_ONLY',
  'STATE_MISMATCH',
  'ADDABILITY_MISMATCH',
  'VERSION_UNRESOLVED',
  'BINDING_MISMATCH',
  'SAFETY_MISMATCH',
]);
const absentStateHash = '74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b';
const createdEventTypes = new Set([
  'WIDGET_DEFINITION_CREATED',
  'WIDGET_VERSION_CREATED',
  'WIDGET_EVIDENCE_RECORDED',
  'WIDGET_EVIDENCE_WAIVED',
  'WIDGET_ROLLOUT_APPROVED',
]);
const runtimeControlTransitions = Object.freeze([
  Object.freeze({
    targetType: 'GLOBAL',
    resultingState: 'DISABLED',
    reasonCode: 'GLOBAL_KILL_ENABLED',
  }),
  Object.freeze({
    targetType: 'GLOBAL',
    resultingState: 'ENABLED',
    reasonCode: 'GLOBAL_KILL_RELEASED',
  }),
  Object.freeze({
    targetType: 'DEFINITION',
    resultingState: 'DISABLED',
    reasonCode: 'DEFINITION_CONTROL_DISABLED',
  }),
  Object.freeze({
    targetType: 'DEFINITION',
    resultingState: 'ENABLED',
    reasonCode: 'DEFINITION_CONTROL_ENABLED',
  }),
  Object.freeze({
    targetType: 'VERSION',
    resultingState: 'DISABLED',
    reasonCode: 'VERSION_CONTROL_DISABLED',
  }),
  Object.freeze({
    targetType: 'VERSION',
    resultingState: 'ENABLED',
    reasonCode: 'VERSION_CONTROL_ENABLED',
  }),
]);
const rolloutStopTransitions = Object.freeze([
  Object.freeze({ stopCause: 'SAFETY_THRESHOLD', reasonCode: 'ROLLOUT_SAFETY_STOP' }),
  Object.freeze({ stopCause: 'APPROVAL_EXPIRED', reasonCode: 'ROLLOUT_APPROVAL_EXPIRED' }),
]);
const reasonCodesByEventType = new Map(
  Object.entries({
    WIDGET_DEFINITION_CREATED: ['DEFINITION_CREATE_APPROVED'],
    WIDGET_DEFINITION_RETIRED: ['DEFINITION_RETIRE_APPROVED'],
    WIDGET_VERSION_CREATED: ['VERSION_CREATE_APPROVED'],
    WIDGET_VERSION_UPDATED: ['VERSION_DRAFT_UPDATED'],
    WIDGET_VERSION_VALIDATED: ['VERSION_VALIDATION_COMPLETED'],
    WIDGET_VERSION_SUBMITTED: ['VERSION_SUBMITTED'],
    WIDGET_VERSION_APPROVED: ['VERSION_APPROVED'],
    WIDGET_VERSION_REJECTED: ['VERSION_REJECTED'],
    WIDGET_VERSION_REWORKED: ['VERSION_REWORKED'],
    WIDGET_EVIDENCE_RECORDED: ['EVIDENCE_REVIEW_COMPLETED'],
    WIDGET_EVIDENCE_WAIVED: ['EVIDENCE_WAIVER_APPROVED'],
    WIDGET_VERSION_PUBLISHED: ['VERSION_PUBLISHED'],
    WIDGET_VERSION_DEPRECATED: ['VERSION_DEPRECATED'],
    WIDGET_CHANNEL_PROMOTED: ['CHANNEL_PROMOTION_APPROVED'],
    WIDGET_CHANNEL_ROLLED_BACK: ['CHANNEL_ROLLBACK_APPROVED'],
    WIDGET_VERSION_QUARANTINED: ['SECURITY_INCIDENT'],
    WIDGET_QUARANTINE_CLEAR_APPROVED: ['QUARANTINE_CLEAR_REVIEWED'],
    WIDGET_QUARANTINE_CLEARED: ['QUARANTINE_CLEAR_EXECUTED'],
    WIDGET_VERSION_REVOKED: ['SECURITY_REVOKE'],
    WIDGET_RUNTIME_CONTROL_CHANGED: runtimeControlTransitions.map((row) => row.reasonCode),
    WIDGET_RUNTIME_CONTROL_ENABLE_APPROVED: ['RUNTIME_CONTROL_ENABLE_APPROVED'],
    TENANT_WIDGET_POLICY_PUBLISHED: ['TENANT_POLICY_APPROVED'],
    TENANT_WIDGET_POLICY_REVOKED: ['TENANT_POLICY_REVOKED'],
    TENANT_WIDGET_POLICY_ROLLED_BACK: ['TENANT_POLICY_ROLLED_BACK'],
    WIDGET_ROLLOUT_APPROVED: ['ROLLOUT_APPROVAL_RECORDED'],
    WIDGET_ROLLOUT_ACTIVATED: ['ROLLOUT_ACTIVATED'],
    WIDGET_ROLLOUT_STOPPED: rolloutStopTransitions.map((row) => row.reasonCode),
  }).map(([eventType, codes]) => [eventType, Object.freeze(codes)])
);

const commandMatrix = Object.freeze([
  Object.freeze({
    title: 'Provider definition command',
    eventTypes: Object.freeze(['WIDGET_DEFINITION_CREATED', 'WIDGET_DEFINITION_RETIRED']),
    aggregateType: 'WIDGET_DEFINITION',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/definitionTarget',
    targetKind: 'definition',
    prototype: 'command-definition',
  }),
  Object.freeze({
    title: 'Provider version command',
    eventTypes: Object.freeze([
      'WIDGET_VERSION_CREATED',
      'WIDGET_VERSION_UPDATED',
      'WIDGET_VERSION_SUBMITTED',
      'WIDGET_VERSION_APPROVED',
      'WIDGET_VERSION_REJECTED',
      'WIDGET_VERSION_REWORKED',
      'WIDGET_VERSION_PUBLISHED',
      'WIDGET_VERSION_DEPRECATED',
      'WIDGET_VERSION_QUARANTINED',
      'WIDGET_VERSION_REVOKED',
    ]),
    aggregateType: 'WIDGET_VERSION',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/versionTarget',
    targetKind: 'version',
    prototype: 'command-version',
  }),
  Object.freeze({
    title: 'Provider version validation command',
    eventTypes: Object.freeze(['WIDGET_VERSION_VALIDATED']),
    aggregateType: 'WIDGET_VERSION',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/validationTarget',
    targetKind: 'validation',
    prototype: 'command-version-validated',
  }),
  Object.freeze({
    title: 'Provider evidence record command',
    eventTypes: Object.freeze(['WIDGET_EVIDENCE_RECORDED']),
    aggregateType: 'WIDGET_EVIDENCE',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/evidenceTarget',
    targetKind: 'evidence',
    prototype: 'command-evidence-recorded',
  }),
  Object.freeze({
    title: 'Provider evidence waiver command',
    eventTypes: Object.freeze(['WIDGET_EVIDENCE_WAIVED']),
    aggregateType: 'WIDGET_EVIDENCE',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/evidenceWaiverTarget',
    targetKind: 'evidence-waiver',
    prototype: 'command-evidence-waived',
  }),
  Object.freeze({
    title: 'Provider quarantine clearance approval command',
    eventTypes: Object.freeze(['WIDGET_QUARANTINE_CLEAR_APPROVED']),
    aggregateType: 'WIDGET_VERSION',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/clearanceTarget',
    targetKind: 'clearance',
    prototype: 'command-clearance-approved',
  }),
  Object.freeze({
    title: 'Provider quarantine clearance command',
    eventTypes: Object.freeze(['WIDGET_QUARANTINE_CLEARED']),
    aggregateType: 'WIDGET_VERSION',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/clearanceTarget',
    targetKind: 'clearance',
    prototype: 'command-clearance-executed',
  }),
  Object.freeze({
    title: 'Provider release channel command',
    eventTypes: Object.freeze(['WIDGET_CHANNEL_PROMOTED', 'WIDGET_CHANNEL_ROLLED_BACK']),
    aggregateType: 'WIDGET_RELEASE_CHANNEL',
    aggregateIdRef: '#/$defs/releaseChannelAggregateId',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/releaseChannelTarget',
    targetKind: 'release-channel',
    prototype: 'command-release-channel',
  }),
  Object.freeze({
    title: 'Provider runtime control command',
    eventTypes: Object.freeze(['WIDGET_RUNTIME_CONTROL_CHANGED']),
    aggregateType: 'WIDGET_RUNTIME_CONTROL',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/runtimeControlTarget',
    targetKind: 'runtime-control',
    prototype: 'command-runtime-global',
  }),
  Object.freeze({
    title: 'Provider runtime control enable approval command',
    eventTypes: Object.freeze(['WIDGET_RUNTIME_CONTROL_ENABLE_APPROVED']),
    aggregateType: 'WIDGET_RUNTIME_CONTROL',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/providerActor',
    actorPlane: 'PROVIDER',
    targetRef: '#/$defs/runtimeControlEnableApprovalTarget',
    targetKind: 'runtime-control-enable-approval',
    prototype: 'command-runtime-enable-approved',
  }),
  Object.freeze({
    title: 'Tenant policy command',
    eventTypes: Object.freeze([
      'TENANT_WIDGET_POLICY_PUBLISHED',
      'TENANT_WIDGET_POLICY_REVOKED',
      'TENANT_WIDGET_POLICY_ROLLED_BACK',
    ]),
    aggregateType: 'TENANT_WIDGET_POLICY',
    aggregateIdRef: '#/$defs/tenantPolicyAggregateId',
    actorRef: '#/$defs/tenantActor',
    actorPlane: 'TENANT',
    targetRef: '#/$defs/tenantPolicyTarget',
    targetKind: 'tenant-policy',
    prototype: 'command-tenant-policy',
  }),
  Object.freeze({
    title: 'Deployment rollout approval command',
    eventTypes: Object.freeze(['WIDGET_ROLLOUT_APPROVED']),
    aggregateType: 'WIDGET_CATALOG_ROLLOUT_APPROVAL',
    aggregateIdRef: '#/$defs/uuid',
    actorRef: '#/$defs/deploymentControllerActor',
    actorPlane: 'DEPLOYMENT_CONTROLLER',
    targetRef: '#/$defs/rolloutApprovalTarget',
    targetKind: 'rollout-approval',
    prototype: 'command-rollout-approved',
  }),
  Object.freeze({
    title: 'Deployment rollout activation command',
    eventTypes: Object.freeze(['WIDGET_ROLLOUT_ACTIVATED']),
    aggregateType: 'WIDGET_CATALOG_ROLLOUT',
    aggregateIdConst: 'rollout:STAGING',
    actorRef: '#/$defs/deploymentControllerActor',
    actorPlane: 'DEPLOYMENT_CONTROLLER',
    targetRef: '#/$defs/rolloutActivationTarget',
    targetKind: 'rollout-activation',
    prototype: 'command-rollout-activated',
  }),
  Object.freeze({
    title: 'Deployment rollout stop command',
    eventTypes: Object.freeze(['WIDGET_ROLLOUT_STOPPED']),
    aggregateType: 'WIDGET_CATALOG_ROLLOUT',
    aggregateIdConst: 'rollout:STAGING',
    actorRef: '#/$defs/deploymentControllerActor',
    actorPlane: 'DEPLOYMENT_CONTROLLER',
    targetRef: '#/$defs/rolloutStopTarget',
    targetKind: 'rollout-stop',
    prototype: 'command-rollout-stopped',
  }),
]);

const schedulerEventTypes = Object.freeze(['WIDGET_EVIDENCE_EXPIRED']);
const shadowEventTypes = Object.freeze([
  'WIDGET_SHADOW_MISMATCH_DETECTED',
  'WIDGET_SHADOW_RECOVERED',
]);
const commandEventTypes = Object.freeze(commandMatrix.flatMap((row) => row.eventTypes));
const allEventTypes = Object.freeze([
  ...commandEventTypes,
  ...schedulerEventTypes,
  ...shadowEventTypes,
]);
const commandByEventType = new Map(
  commandMatrix.flatMap((row) => row.eventTypes.map((eventType) => [eventType, row]))
);

const projectionTypes = Object.freeze([
  'DefinitionState',
  'VersionState',
  'EvidenceDecision',
  'ReleaseChannelHead',
  'RuntimeControlHead',
  'TenantPolicyHead',
  'RolloutApproval',
  'RolloutHead',
]);
const projectionTypeByEventType = new Map([
  ...['WIDGET_DEFINITION_CREATED', 'WIDGET_DEFINITION_RETIRED'].map((eventType) => [
    eventType,
    'DefinitionState',
  ]),
  ...[
    'WIDGET_VERSION_CREATED',
    'WIDGET_VERSION_UPDATED',
    'WIDGET_VERSION_VALIDATED',
    'WIDGET_VERSION_SUBMITTED',
    'WIDGET_VERSION_APPROVED',
    'WIDGET_VERSION_REJECTED',
    'WIDGET_VERSION_REWORKED',
    'WIDGET_VERSION_PUBLISHED',
    'WIDGET_VERSION_DEPRECATED',
    'WIDGET_VERSION_QUARANTINED',
    'WIDGET_QUARANTINE_CLEAR_APPROVED',
    'WIDGET_QUARANTINE_CLEARED',
    'WIDGET_VERSION_REVOKED',
    'WIDGET_EVIDENCE_EXPIRED',
  ].map((eventType) => [eventType, 'VersionState']),
  ...['WIDGET_EVIDENCE_RECORDED', 'WIDGET_EVIDENCE_WAIVED'].map((eventType) => [
    eventType,
    'EvidenceDecision',
  ]),
  ...['WIDGET_CHANNEL_PROMOTED', 'WIDGET_CHANNEL_ROLLED_BACK'].map((eventType) => [
    eventType,
    'ReleaseChannelHead',
  ]),
  ...['WIDGET_RUNTIME_CONTROL_CHANGED', 'WIDGET_RUNTIME_CONTROL_ENABLE_APPROVED'].map(
    (eventType) => [eventType, 'RuntimeControlHead']
  ),
  ...[
    'TENANT_WIDGET_POLICY_PUBLISHED',
    'TENANT_WIDGET_POLICY_REVOKED',
    'TENANT_WIDGET_POLICY_ROLLED_BACK',
  ].map((eventType) => [eventType, 'TenantPolicyHead']),
  ['WIDGET_ROLLOUT_APPROVED', 'RolloutApproval'],
  ...['WIDGET_ROLLOUT_ACTIVATED', 'WIDGET_ROLLOUT_STOPPED'].map((eventType) => [
    eventType,
    'RolloutHead',
  ]),
]);
const projectionDefinitionByType = Object.freeze({
  DefinitionState: 'definitionStateProjection',
  VersionState: 'versionStateProjection',
  EvidenceDecision: 'evidenceDecisionProjection',
  ReleaseChannelHead: 'releaseChannelHeadProjection',
  RuntimeControlHead: 'runtimeControlHeadProjection',
  TenantPolicyHead: 'tenantPolicyHeadProjection',
  RolloutApproval: 'rolloutApprovalProjection',
  RolloutHead: 'rolloutHeadProjection',
});

const forbiddenIdentityFields = new Set([
  'tenantId',
  'userId',
  'sessionId',
  'sessionRef',
  'operatorRef',
  'actorRef',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assert(value === value.normalize('NFC'), `${path} is not NFC.`);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0),
      `${path} must be a non-negative safe integer.`
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(',')}]`;
  }
  assert(value && typeof value === 'object', `${path} is not JSON.`);
  const keys = Object.keys(value);
  for (const key of keys) assert(key === key.normalize('NFC'), `${path}.${key} key is not NFC.`);
  return `{${keys
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`)}`)
    .join(',')}}`;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function findForbiddenIdentityField(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenIdentityField(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenIdentityFields.has(key)) return key;
    const found = findForbiddenIdentityField(child);
    if (found) return found;
  }
  return null;
}

function requiredAndClosed(value, required, allowed = required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'SCHEMA_TYPE';
  for (const key of required) {
    if (!Object.hasOwn(value, key)) return `FIELD_REQUIRED:${key}`;
  }
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  return extras.length === 0 ? null : `SCHEMA_UNKNOWN_FIELD:${extras.sort()[0]}`;
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !occurredAtPattern.test(value)) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(hour, minute, second, 0);
  return (
    instant.getUTCFullYear() === year &&
    instant.getUTCMonth() === month - 1 &&
    instant.getUTCDate() === day &&
    instant.getUTCHours() === hour &&
    instant.getUTCMinutes() === minute &&
    instant.getUTCSeconds() === second
  );
}

function validateBase(event, required, allowed = required) {
  const shapeError = requiredAndClosed(event, required, allowed);
  if (shapeError) return shapeError;
  if (event.schemaVersion !== 1) return 'SCHEMA_VERSION';
  if (!uuidPattern.test(event.eventId)) return 'UUID';
  if (typeof event.aggregateType !== 'string' || typeof event.aggregateId !== 'string') {
    return 'AGGREGATE_CONTRACT';
  }
  if (!Number.isSafeInteger(event.aggregateSequence) || event.aggregateSequence < 1) {
    return 'AGGREGATE_SEQUENCE';
  }
  if (!validTimestamp(event.occurredAt)) return 'OCCURRED_AT';
  return null;
}

function validateUuidObject(value, keys) {
  return exactKeys(value, keys) && keys.every((key) => uuidPattern.test(value[key]));
}

function validateTarget(kind, target) {
  switch (kind) {
    case 'definition':
      return validateUuidObject(target, ['definitionId']);
    case 'version':
      return validateUuidObject(target, ['definitionId', 'versionId']);
    case 'validation':
      return validateUuidObject(target, ['definitionId', 'versionId', 'validationRunId']);
    case 'evidence':
      return validateUuidObject(target, ['definitionId', 'versionId', 'evidenceId']);
    case 'evidence-waiver':
      return (
        validateUuidObject(target, [
          'definitionId',
          'versionId',
          'evidenceId',
          'waivedEvidenceId',
        ]) && target.evidenceId !== target.waivedEvidenceId
      );
    case 'clearance':
      return validateUuidObject(target, [
        'definitionId',
        'versionId',
        'clearanceApprovalId',
        'quarantineEventId',
      ]);
    case 'release-channel':
      return (
        exactKeys(target, ['definitionId', 'versionId', 'channel']) &&
        uuidPattern.test(target.definitionId) &&
        uuidPattern.test(target.versionId) &&
        ['STABLE', 'PREVIEW'].includes(target.channel)
      );
    case 'runtime-control': {
      if (!target || typeof target !== 'object' || Array.isArray(target)) return false;
      if (!['DISABLED', 'ENABLED'].includes(target.resultingState)) return false;
      const enableApprovalKeys = target.resultingState === 'ENABLED' ? ['enableApprovalId'] : [];
      if (target.resultingState === 'ENABLED' && !uuidPattern.test(target.enableApprovalId)) {
        return false;
      }
      if (target.targetType === 'GLOBAL') {
        return (
          exactKeys(target, ['controlId', 'targetType', 'resultingState', ...enableApprovalKeys]) &&
          uuidPattern.test(target.controlId)
        );
      }
      if (target.targetType === 'DEFINITION') {
        return (
          exactKeys(target, [
            'controlId',
            'targetType',
            'resultingState',
            'definitionId',
            ...enableApprovalKeys,
          ]) &&
          uuidPattern.test(target.controlId) &&
          uuidPattern.test(target.definitionId)
        );
      }
      if (target.targetType === 'VERSION') {
        return (
          exactKeys(target, [
            'controlId',
            'targetType',
            'resultingState',
            'definitionId',
            'versionId',
            ...enableApprovalKeys,
          ]) &&
          uuidPattern.test(target.controlId) &&
          uuidPattern.test(target.definitionId) &&
          uuidPattern.test(target.versionId)
        );
      }
      return false;
    }
    case 'runtime-control-enable-approval':
      return validateUuidObject(target, ['controlId', 'enableApprovalId']);
    case 'tenant-policy':
      return (
        exactKeys(target, ['tenantRef', 'definitionId', 'policyRevisionId']) &&
        tenantRefPattern.test(target.tenantRef) &&
        uuidPattern.test(target.definitionId) &&
        uuidPattern.test(target.policyRevisionId)
      );
    case 'rollout-approval':
    case 'rollout-activation':
      return (
        exactKeys(target, ['environment', 'approvalId', 'approvalRevision', 'rolloutRevision']) &&
        target.environment === 'STAGING' &&
        uuidPattern.test(target.approvalId) &&
        Number.isSafeInteger(target.approvalRevision) &&
        target.approvalRevision >= 1 &&
        Number.isSafeInteger(target.rolloutRevision) &&
        target.rolloutRevision >= 1
      );
    case 'rollout-stop':
      return (
        exactKeys(target, [
          'environment',
          'rolloutRevision',
          'approvalId',
          'approvalExpiresAt',
          'stopCause',
        ]) &&
        target.environment === 'STAGING' &&
        Number.isSafeInteger(target.rolloutRevision) &&
        target.rolloutRevision >= 1 &&
        uuidPattern.test(target.approvalId) &&
        validTimestamp(target.approvalExpiresAt) &&
        ['SAFETY_THRESHOLD', 'APPROVAL_EXPIRED'].includes(target.stopCause)
      );
    default:
      return false;
  }
}

function expectedAggregateId(kind, target) {
  switch (kind) {
    case 'definition':
      return target.definitionId;
    case 'version':
    case 'validation':
    case 'clearance':
      return target.versionId;
    case 'evidence':
    case 'evidence-waiver':
      return target.evidenceId;
    case 'release-channel':
      return `channel:${target.definitionId}:${target.channel}`;
    case 'runtime-control':
    case 'runtime-control-enable-approval':
      return target.controlId;
    case 'tenant-policy':
      return `tenant-policy:${target.tenantRef}:${target.definitionId}`;
    case 'rollout-approval':
      return target.approvalId;
    case 'rollout-activation':
    case 'rollout-stop':
      return 'rollout:STAGING';
    default:
      return null;
  }
}

const commandRequired = Object.freeze([
  'schemaVersion',
  'eventId',
  'commandId',
  'eventType',
  'aggregateType',
  'aggregateId',
  'aggregateSequence',
  'occurredAt',
  'correlationId',
  'actor',
  'target',
  'reasonCode',
  'beforeHash',
  'afterHash',
]);
const commandAllowed = Object.freeze([
  ...commandRequired,
  'projectionSchemaVersion',
  'projectionType',
]);
const schedulerRequired = Object.freeze([
  'schemaVersion',
  'eventId',
  'eventType',
  'aggregateType',
  'aggregateId',
  'aggregateSequence',
  'occurredAt',
  'causeDigest',
  'target',
  'reasonCode',
  'beforeHash',
  'afterHash',
]);
const schedulerAllowed = Object.freeze([
  ...schedulerRequired,
  'projectionSchemaVersion',
  'projectionType',
]);
const shadowRequired = Object.freeze([
  'schemaVersion',
  'eventId',
  'eventType',
  'aggregateType',
  'aggregateId',
  'aggregateSequence',
  'occurredAt',
  'evaluationId',
  'target',
  'rolloutContext',
  'diffBucket',
]);

function validateCommand(event, row) {
  const baseError = validateBase(event, commandRequired, commandAllowed);
  if (baseError) return baseError;
  if (!uuidPattern.test(event.commandId) || !uuidPattern.test(event.correlationId)) return 'UUID';
  if (!sha256Pattern.test(event.beforeHash) || !sha256Pattern.test(event.afterHash))
    return 'DIGEST';
  if (!reasonCodesByEventType.get(event.eventType)?.includes(event.reasonCode))
    return 'REASON_CODE';
  if (
    !exactKeys(event.actor, ['plane', 'auditRefHash']) ||
    event.actor.plane !== row.actorPlane ||
    !sha256Pattern.test(event.actor.auditRefHash)
  ) {
    return 'ACTOR_CONTRACT';
  }
  if (event.aggregateType !== row.aggregateType) return 'AGGREGATE_CONTRACT';
  if (!validateTarget(row.targetKind, event.target)) return 'TARGET_CONTRACT';
  if (event.aggregateId !== expectedAggregateId(row.targetKind, event.target)) {
    return 'AGGREGATE_BINDING';
  }
  if (createdEventTypes.has(event.eventType) && event.beforeHash !== absentStateHash) {
    return 'BEFORE_HASH_CONTRACT';
  }
  if (createdEventTypes.has(event.eventType) && event.aggregateSequence !== 1) {
    return 'AGGREGATE_SEQUENCE';
  }
  if (event.eventType === 'WIDGET_RUNTIME_CONTROL_CHANGED') {
    const transition = runtimeControlTransitions.find(
      (row) =>
        row.targetType === event.target.targetType &&
        row.resultingState === event.target.resultingState
    );
    if (!transition || transition.reasonCode !== event.reasonCode) return 'RUNTIME_REASON_BINDING';
  }
  if (event.eventType === 'WIDGET_ROLLOUT_STOPPED') {
    const transition = rolloutStopTransitions.find(
      (row) => row.stopCause === event.target.stopCause
    );
    if (!transition || transition.reasonCode !== event.reasonCode)
      return 'ROLLOUT_STOP_REASON_BINDING';
  }
  if (event.projectionSchemaVersion !== 1) return 'PROJECTION_SCHEMA_VERSION';
  if (event.projectionType !== projectionTypeByEventType.get(event.eventType)) {
    return 'PROJECTION_TYPE_BINDING';
  }
  return null;
}

function validateScheduler(event) {
  for (const field of ['commandId', 'actor']) {
    if (Object.hasOwn(event, field)) return `FIELD_FORBIDDEN:${field}`;
  }
  const baseError = validateBase(event, schedulerRequired, schedulerAllowed);
  if (baseError) return baseError;
  if (event.aggregateType !== 'WIDGET_VERSION') return 'AGGREGATE_CONTRACT';
  if (!sha256Pattern.test(event.causeDigest)) return 'DIGEST';
  if (!sha256Pattern.test(event.beforeHash) || !sha256Pattern.test(event.afterHash))
    return 'DIGEST';
  if (event.reasonCode !== 'SYSTEM_EVIDENCE_EXPIRY') return 'REASON_CODE';
  if (!validateTarget('version', event.target)) return 'TARGET_CONTRACT';
  if (event.aggregateId !== event.target.versionId) return 'AGGREGATE_BINDING';
  if (event.projectionSchemaVersion !== 1) return 'PROJECTION_SCHEMA_VERSION';
  if (event.projectionType !== 'VersionState') return 'PROJECTION_TYPE_BINDING';
  return null;
}

function validateShadow(event) {
  for (const field of [
    'commandId',
    'actor',
    'projectionSchemaVersion',
    'projectionType',
    'beforeHash',
    'afterHash',
  ]) {
    if (Object.hasOwn(event, field)) return `FIELD_FORBIDDEN:${field}`;
  }
  const baseError = validateBase(event, shadowRequired);
  if (baseError) return baseError;
  if (event.aggregateType !== 'WIDGET_SHADOW_EVALUATION') return 'AGGREGATE_CONTRACT';
  if (!uuidPattern.test(event.evaluationId)) return 'UUID';
  if (
    !exactKeys(event.target, ['aggregateRef']) ||
    !shadowAggregateRefPattern.test(event.target.aggregateRef)
  ) {
    return 'TARGET_CONTRACT';
  }
  if (event.aggregateId !== event.target.aggregateRef) return 'AGGREGATE_BINDING';
  if (
    !exactKeys(event.rolloutContext, ['ring', 'surface', 'placementContext', 'rolloutRevision']) ||
    !['staging-bootstrap', 'staging-shadow'].includes(event.rolloutContext.ring) ||
    event.rolloutContext.surface !== 'workspace-home' ||
    !['CLASSIC_PERSONAL', 'FLOW_PERSONAL', 'FLOW_GOVERNED'].includes(
      event.rolloutContext.placementContext
    ) ||
    !Number.isSafeInteger(event.rolloutContext.rolloutRevision) ||
    event.rolloutContext.rolloutRevision < 1
  ) {
    return 'ROLLOUT_CONTEXT';
  }
  if (!diffBuckets.includes(event.diffBucket)) return 'DIFF_BUCKET';
  return null;
}

function validate(event) {
  try {
    canonicalize(event);
  } catch {
    return 'CANONICAL_JSON';
  }
  const forbidden = findForbiddenIdentityField(event);
  if (forbidden) return `RAW_IDENTITY_FIELD:${forbidden}`;
  if (!event || typeof event !== 'object' || Array.isArray(event)) return 'SCHEMA_TYPE';
  if (!Object.hasOwn(event, 'eventType')) return 'FIELD_REQUIRED:eventType';
  const commandRow = commandByEventType.get(event.eventType);
  if (commandRow) return validateCommand(event, commandRow);
  if (event.eventType === 'WIDGET_EVIDENCE_EXPIRED') return validateScheduler(event);
  if (shadowEventTypes.includes(event.eventType)) return validateShadow(event);
  return 'EVENT_TYPE';
}

function projectionIdentityBindingError(event, projection) {
  switch (event.projectionType) {
    case 'DefinitionState':
      return projection.definitionId === event.target.definitionId
        ? null
        : 'PROJECTION_TARGET_BINDING';
    case 'VersionState':
      return projection.definitionId === event.target.definitionId &&
        projection.versionId === event.target.versionId
        ? null
        : 'PROJECTION_TARGET_BINDING';
    case 'EvidenceDecision':
      return projection.evidenceId === event.target.evidenceId &&
        projection.versionId === event.target.versionId
        ? null
        : 'PROJECTION_TARGET_BINDING';
    case 'ReleaseChannelHead':
      return projection.definitionId === event.target.definitionId &&
        projection.channel === event.target.channel
        ? null
        : 'PROJECTION_TARGET_BINDING';
    case 'RuntimeControlHead': {
      if (projection.controlId !== event.target.controlId) return 'PROJECTION_TARGET_BINDING';
      if (event.eventType === 'WIDGET_RUNTIME_CONTROL_CHANGED') {
        const targetId =
          event.target.targetType === 'GLOBAL'
            ? null
            : event.target.targetType === 'DEFINITION'
              ? event.target.definitionId
              : event.target.versionId;
        if (projection.targetType !== event.target.targetType || projection.targetId !== targetId) {
          return 'PROJECTION_TARGET_BINDING';
        }
      }
      return null;
    }
    case 'TenantPolicyHead':
      return projection.tenantRef === event.target.tenantRef &&
        projection.definitionId === event.target.definitionId
        ? null
        : 'PROJECTION_TARGET_BINDING';
    case 'RolloutApproval':
      return projection.approvalId === event.target.approvalId &&
        projection.environment === event.target.environment
        ? null
        : 'PROJECTION_TARGET_BINDING';
    case 'RolloutHead':
      return projection.environment === event.target.environment
        ? null
        : 'PROJECTION_TARGET_BINDING';
    default:
      return 'PROJECTION_TYPE_BINDING';
  }
}

function projectionTargetBindingError(event, projection) {
  const identityError = projectionIdentityBindingError(event, projection);
  if (identityError) return identityError;
  switch (event.projectionType) {
    case 'TenantPolicyHead':
      return projection.headRevisionId === event.target.policyRevisionId
        ? null
        : 'PROJECTION_TARGET_BINDING';
    case 'RolloutApproval':
      return projection.approvalRevision === event.target.approvalRevision &&
        projection.rolloutRevision === event.target.rolloutRevision
        ? null
        : 'PROJECTION_TARGET_BINDING';
    case 'RolloutHead':
      return projection.rolloutRevision === event.target.rolloutRevision &&
        projection.approvalId === event.target.approvalId
        ? null
        : 'PROJECTION_TARGET_BINDING';
    default:
      return null;
  }
}

function versionQuarantineHeadBindingError(projection) {
  const hasCurrentEvent = projection.currentQuarantineEventId !== null;
  const hasCurrentRevision = projection.currentQuarantineRevision !== null;
  if (hasCurrentEvent !== hasCurrentRevision) return 'QUARANTINE_HEAD_BINDING';
  return (projection.safetyState === 'QUARANTINED') === hasCurrentEvent
    ? null
    : 'QUARANTINE_HEAD_BINDING';
}

function validateProjectionCase(testCase, projectionValidators) {
  const { event, projection } = testCase;
  if (
    !projection ||
    !exactKeys(projection, [
      'schemaVersion',
      'type',
      'source',
      'canonicalization',
      'before',
      'after',
    ])
  ) {
    return 'PROJECTION_WRAPPER_SHAPE';
  }
  if (projection.schemaVersion !== 1 || event.projectionSchemaVersion !== 1) {
    return 'PROJECTION_SCHEMA_VERSION';
  }
  if (
    projection.type !== event.projectionType ||
    projection.type !== projectionTypeByEventType.get(event.eventType)
  ) {
    return 'PROJECTION_TYPE_BINDING';
  }
  if (projection.source !== 'LOCKED_DB_ROW') return 'PROJECTION_SOURCE';
  if (projection.canonicalization !== 'RFC8785_JCS') return 'PROJECTION_CANONICALIZATION';
  const forbiddenProjectionField = findForbiddenIdentityField(projection);
  if (forbiddenProjectionField) return `RAW_IDENTITY_FIELD:${forbiddenProjectionField}`;
  if (Object.hasOwn(projection.after ?? {}, 'evidenceRef')) return 'RAW_EVIDENCE_REFERENCE';
  const projectionValidator = projectionValidators.get(projection.type);
  if (!projectionValidator || !projectionValidator(projection.after)) return 'PROJECTION_SHAPE';
  if (projection.before !== null && !projectionValidator(projection.before))
    return 'PROJECTION_SHAPE';
  if (projection.type === 'VersionState') {
    if (projection.before !== null) {
      const beforeQuarantineError = versionQuarantineHeadBindingError(projection.before);
      if (beforeQuarantineError) return beforeQuarantineError;
    }
    const afterQuarantineError = versionQuarantineHeadBindingError(projection.after);
    if (afterQuarantineError) return afterQuarantineError;
  }
  if (createdEventTypes.has(event.eventType)) {
    if (projection.before !== null) return 'CREATE_BEFORE_NOT_NULL';
    if (event.beforeHash !== absentStateHash) return 'BEFORE_HASH_CONTRACT';
  } else if (projection.before === null) {
    return 'NON_CREATE_BEFORE_NULL';
  }
  const beforeHash = sha256(Buffer.from(canonicalize(projection.before), 'utf8'));
  const afterHash = sha256(Buffer.from(canonicalize(projection.after), 'utf8'));
  if (event.beforeHash !== beforeHash) return 'BEFORE_HASH_MISMATCH';
  if (event.afterHash !== afterHash) return 'AFTER_HASH_MISMATCH';
  if (projection.before !== null) {
    const beforeIdentityError = projectionIdentityBindingError(event, projection.before);
    if (beforeIdentityError) return 'BEFORE_PROJECTION_TARGET_BINDING';
    if (
      event.eventType === 'WIDGET_RUNTIME_CONTROL_ENABLE_APPROVED' &&
      (projection.before.targetType !== projection.after.targetType ||
        projection.before.targetId !== projection.after.targetId)
    ) {
      return 'BEFORE_PROJECTION_TARGET_BINDING';
    }
  }
  const afterBindingError = projectionTargetBindingError(event, projection.after);
  if (afterBindingError) return afterBindingError;

  if (event.eventType === 'WIDGET_RUNTIME_CONTROL_ENABLE_APPROVED') {
    const approval = projection.after.latestEnableApproval;
    if (approval?.approvalId !== event.target.enableApprovalId) {
      return 'CHILD_APPROVAL_BINDING';
    }
    if (approval.controlRevision !== projection.after.controlRevision) {
      return 'CHILD_APPROVAL_REVISION_BINDING';
    }
    if (
      projection.before.latestEnableApproval !== null ||
      approval.state !== 'ACTIVE' ||
      approval.consumedAt !== null ||
      approval.consumedByCommandId !== null
    ) {
      return 'CHILD_APPROVAL_PRECONDITION';
    }
    if (Date.parse(approval.expiresAt) <= Date.parse(event.occurredAt)) {
      return 'CHILD_APPROVAL_EXPIRY_BINDING';
    }
  }
  if (
    event.eventType === 'WIDGET_RUNTIME_CONTROL_CHANGED' &&
    event.target.resultingState === 'ENABLED'
  ) {
    const beforeApproval = projection.before.latestEnableApproval;
    const afterApproval = projection.after.latestEnableApproval;
    if (
      beforeApproval?.approvalId !== event.target.enableApprovalId ||
      afterApproval?.approvalId !== event.target.enableApprovalId ||
      beforeApproval.approvalId !== afterApproval.approvalId
    ) {
      return 'CHILD_APPROVAL_BINDING';
    }
    if (
      beforeApproval.controlRevision !== projection.before.controlRevision ||
      afterApproval.controlRevision !== projection.before.controlRevision ||
      beforeApproval.controlRevision !== afterApproval.controlRevision ||
      projection.before.controlRevision !== event.aggregateSequence - 1 ||
      projection.after.controlRevision !== event.aggregateSequence
    ) {
      return 'CHILD_APPROVAL_REVISION_BINDING';
    }
    if (
      projection.before.state !== 'DISABLED' ||
      beforeApproval.state !== 'ACTIVE' ||
      beforeApproval.consumedAt !== null ||
      beforeApproval.consumedByCommandId !== null
    ) {
      return 'CHILD_APPROVAL_PRECONDITION';
    }
    if (
      projection.after.state !== 'ENABLED' ||
      afterApproval.state !== 'CONSUMED' ||
      afterApproval.consumedAt !== event.occurredAt ||
      afterApproval.consumedByCommandId !== event.commandId
    ) {
      return 'CHILD_APPROVAL_CONSUMPTION';
    }
    if (
      beforeApproval.expiresAt !== afterApproval.expiresAt ||
      Date.parse(beforeApproval.expiresAt) <= Date.parse(event.occurredAt)
    ) {
      return 'CHILD_APPROVAL_EXPIRY_BINDING';
    }
  }
  if (event.eventType === 'WIDGET_QUARANTINE_CLEAR_APPROVED') {
    const approval = projection.after.latestClearanceApproval;
    if (
      approval?.approvalId !== event.target.clearanceApprovalId ||
      approval.quarantineEventId !== event.target.quarantineEventId
    ) {
      return 'CHILD_APPROVAL_BINDING';
    }
    if (
      projection.before.currentQuarantineEventId !== event.target.quarantineEventId ||
      projection.after.currentQuarantineEventId !== event.target.quarantineEventId
    ) {
      return 'QUARANTINE_INCIDENT_BINDING';
    }
    if (
      projection.before.currentQuarantineRevision !== event.aggregateSequence - 1 ||
      projection.after.currentQuarantineRevision !== event.aggregateSequence - 1 ||
      approval.quarantineRevision !== projection.before.currentQuarantineRevision
    ) {
      return 'QUARANTINE_REVISION_BINDING';
    }
    if (
      projection.before.latestClearanceApproval !== null ||
      approval.state !== 'ACTIVE' ||
      approval.consumedAt !== null ||
      approval.consumedByCommandId !== null
    ) {
      return 'CHILD_APPROVAL_PRECONDITION';
    }
    if (Date.parse(approval.expiresAt) <= Date.parse(event.occurredAt)) {
      return 'CHILD_APPROVAL_EXPIRY_BINDING';
    }
  }
  if (event.eventType === 'WIDGET_QUARANTINE_CLEARED') {
    const beforeApproval = projection.before.latestClearanceApproval;
    const afterApproval = projection.after.latestClearanceApproval;
    if (
      beforeApproval?.approvalId !== event.target.clearanceApprovalId ||
      afterApproval?.approvalId !== event.target.clearanceApprovalId ||
      beforeApproval.approvalId !== afterApproval.approvalId ||
      beforeApproval.quarantineEventId !== event.target.quarantineEventId ||
      afterApproval.quarantineEventId !== event.target.quarantineEventId
    ) {
      return 'CHILD_APPROVAL_BINDING';
    }
    if (
      projection.before.currentQuarantineEventId !== event.target.quarantineEventId ||
      projection.after.currentQuarantineEventId !== null
    ) {
      return 'QUARANTINE_INCIDENT_BINDING';
    }
    if (
      beforeApproval.quarantineRevision !== projection.before.currentQuarantineRevision ||
      afterApproval.quarantineRevision !== projection.before.currentQuarantineRevision ||
      beforeApproval.quarantineRevision !== afterApproval.quarantineRevision ||
      projection.before.currentQuarantineRevision !== event.aggregateSequence - 2 ||
      projection.after.currentQuarantineRevision !== null ||
      projection.before.rowVersion !== event.aggregateSequence - 1 ||
      projection.after.rowVersion !== event.aggregateSequence
    ) {
      return 'QUARANTINE_REVISION_BINDING';
    }
    if (
      projection.before.safetyState !== 'QUARANTINED' ||
      beforeApproval.state !== 'ACTIVE' ||
      beforeApproval.consumedAt !== null ||
      beforeApproval.consumedByCommandId !== null
    ) {
      return 'CHILD_APPROVAL_PRECONDITION';
    }
    if (
      projection.after.safetyState !== 'CLEAR' ||
      afterApproval.state !== 'CONSUMED' ||
      afterApproval.consumedAt !== event.occurredAt ||
      afterApproval.consumedByCommandId !== event.commandId
    ) {
      return 'CHILD_APPROVAL_CONSUMPTION';
    }
    if (
      beforeApproval.expiresAt !== afterApproval.expiresAt ||
      Date.parse(beforeApproval.expiresAt) <= Date.parse(event.occurredAt)
    ) {
      return 'CHILD_APPROVAL_EXPIRY_BINDING';
    }
  }
  return null;
}

function schemaEventTypes(property) {
  if (Object.hasOwn(property, 'const')) return [property.const];
  return property.enum;
}

function localRefName(reference) {
  assert(reference.startsWith('#/$defs/'), `Non-local schema ref ${reference}.`);
  return reference.slice('#/$defs/'.length);
}

function assertLocalRefs(node, schema) {
  if (Array.isArray(node)) {
    for (const item of node) assertLocalRefs(item, schema);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (typeof node.$ref === 'string') {
    assert(
      Object.hasOwn(schema.$defs, localRefName(node.$ref)),
      `Unknown schema ref ${node.$ref}.`
    );
  }
  for (const child of Object.values(node)) assertLocalRefs(child, schema);
}

function collectDeclaredProperties(node, result = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) collectDeclaredProperties(item, result);
    return result;
  }
  if (!node || typeof node !== 'object') return result;
  if (node.properties && typeof node.properties === 'object') {
    for (const key of Object.keys(node.properties)) result.add(key);
  }
  for (const child of Object.values(node)) collectDeclaredProperties(child, result);
  return result;
}

const schema = JSON.parse(schemaSource);
const fixture = JSON.parse(examplesSource);
const schemaForValidation = structuredClone(schema);
delete schemaForValidation.$schema;
const ajv = new Ajv({ allErrors: true, schemaId: 'auto' });
const validateJsonSchema = ajv.compile(schemaForValidation);
const projectionValidators = new Map(
  projectionTypes.map((projectionType) => [
    projectionType,
    new Ajv({ allErrors: true, schemaId: 'auto' }).compile({
      $defs: structuredClone(schemaForValidation.$defs),
      $ref: `#/$defs/${projectionDefinitionByType[projectionType]}`,
    }),
  ])
);

assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'Draft must be 2020-12.');
assert(
  schema.$id.endsWith('/widget-registry-event.v1.schema.json'),
  'Unexpected registry event schema ID.'
);
assert(
  JSON.stringify(schema.oneOf) ===
    JSON.stringify([
      { $ref: '#/$defs/commandEvent' },
      { $ref: '#/$defs/evidenceExpiryEvent' },
      { $ref: '#/$defs/shadowEvaluationEvent' },
    ]),
  'Top-level oneOf must contain exactly three event families.'
);
for (const family of ['commandEvent', 'evidenceExpiryEvent', 'shadowEvaluationEvent']) {
  assert(schema.$defs[family].additionalProperties === false, `${family} must be closed.`);
}
for (const family of ['evidenceExpiryEvent', 'shadowEvaluationEvent']) {
  assert(
    !Object.hasOwn(schema.$defs[family].properties, 'commandId'),
    `${family} exposes commandId.`
  );
  assert(!Object.hasOwn(schema.$defs[family].properties, 'actor'), `${family} exposes actor.`);
}
for (const field of ['projectionSchemaVersion', 'projectionType', 'beforeHash', 'afterHash']) {
  assert(
    !Object.hasOwn(schema.$defs.shadowEvaluationEvent.properties, field),
    `shadowEvaluationEvent exposes forbidden projection field ${field}.`
  );
}
assertLocalRefs(schema, schema);
const declaredProperties = collectDeclaredProperties(schema);
for (const field of forbiddenIdentityFields) {
  assert(!declaredProperties.has(field), `Schema exposes forbidden raw identity field ${field}.`);
}
const expectedReasonCodes = [
  ...new Set([...reasonCodesByEventType.values()].flat().concat('SYSTEM_EVIDENCE_EXPIRY')),
].sort();
assert(
  JSON.stringify(schema.$defs.reasonCode.enum) === JSON.stringify(expectedReasonCodes),
  'Schema reasonCode enum differs from the closed event taxonomy.'
);
assert(
  schema.$defs.commandEvent.allOf[1].then.properties.beforeHash.const === absentStateHash,
  'CREATE absent-state hash is not fixed in the schema.'
);
assert(
  schema.$defs.commandEvent.allOf[1].then.properties.aggregateSequence.const === 1,
  'CREATE aggregate sequence is not fixed to one in the schema.'
);
assert(
  schema.$defs.commandEvent.allOf[2].oneOf.length === commandEventTypes.length,
  'Schema eventType/reasonCode binding is not exhaustive.'
);
const schemaRuntimeControlTransitions = schema.$defs.commandEvent.allOf[3].then.oneOf.map(
  (branch) => ({
    targetType: branch.properties.target.properties.targetType.const,
    resultingState: branch.properties.target.properties.resultingState.const,
    reasonCode: branch.properties.reasonCode.const,
  })
);
assert(
  canonicalize(schemaRuntimeControlTransitions) === canonicalize(runtimeControlTransitions),
  'Schema runtime target/state/reason binding is incomplete.'
);
const schemaRolloutStopTransitions = schema.$defs.commandEvent.allOf[4].then.oneOf.map(
  (branch) => ({
    stopCause: branch.properties.target.properties.stopCause.const,
    reasonCode: branch.properties.reasonCode.const,
  })
);
assert(
  canonicalize(schemaRolloutStopTransitions) === canonicalize(rolloutStopTransitions),
  'Schema rollout stop cause/reason binding is incomplete.'
);
const schemaProjectionMatrix = new Map(
  schema.$defs.commandEvent.allOf[5].oneOf.flatMap((branch) => {
    const eventTypes = branch.properties.eventType.enum ?? [branch.properties.eventType.const];
    return eventTypes.map((eventType) => [eventType, branch.properties.projectionType.const]);
  })
);
assert(
  projectionTypes.length === schema.$defs.projectionType.enum.length &&
    projectionTypes.every(
      (projectionType, index) => projectionType === schema.$defs.projectionType.enum[index]
    ),
  'Projection type enum differs from the locked V1 taxonomy.'
);
assert(
  commandEventTypes.every(
    (eventType) =>
      schemaProjectionMatrix.get(eventType) === projectionTypeByEventType.get(eventType)
  ) && schemaProjectionMatrix.size === commandEventTypes.length,
  'Schema eventType/projectionType matrix is incomplete.'
);
assert(
  schema.$defs.evidenceExpiryEvent.properties.projectionSchemaVersion.const === 1 &&
    schema.$defs.evidenceExpiryEvent.properties.projectionType.const === 'VersionState',
  'Evidence expiry projection metadata changed.'
);
const schemaReasonCodesByEventType = new Map(
  schema.$defs.commandEvent.allOf[2].oneOf.map((branch) => [
    branch.properties.eventType.const,
    branch.properties.reasonCode.enum ?? [branch.properties.reasonCode.const],
  ])
);
assert(
  [...reasonCodesByEventType].every(
    ([eventType, codes]) =>
      JSON.stringify(schemaReasonCodesByEventType.get(eventType)) === JSON.stringify(codes)
  ),
  'Schema eventType/reasonCode mapping differs from the independent taxonomy.'
);
const occurredAtSchemaPattern = new RegExp(schema.$defs.occurredAt.allOf[0].pattern);
assert(
  occurredAtSchemaPattern.test('2028-02-29T23:59:59.123456789Z') &&
    !occurredAtSchemaPattern.test('2026-02-30T00:00:00Z') &&
    !occurredAtSchemaPattern.test('2026-01-01T24:00:00Z') &&
    schema.$defs.occurredAt.allOf[1].not.pattern === '^0000-',
  'Schema occurredAt calendar contract is incomplete.'
);

const schemaCommandRows = schema.$defs.commandEvent.allOf[0].oneOf.map((row) => ({
  title: row.title,
  eventTypes: schemaEventTypes(row.properties.eventType),
  aggregateType: row.properties.aggregateType.const,
  ...(row.properties.aggregateId.$ref
    ? { aggregateIdRef: row.properties.aggregateId.$ref }
    : { aggregateIdConst: row.properties.aggregateId.const }),
  actorRef: row.properties.actor.$ref,
  targetRef: row.properties.target.$ref,
}));
const expectedSchemaCommandRows = commandMatrix.map((row) => ({
  title: row.title,
  eventTypes: [...row.eventTypes],
  aggregateType: row.aggregateType,
  ...(row.aggregateIdRef
    ? { aggregateIdRef: row.aggregateIdRef }
    : { aggregateIdConst: row.aggregateIdConst }),
  actorRef: row.actorRef,
  targetRef: row.targetRef,
}));
assert(
  canonicalize(schemaCommandRows) === canonicalize(expectedSchemaCommandRows),
  'Schema command event/aggregate/actor/target matrix is incomplete or changed.'
);

const schemaCommandEventTypes = [...schema.$defs.commandEvent.properties.eventType.enum].sort();
const expectedCommandEventTypes = [...commandEventTypes].sort();
assert(
  schemaCommandEventTypes.length === expectedCommandEventTypes.length &&
    new Set(schemaCommandEventTypes).size === expectedCommandEventTypes.length &&
    schemaCommandEventTypes.every(
      (eventType, index) => eventType === expectedCommandEventTypes[index]
    ),
  'Command event enum is incomplete or duplicated.'
);
assert(
  schema.$defs.evidenceExpiryEvent.properties.eventType.const === schedulerEventTypes[0],
  'Scheduler event type changed.'
);
assert(
  JSON.stringify(schema.$defs.shadowEvaluationEvent.properties.eventType.enum) ===
    JSON.stringify(shadowEventTypes),
  'Shadow event types changed.'
);
assert(
  JSON.stringify(schema.$defs.shadowEvaluationEvent.properties.diffBucket.enum) ===
    JSON.stringify(diffBuckets),
  'Shadow diff bucket enum changed.'
);
assert(
  allEventTypes.length === 30 && new Set(allEventTypes).size === 30,
  'Expected 30 event types.'
);

assert(
  exactKeys(fixture, ['fixtureVersion', 'positive', 'negative']),
  'Fixture root must be closed.'
);
assert(fixture.fixtureVersion === 1, 'Fixture version must be 1.');
assert(
  Array.isArray(fixture.positive) && fixture.positive.length >= 1,
  'Positive cases are required.'
);
assert(
  Array.isArray(fixture.negative) && fixture.negative.length >= 1,
  'Negative cases are required.'
);
const allCaseNames = [
  ...fixture.positive.map((testCase) => testCase.name),
  ...fixture.negative.map((testCase) => testCase.name),
];
assert(new Set(allCaseNames).size === allCaseNames.length, 'Fixture case names must be unique.');

const positiveByName = new Map();
for (const testCase of fixture.positive) {
  const isShadow = shadowEventTypes.includes(testCase.event?.eventType);
  assert(
    isShadow
      ? exactKeys(testCase, ['name', 'event'])
      : exactKeys(testCase, ['name', 'event', 'projection']),
    `${testCase.name}: positive case must be closed.`
  );
  assert(
    validateJsonSchema(testCase.event),
    `${testCase.name}: JSON Schema rejected the positive event: ${JSON.stringify(
      validateJsonSchema.errors
    )}.`
  );
  const error = validate(testCase.event);
  assert(error === null, `${testCase.name}: expected valid event, received ${error}.`);
  if (!isShadow) {
    const projectionError = validateProjectionCase(testCase, projectionValidators);
    assert(
      projectionError === null,
      `${testCase.name}: expected valid projection, received ${projectionError}.`
    );
  }
  positiveByName.set(testCase.name, testCase.event);
}

for (const row of commandMatrix) {
  const prototype = positiveByName.get(row.prototype);
  assert(prototype, `${row.title}: positive prototype ${row.prototype} is missing.`);
  for (const eventType of row.eventTypes) {
    const event = structuredClone(prototype);
    event.eventType = eventType;
    event.reasonCode = reasonCodesByEventType.get(eventType)[0];
    event.projectionType = projectionTypeByEventType.get(eventType);
    event.beforeHash = createdEventTypes.has(eventType)
      ? absentStateHash
      : 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    if (createdEventTypes.has(eventType)) event.aggregateSequence = 1;
    const error = validate(event);
    assert(error === null, `${eventType}: exhaustive matrix validation failed with ${error}.`);
  }
}
for (const eventType of [...schedulerEventTypes, ...shadowEventTypes]) {
  assert(
    fixture.positive.some((testCase) => testCase.event.eventType === eventType),
    `${eventType}: positive example is missing.`
  );
}
for (const eventType of [
  'WIDGET_VERSION_UPDATED',
  'WIDGET_VERSION_VALIDATED',
  'WIDGET_RUNTIME_CONTROL_ENABLE_APPROVED',
]) {
  assert(
    fixture.positive.some((testCase) => testCase.event.eventType === eventType),
    `${eventType}: explicit positive example is missing.`
  );
}

for (const testCase of fixture.negative) {
  assert(
    exactKeys(testCase, ['name', 'expectedError', 'event']) ||
      exactKeys(testCase, ['name', 'expectedError', 'event', 'projection']),
    `${testCase.name}: negative case must be closed.`
  );
  const eventError = validate(testCase.event);
  const error = eventError ?? validateProjectionCase(testCase, projectionValidators);
  assert(
    error === testCase.expectedError,
    `${testCase.name}: expected ${testCase.expectedError}, received ${error ?? 'VALID'}.`
  );
  assert(
    !validateJsonSchema(testCase.event) || error !== null,
    `${testCase.name}: schema and independent projection validation accepted a negative case.`
  );
}

const catalogContract = Object.freeze({
  schemaVersion: 1,
  command: commandMatrix.map((row) => ({
    eventTypes: [...row.eventTypes],
    aggregateType: row.aggregateType,
    actorPlane: row.actorPlane,
    targetKind: row.targetKind,
  })),
  scheduler: schedulerEventTypes,
  shadow: shadowEventTypes,
  diffBuckets,
  absentStateHash,
  createdAggregateSequence: 1,
  createdEventTypes: [...createdEventTypes],
  runtimeControlTransitions,
  rolloutStopTransitions,
  reasonCodesByEventType: Object.fromEntries(reasonCodesByEventType),
  projectionSchemaVersion: 1,
  projectionSource: 'LOCKED_DB_ROW',
  projectionCanonicalization: 'RFC8785_JCS',
  projectionTypes,
  projectionTypeByEventType: Object.fromEntries(projectionTypeByEventType),
});
const actualAnchors = Object.freeze({
  schemaFile: sha256(schemaSource),
  examplesFile: sha256(examplesSource),
  positiveEventsCanonical: sha256(Buffer.from(canonicalize(fixture.positive), 'utf8')),
  eventCatalogCanonical: sha256(Buffer.from(canonicalize(catalogContract), 'utf8')),
});

if (process.argv.includes('--print-anchors')) {
  process.stdout.write(`${JSON.stringify(actualAnchors, null, 2)}\n`);
  process.exit(0);
}

for (const [name, expected] of Object.entries(anchors)) {
  assert(
    actualAnchors[name] === expected,
    `${name} anchor changed: received ${actualAnchors[name]}.`
  );
}

for (const [name, value] of Object.entries(actualAnchors)) {
  process.stdout.write(`${name} ${value}\n`);
}
process.stdout.write(`eventTypes ${allEventTypes.length}\n`);
process.stdout.write(`positive ${fixture.positive.length}\n`);
process.stdout.write(`negative ${fixture.negative.length}\n`);
process.stdout.write('registry-event-contract ok\n');
