import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const fixtureUrl = new URL('./widget-registry-event.v1.examples.json', import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, 'utf8'));
const quarantineEventId = '65000000-0000-4000-8000-000000000001';
const runtimeEnableApprovalIds = Object.freeze({
  GLOBAL: '71000000-0000-4000-8000-000000000002',
  DEFINITION: '71000000-0000-4000-8000-000000000003',
  VERSION: '71000000-0000-4000-8000-000000000004',
});

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

const createdEventTypes = new Set([
  'WIDGET_DEFINITION_CREATED',
  'WIDGET_VERSION_CREATED',
  'WIDGET_EVIDENCE_RECORDED',
  'WIDGET_EVIDENCE_WAIVED',
  'WIDGET_ROLLOUT_APPROVED',
]);

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`;
}

function digest(value) {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function versionProjection(event, phase) {
  const isBefore = phase === 'before';
  const eventType = event.eventType;
  const projection = {
    definitionId: event.target.definitionId,
    versionId: event.target.versionId,
    workflowState: 'APPROVED',
    releaseState: 'PUBLISHED',
    safetyState: 'CLEAR',
    currentQuarantineEventId: null,
    currentQuarantineRevision: null,
    validationRunId: null,
    latestClearanceApproval: null,
    rowVersion: isBefore ? Math.max(1, event.aggregateSequence - 1) : event.aggregateSequence,
  };
  const transitions = {
    WIDGET_VERSION_CREATED: ['DRAFT', 'DRAFT', 'UNPUBLISHED', 'UNPUBLISHED'],
    WIDGET_VERSION_UPDATED: ['DRAFT', 'DRAFT', 'UNPUBLISHED', 'UNPUBLISHED'],
    WIDGET_VERSION_VALIDATED: ['DRAFT', 'DRAFT', 'UNPUBLISHED', 'UNPUBLISHED'],
    WIDGET_VERSION_SUBMITTED: ['DRAFT', 'SUBMITTED', 'UNPUBLISHED', 'UNPUBLISHED'],
    WIDGET_VERSION_APPROVED: ['SUBMITTED', 'APPROVED', 'UNPUBLISHED', 'UNPUBLISHED'],
    WIDGET_VERSION_REJECTED: ['SUBMITTED', 'REJECTED', 'UNPUBLISHED', 'UNPUBLISHED'],
    WIDGET_VERSION_REWORKED: ['REJECTED', 'DRAFT', 'UNPUBLISHED', 'UNPUBLISHED'],
    WIDGET_VERSION_PUBLISHED: ['APPROVED', 'APPROVED', 'UNPUBLISHED', 'PUBLISHED'],
    WIDGET_VERSION_DEPRECATED: ['APPROVED', 'APPROVED', 'PUBLISHED', 'DEPRECATED'],
    WIDGET_VERSION_QUARANTINED: ['APPROVED', 'APPROVED', 'PUBLISHED', 'PUBLISHED'],
    WIDGET_QUARANTINE_CLEAR_APPROVED: ['APPROVED', 'APPROVED', 'PUBLISHED', 'PUBLISHED'],
    WIDGET_QUARANTINE_CLEARED: ['APPROVED', 'APPROVED', 'PUBLISHED', 'PUBLISHED'],
    WIDGET_VERSION_REVOKED: ['APPROVED', 'APPROVED', 'PUBLISHED', 'REVOKED'],
    WIDGET_EVIDENCE_EXPIRED: ['APPROVED', 'APPROVED', 'PUBLISHED', 'PUBLISHED'],
  };
  const [beforeWorkflow, afterWorkflow, beforeRelease, afterRelease] = transitions[eventType];
  projection.workflowState = isBefore ? beforeWorkflow : afterWorkflow;
  projection.releaseState = isBefore ? beforeRelease : afterRelease;
  if (eventType === 'WIDGET_VERSION_VALIDATED' && !isBefore) {
    projection.validationRunId = event.target.validationRunId;
  }
  if (['WIDGET_VERSION_QUARANTINED', 'WIDGET_EVIDENCE_EXPIRED'].includes(eventType)) {
    projection.safetyState = isBefore ? 'CLEAR' : 'QUARANTINED';
    projection.currentQuarantineEventId = isBefore ? null : event.eventId;
    projection.currentQuarantineRevision = isBefore ? null : event.aggregateSequence;
  }
  if (eventType === 'WIDGET_QUARANTINE_CLEAR_APPROVED') {
    projection.safetyState = 'QUARANTINED';
    projection.currentQuarantineEventId = event.target.quarantineEventId;
    projection.currentQuarantineRevision = event.aggregateSequence - 1;
    if (!isBefore) {
      projection.latestClearanceApproval = {
        approvalId: event.target.clearanceApprovalId,
        quarantineEventId: event.target.quarantineEventId,
        quarantineRevision: event.aggregateSequence - 1,
        state: 'ACTIVE',
        expiresAt: '2026-08-27T05:30:05Z',
        consumedAt: null,
        consumedByCommandId: null,
      };
    }
  }
  if (eventType === 'WIDGET_QUARANTINE_CLEARED') {
    projection.safetyState = isBefore ? 'QUARANTINED' : 'CLEAR';
    projection.currentQuarantineEventId = isBefore ? event.target.quarantineEventId : null;
    projection.currentQuarantineRevision = isBefore ? event.aggregateSequence - 2 : null;
    projection.latestClearanceApproval = {
      approvalId: event.target.clearanceApprovalId,
      quarantineEventId: event.target.quarantineEventId,
      quarantineRevision: event.aggregateSequence - 2,
      state: isBefore ? 'ACTIVE' : 'CONSUMED',
      expiresAt: '2026-08-27T05:30:05Z',
      consumedAt: isBefore ? null : event.occurredAt,
      consumedByCommandId: isBefore ? null : event.commandId,
    };
  }
  return projection;
}

function runtimeTarget(event) {
  if (event.target.targetType === 'GLOBAL') return null;
  if (event.target.targetType === 'DEFINITION') return event.target.definitionId;
  return event.target.versionId;
}

function projectionPair(event, projectionType) {
  const beforeVersion = Math.max(1, event.aggregateSequence - 1);
  switch (projectionType) {
    case 'DefinitionState':
      return {
        before: createdEventTypes.has(event.eventType)
          ? null
          : { definitionId: event.target.definitionId, state: 'ACTIVE', rowVersion: beforeVersion },
        after: {
          definitionId: event.target.definitionId,
          state: event.eventType === 'WIDGET_DEFINITION_RETIRED' ? 'RETIRED' : 'ACTIVE',
          rowVersion: event.aggregateSequence,
        },
      };
    case 'VersionState':
      return {
        before: createdEventTypes.has(event.eventType) ? null : versionProjection(event, 'before'),
        after: versionProjection(event, 'after'),
      };
    case 'EvidenceDecision':
      return {
        before: null,
        after: {
          evidenceId: event.target.evidenceId,
          versionId: event.target.versionId,
          evidenceType: 'PERFORMANCE',
          status: event.eventType === 'WIDGET_EVIDENCE_WAIVED' ? 'WAIVED' : 'PASS',
          evidenceRefHash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          decisionRevision: 1,
          rowVersion: 1,
        },
      };
    case 'ReleaseChannelHead':
      return {
        before: {
          definitionId: event.target.definitionId,
          channel: event.target.channel,
          currentVersionId: '42000000-0000-4000-8000-000000000001',
          previousVersionId: null,
          headRevision: beforeVersion,
        },
        after: {
          definitionId: event.target.definitionId,
          channel: event.target.channel,
          currentVersionId: event.target.versionId,
          previousVersionId: '42000000-0000-4000-8000-000000000001',
          headRevision: event.aggregateSequence,
        },
      };
    case 'RuntimeControlHead': {
      if (event.eventType === 'WIDGET_RUNTIME_CONTROL_ENABLE_APPROVED') {
        const base = {
          controlId: event.target.controlId,
          targetType: 'GLOBAL',
          targetId: null,
          state: 'DISABLED',
          controlRevision: event.aggregateSequence,
        };
        return {
          before: { ...base, latestEnableApproval: null },
          after: {
            ...base,
            latestEnableApproval: {
              approvalId: event.target.enableApprovalId,
              controlRevision: event.aggregateSequence,
              state: 'ACTIVE',
              expiresAt: '2026-08-27T05:30:20Z',
              consumedAt: null,
              consumedByCommandId: null,
            },
          },
        };
      }
      const enabled = event.target.resultingState === 'ENABLED';
      const approval = {
        approvalId: event.target.enableApprovalId,
        controlRevision: beforeVersion,
        state: 'CONSUMED',
        expiresAt: '2026-08-27T06:00:00Z',
        consumedAt: event.occurredAt,
        consumedByCommandId: event.commandId,
      };
      return {
        before: {
          controlId: event.target.controlId,
          targetType: event.target.targetType,
          targetId: runtimeTarget(event),
          state: enabled ? 'DISABLED' : 'ENABLED',
          controlRevision: beforeVersion,
          latestEnableApproval: enabled
            ? {
                ...approval,
                state: 'ACTIVE',
                consumedAt: null,
                consumedByCommandId: null,
              }
            : null,
        },
        after: {
          controlId: event.target.controlId,
          targetType: event.target.targetType,
          targetId: runtimeTarget(event),
          state: event.target.resultingState,
          controlRevision: event.aggregateSequence,
          latestEnableApproval: enabled ? approval : null,
        },
      };
    }
    case 'TenantPolicyHead': {
      const state = event.eventType === 'TENANT_WIDGET_POLICY_REVOKED' ? 'REVOKED' : 'PUBLISHED';
      return {
        before: {
          tenantRef: event.target.tenantRef,
          definitionId: event.target.definitionId,
          headRevisionId: '80000000-0000-4000-8000-000000000002',
          revision: beforeVersion,
          state: 'PUBLISHED',
          impactRevision: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          policyCatalogRevision: beforeVersion,
        },
        after: {
          tenantRef: event.target.tenantRef,
          definitionId: event.target.definitionId,
          headRevisionId: event.target.policyRevisionId,
          revision: event.aggregateSequence,
          state,
          impactRevision:
            state === 'REVOKED'
              ? null
              : 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          policyCatalogRevision: event.aggregateSequence,
        },
      };
    }
    case 'RolloutApproval':
      return {
        before: null,
        after: {
          approvalId: event.target.approvalId,
          environment: event.target.environment,
          approvalRevision: event.target.approvalRevision,
          rolloutRevision: event.target.rolloutRevision,
          state: 'ACTIVE',
          registryRevision: 42,
          tenantPolicyRevision: 17,
          safetyRevision: 9,
        },
      };
    case 'RolloutHead':
      return {
        before: {
          environment: event.target.environment,
          rolloutRevision: Math.max(1, event.target.rolloutRevision - 1),
          state: event.eventType === 'WIDGET_ROLLOUT_ACTIVATED' ? 'STATIC' : 'ACTIVE',
          approvalId: event.target.approvalId,
          registryRevision: 42,
          tenantPolicyRevision: 17,
          safetyRevision: 9,
        },
        after: {
          environment: event.target.environment,
          rolloutRevision: event.target.rolloutRevision,
          state: event.eventType === 'WIDGET_ROLLOUT_ACTIVATED' ? 'ACTIVE' : 'STOPPED',
          approvalId: event.target.approvalId,
          registryRevision: 42,
          tenantPolicyRevision: 17,
          safetyRevision: 9,
        },
      };
    default:
      throw new Error(`Unknown projection type ${projectionType}.`);
  }
}

for (const testCase of fixture.positive) {
  const { event } = testCase;
  if (['WIDGET_QUARANTINE_CLEAR_APPROVED', 'WIDGET_QUARANTINE_CLEARED'].includes(event.eventType)) {
    event.target.quarantineEventId = quarantineEventId;
  }
  if (event.eventType === 'WIDGET_RUNTIME_CONTROL_CHANGED') {
    if (event.target.resultingState === 'ENABLED') {
      event.target.enableApprovalId = runtimeEnableApprovalIds[event.target.targetType];
    } else {
      delete event.target.enableApprovalId;
    }
  }
  const projectionType = projectionTypeByEventType.get(event.eventType);
  if (!projectionType) {
    delete testCase.projection;
    for (const field of ['projectionSchemaVersion', 'projectionType', 'beforeHash', 'afterHash']) {
      delete event[field];
    }
    continue;
  }
  const pair = projectionPair(event, projectionType);
  event.projectionSchemaVersion = 1;
  event.projectionType = projectionType;
  event.beforeHash = digest(pair.before);
  event.afterHash = digest(pair.after);
  testCase.projection = {
    schemaVersion: 1,
    type: projectionType,
    source: 'LOCKED_DB_ROW',
    canonicalization: 'RFC8785_JCS',
    before: pair.before,
    after: pair.after,
  };
}

const runtimeReasonSwapped = fixture.negative.find(
  ({ name }) => name === 'runtime-control-target-reason-swapped'
);
if (!runtimeReasonSwapped) {
  throw new Error('Missing negative runtime-control-target-reason-swapped.');
}
runtimeReasonSwapped.event.target.enableApprovalId = runtimeEnableApprovalIds.GLOBAL;

const generatedNegativeNames = new Set([
  'projection-arbitrary-rehash',
  'projection-wrong-type-for-event',
  'projection-extra-field',
  'projection-missing-field',
  'projection-before-after-swapped',
  'projection-before-cross-aggregate-rehash',
  'projection-raw-user-id',
  'projection-raw-evidence-reference',
  'projection-runtime-child-approval-mismatch',
  'projection-runtime-enable-missing-consumed-approval',
  'runtime-enable-command-approval-missing',
  'runtime-disable-command-approval-unexpected',
  'runtime-enable-command-approval-swapped',
  'projection-runtime-enable-before-approval-swapped-rehash',
  'projection-runtime-enable-stale-approval-revision-rehash',
  'projection-runtime-enable-before-not-active-rehash',
  'projection-runtime-enable-consumed-at-mismatch-rehash',
  'projection-runtime-enable-expired-approval-rehash',
  'projection-clearance-child-approval-mismatch',
  'clearance-command-approval-swapped',
  'clearance-command-incident-missing',
  'clearance-command-incident-swapped',
  'projection-clearance-before-approval-swapped-rehash',
  'projection-clearance-stale-incident-revision-rehash',
  'projection-clearance-before-not-active-rehash',
  'projection-clearance-consumed-at-mismatch-rehash',
  'projection-clearance-expired-approval-rehash',
  'projection-clearance-command-consumer-mismatch-rehash',
]);
fixture.negative = fixture.negative.filter(({ name }) => !generatedNegativeNames.has(name));

function clonePositive(name) {
  const testCase = fixture.positive.find((candidate) => candidate.name === name);
  if (!testCase) throw new Error(`Missing positive prototype ${name}.`);
  return structuredClone(testCase);
}

{
  const testCase = clonePositive('command-definition');
  testCase.name = 'projection-arbitrary-rehash';
  testCase.expectedError = 'AFTER_HASH_MISMATCH';
  testCase.event.afterHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-definition');
  testCase.name = 'projection-wrong-type-for-event';
  testCase.expectedError = 'PROJECTION_TYPE_BINDING';
  testCase.event.projectionType = 'VersionState';
  testCase.projection.type = 'VersionState';
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-definition');
  testCase.name = 'projection-extra-field';
  testCase.expectedError = 'PROJECTION_SHAPE';
  testCase.projection.after.debug = true;
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-definition');
  testCase.name = 'projection-missing-field';
  testCase.expectedError = 'PROJECTION_SHAPE';
  delete testCase.projection.after.state;
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-version-updated');
  testCase.name = 'projection-before-after-swapped';
  testCase.expectedError = 'BEFORE_HASH_MISMATCH';
  [testCase.projection.before, testCase.projection.after] = [
    testCase.projection.after,
    testCase.projection.before,
  ];
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-version-updated');
  testCase.name = 'projection-before-cross-aggregate-rehash';
  testCase.expectedError = 'BEFORE_PROJECTION_TARGET_BINDING';
  testCase.projection.before.versionId = '40000000-0000-4000-8000-000000000099';
  testCase.event.beforeHash = digest(testCase.projection.before);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-definition');
  testCase.name = 'projection-raw-user-id';
  testCase.expectedError = 'RAW_IDENTITY_FIELD:userId';
  testCase.projection.after.userId = 'raw-user-42';
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-evidence-recorded');
  testCase.name = 'projection-raw-evidence-reference';
  testCase.expectedError = 'RAW_EVIDENCE_REFERENCE';
  testCase.projection.after.evidenceRef = 's3://private-bucket/raw-object';
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-enable-approved');
  testCase.name = 'projection-runtime-child-approval-mismatch';
  testCase.expectedError = 'CHILD_APPROVAL_BINDING';
  testCase.projection.after.latestEnableApproval.approvalId =
    '71000000-0000-4000-8000-000000000099';
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global-enabled');
  testCase.name = 'projection-runtime-enable-missing-consumed-approval';
  testCase.expectedError = 'CHILD_APPROVAL_BINDING';
  testCase.projection.after.latestEnableApproval = null;
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global-enabled');
  testCase.name = 'runtime-enable-command-approval-swapped';
  testCase.expectedError = 'CHILD_APPROVAL_BINDING';
  testCase.event.target.enableApprovalId = '71000000-0000-4000-8000-000000000099';
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global-enabled');
  testCase.name = 'runtime-enable-command-approval-missing';
  testCase.expectedError = 'TARGET_CONTRACT';
  delete testCase.event.target.enableApprovalId;
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global');
  testCase.name = 'runtime-disable-command-approval-unexpected';
  testCase.expectedError = 'TARGET_CONTRACT';
  testCase.event.target.enableApprovalId = runtimeEnableApprovalIds.GLOBAL;
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global-enabled');
  testCase.name = 'projection-runtime-enable-before-approval-swapped-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_BINDING';
  testCase.projection.before.latestEnableApproval.approvalId =
    '71000000-0000-4000-8000-000000000099';
  testCase.event.beforeHash = digest(testCase.projection.before);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global-enabled');
  testCase.name = 'projection-runtime-enable-stale-approval-revision-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_REVISION_BINDING';
  testCase.projection.before.latestEnableApproval.controlRevision = 2;
  testCase.projection.after.latestEnableApproval.controlRevision = 2;
  testCase.event.beforeHash = digest(testCase.projection.before);
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global-enabled');
  testCase.name = 'projection-runtime-enable-before-not-active-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_PRECONDITION';
  testCase.projection.before.latestEnableApproval.state = 'CONSUMED';
  testCase.projection.before.latestEnableApproval.consumedAt = testCase.event.occurredAt;
  testCase.projection.before.latestEnableApproval.consumedByCommandId = testCase.event.commandId;
  testCase.event.beforeHash = digest(testCase.projection.before);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global-enabled');
  testCase.name = 'projection-runtime-enable-consumed-at-mismatch-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_CONSUMPTION';
  testCase.projection.after.latestEnableApproval.consumedAt = '2026-08-27T05:02:04Z';
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-runtime-global-enabled');
  testCase.name = 'projection-runtime-enable-expired-approval-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_EXPIRY_BINDING';
  testCase.projection.before.latestEnableApproval.expiresAt = testCase.event.occurredAt;
  testCase.projection.after.latestEnableApproval.expiresAt = testCase.event.occurredAt;
  testCase.event.beforeHash = digest(testCase.projection.before);
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-approved');
  testCase.name = 'projection-clearance-child-approval-mismatch';
  testCase.expectedError = 'CHILD_APPROVAL_BINDING';
  testCase.projection.after.latestClearanceApproval.approvalId =
    '60000000-0000-4000-8000-000000000099';
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'clearance-command-approval-swapped';
  testCase.expectedError = 'CHILD_APPROVAL_BINDING';
  testCase.event.target.clearanceApprovalId = '60000000-0000-4000-8000-000000000099';
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'clearance-command-incident-swapped';
  testCase.expectedError = 'CHILD_APPROVAL_BINDING';
  testCase.event.target.quarantineEventId = '65000000-0000-4000-8000-000000000099';
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'clearance-command-incident-missing';
  testCase.expectedError = 'TARGET_CONTRACT';
  delete testCase.event.target.quarantineEventId;
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'projection-clearance-before-approval-swapped-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_BINDING';
  testCase.projection.before.latestClearanceApproval.approvalId =
    '60000000-0000-4000-8000-000000000099';
  testCase.event.beforeHash = digest(testCase.projection.before);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'projection-clearance-stale-incident-revision-rehash';
  testCase.expectedError = 'QUARANTINE_REVISION_BINDING';
  testCase.projection.before.latestClearanceApproval.quarantineRevision = 16;
  testCase.projection.after.latestClearanceApproval.quarantineRevision = 16;
  testCase.event.beforeHash = digest(testCase.projection.before);
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'projection-clearance-before-not-active-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_PRECONDITION';
  testCase.projection.before.latestClearanceApproval.state = 'CONSUMED';
  testCase.projection.before.latestClearanceApproval.consumedAt = testCase.event.occurredAt;
  testCase.projection.before.latestClearanceApproval.consumedByCommandId = testCase.event.commandId;
  testCase.event.beforeHash = digest(testCase.projection.before);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'projection-clearance-consumed-at-mismatch-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_CONSUMPTION';
  testCase.projection.after.latestClearanceApproval.consumedAt = '2026-08-27T05:00:05Z';
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'projection-clearance-expired-approval-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_EXPIRY_BINDING';
  testCase.projection.before.latestClearanceApproval.expiresAt = testCase.event.occurredAt;
  testCase.projection.after.latestClearanceApproval.expiresAt = testCase.event.occurredAt;
  testCase.event.beforeHash = digest(testCase.projection.before);
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}
{
  const testCase = clonePositive('command-clearance-executed');
  testCase.name = 'projection-clearance-command-consumer-mismatch-rehash';
  testCase.expectedError = 'CHILD_APPROVAL_CONSUMPTION';
  testCase.projection.after.latestClearanceApproval.consumedByCommandId =
    '10000000-0000-4000-8000-000000000099';
  testCase.event.afterHash = digest(testCase.projection.after);
  fixture.negative.push(testCase);
}

writeFileSync(fixtureUrl, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
