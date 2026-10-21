import {
  AUTOMATION_ACTION_KEYS,
  AUTOMATION_CATALOG_FIELDS,
} from './automation-control-plane-types';

import type {
  AutomationActionKey,
  AutomationCatalogProjection,
  AutomationCommand,
  AutomationRunProjection,
  CollectionActionDescriptor,
  ResourceActionDescriptor,
} from './automation-control-plane-types';

export type AutomationCommandFixture = Readonly<{
  command: AutomationCommand;
  commandType: string;
  actionKey: AutomationActionKey;
}>;

export const AUTOMATION_FIXTURE_IDS = Object.freeze({
  definition: '10000000-0000-4000-8000-000000000001',
  schedule: '10000000-0000-4000-8000-000000000002',
  run: '10000000-0000-4000-8000-000000000003',
  item: '10000000-0000-4000-8000-000000000004',
  checkpoint: '10000000-0000-4000-8000-000000000005',
  correlation: '10000000-0000-4000-8000-000000000006',
  receipt: '10000000-0000-4000-8000-000000000007',
  subject: '10000000-0000-4000-8000-000000000008',
  approvalReceipt: '10000000-0000-4000-8000-000000000009',
  idempotency: '10000000-0000-4000-8000-000000000010',
});

export function automationCatalogFixture(): AutomationCatalogProjection {
  return {
    asOf: '2026-10-21T02:00:00Z',
    items: [
      {
        resourceType: 'AUTOMATION_DEFINITION',
        definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
        automationKey: 'payroll.posting',
        ownerDomain: 'PAY',
        derivedLifecycleState: 'ACTIVE',
        activeVersionNumber: 3,
        objectRevision: 11,
        availableActions: [
          resourceAction(
            AUTOMATION_ACTION_KEYS.queueRun,
            'AUTOMATION_DEFINITION',
            AUTOMATION_FIXTURE_IDS.definition,
            11,
            `/api/platform/v1/admin/hris/automations/${AUTOMATION_FIXTURE_IDS.definition}/runs`
          ),
          resourceAction(
            AUTOMATION_ACTION_KEYS.createVersion,
            'AUTOMATION_DEFINITION',
            AUTOMATION_FIXTURE_IDS.definition,
            11,
            `/api/platform/v1/admin/hris/automations/${AUTOMATION_FIXTURE_IDS.definition}/versions`
          ),
          resourceAction(
            AUTOMATION_ACTION_KEYS.createSchedule,
            'AUTOMATION_DEFINITION',
            AUTOMATION_FIXTURE_IDS.definition,
            11,
            `/api/platform/v1/admin/hris/automations/${AUTOMATION_FIXTURE_IDS.definition}/schedules`
          ),
        ],
      },
      {
        resourceType: 'AUTOMATION_VERSION',
        definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
        versionNumber: 4,
        lifecycleState: 'PENDING_APPROVAL',
        handlerKey: 'payroll.posting.handler',
        handlerContractVersion: 'AutomationInvocation.v1',
        objectRevision: 7,
        availableActions: [
          resourceAction(
            AUTOMATION_ACTION_KEYS.approveVersion,
            'AUTOMATION_VERSION',
            AUTOMATION_FIXTURE_IDS.definition,
            7,
            `/api/platform/v1/admin/hris/automations/${AUTOMATION_FIXTURE_IDS.definition}/versions/4/approve`,
            4
          ),
        ],
      },
      {
        resourceType: 'AUTOMATION_SCHEDULE',
        schedulePublicId: AUTOMATION_FIXTURE_IDS.schedule,
        definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
        pinnedVersionNumber: 3,
        lifecycleState: 'ACTIVE',
        timezone: 'Asia/Seoul',
        nextFireAt: '2026-10-22T00:00:00Z',
        objectRevision: 5,
        availableActions: [
          resourceAction(
            AUTOMATION_ACTION_KEYS.suspendSchedule,
            'AUTOMATION_SCHEDULE',
            AUTOMATION_FIXTURE_IDS.schedule,
            5,
            `/api/platform/v1/admin/hris/automation-schedules/${AUTOMATION_FIXTURE_IDS.schedule}/suspend`
          ),
        ],
      },
    ],
    nextCursor: null,
    freshUntil: '2099-10-21T02:05:00Z',
    staleAfter: '2099-10-21T02:10:00Z',
    collectionActions: [collectionAction()],
    fieldDecisionSummary: {
      visible: [...AUTOMATION_CATALOG_FIELDS],
      masked: [],
      omitted: [],
      fieldPolicyRevision: 17,
    },
    authorizationRevision: 41,
    correlationId: AUTOMATION_FIXTURE_IDS.correlation,
  };
}

export function automationRunFixture(): AutomationRunProjection {
  return {
    runPublicId: AUTOMATION_FIXTURE_IDS.run,
    definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
    versionNumber: 3,
    state: 'FAILED',
    objectRevision: 9,
    selectionMode: 'ALL_ITEMS',
    itemTotal: 2,
    itemSucceeded: 1,
    itemFailed: 1,
    outputDigest: null,
    retryBudgetRemaining: 2,
    retryEligibleItemCount: 1,
    cancelEligibility: 'INELIGIBLE',
    attempts: [
      {
        attemptNumber: 1,
        selectionMode: 'ALL_ITEMS',
        selectedItemCount: 2,
        selectedItemDigest: 'a'.repeat(64),
        state: 'FAILED',
        startedAt: '2026-10-21T02:01:00Z',
        completedAt: '2026-10-21T02:02:00Z',
      },
    ],
    items: [
      {
        itemPublicId: AUTOMATION_FIXTURE_IDS.item,
        itemSequence: 2,
        state: 'FAILED_RETRYABLE',
        attemptCount: 1,
        resultDigest: null,
        errorCode: 'TARGET_TEMPORARILY_UNAVAILABLE',
        effectState: 'NO_EFFECT_CONFIRMED',
        compensationState: 'NOT_REQUIRED',
      },
    ],
    checkpoints: [
      {
        checkpointPublicId: AUTOMATION_FIXTURE_IDS.checkpoint,
        attemptNumber: 1,
        checkpointOrdinal: 1,
        processedItemCount: 1,
        processedItemDigest: 'b'.repeat(64),
        outputDigest: 'c'.repeat(64),
        committedAt: '2026-10-21T02:01:30Z',
      },
    ],
    nextAttemptCursor: null,
    nextItemCursor: null,
    nextCheckpointCursor: null,
    availableActions: [
      resourceAction(
        AUTOMATION_ACTION_KEYS.retryRun,
        'AUTOMATION_RUN',
        AUTOMATION_FIXTURE_IDS.run,
        9,
        `/api/platform/v1/admin/hris/automation-runs/${AUTOMATION_FIXTURE_IDS.run}/retry`
      ),
    ],
    authorizationRevision: 41,
    correlationId: AUTOMATION_FIXTURE_IDS.correlation,
  };
}

export function automationCommandFixtures(): readonly AutomationCommandFixture[] {
  const lifecycleBody = { evidenceDigest: 'e'.repeat(64), reason: null } as const;
  return [
    {
      command: {
        kind: 'CREATE_DEFINITION',
        body: {
          automationKey: 'payroll.posting',
          displayName: 'Payroll posting',
          description: null,
          ownerDomain: 'PAY',
        },
      },
      commandType: 'CREATE_AUTOMATION_DEFINITION',
      actionKey: AUTOMATION_ACTION_KEYS.createDefinition,
    },
    {
      command: {
        kind: 'QUEUE_RUN',
        definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
        body: {
          scopeType: 'LEGAL_ENTITY',
          scopeId: null,
          inputReference: 'dwp://automation-input/payroll/2026-10',
          inputDigest: 'a'.repeat(64),
          expectedItemCount: 240,
        },
      },
      commandType: 'QUEUE_AUTOMATION_RUN',
      actionKey: AUTOMATION_ACTION_KEYS.queueRun,
    },
    {
      command: {
        kind: 'RETRY_RUN',
        runPublicId: AUTOMATION_FIXTURE_IDS.run,
        body: { evidenceDigest: 'b'.repeat(64) },
      },
      commandType: 'RETRY_AUTOMATION_RUN',
      actionKey: AUTOMATION_ACTION_KEYS.retryRun,
    },
    {
      command: {
        kind: 'CREATE_VERSION',
        definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
        body: {
          definitionPayload: { schemaVersion: 'AutomationDefinition.v1' },
          definitionDigest: 'c'.repeat(64),
          executionPolicy: { maxParallelism: 4 },
          executionPolicyDigest: 'd'.repeat(64),
          manualConcurrencyKeyTemplate: 'payroll:${scopeId}',
          compensationPolicyRef: null,
          compensationPolicyDigest: 'e'.repeat(64),
          handlerOwnerService: 'dwp-payroll-server',
          handlerKey: 'payroll.posting.handler',
          handlerContractVersion: 'AutomationInvocation.v1',
          handlerManifestRevision: 12,
          handlerManifestDigest: 'f'.repeat(64),
          signatureKeyId: 'kms://hris-automation/signing-key-01',
          signature: 'signed-automation-definition-payload',
          signatureDigest: '0'.repeat(64),
          inputSchemaRef: 'schema://automation/payroll-input.v1',
          inputSchemaDigest: '1'.repeat(64),
          receiptSchemaRef: 'schema://automation/payroll-receipt.v1',
          receiptSchemaDigest: '2'.repeat(64),
          allowedScopeTypes: ['LEGAL_ENTITY', 'PAY_GROUP'],
          retryMode: 'FAILED_ITEMS_ONLY',
          maxAttempts: 3,
        },
      },
      commandType: 'CREATE_AUTOMATION_VERSION',
      actionKey: AUTOMATION_ACTION_KEYS.createVersion,
    },
    ...versionLifecycleFixtures(lifecycleBody),
    {
      command: {
        kind: 'CREATE_SCHEDULE',
        definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
        body: {
          pinnedVersionNumber: 4,
          expression: '0 0 2 * * *',
          timezone: 'Asia/Seoul',
          timezoneDatabaseRevision: '2026b',
          inputTemplateRef: 'dwp://automation-template/payroll-monthly',
          inputTemplateDigest: '3'.repeat(64),
          concurrencyKeyTemplate: 'payroll:${scheduledDate}',
          schedulePolicyDigest: '4'.repeat(64),
        },
      },
      commandType: 'CREATE_AUTOMATION_SCHEDULE',
      actionKey: AUTOMATION_ACTION_KEYS.createSchedule,
    },
    ...scheduleLifecycleFixtures(lifecycleBody),
    {
      command: {
        kind: 'CANCEL_RUN',
        runPublicId: AUTOMATION_FIXTURE_IDS.run,
        body: { reason: 'Operator cancelled before effect.', evidenceDigest: '5'.repeat(64) },
      },
      commandType: 'CANCEL_AUTOMATION_RUN',
      actionKey: AUTOMATION_ACTION_KEYS.cancelRun,
    },
  ];
}

function versionLifecycleFixtures(
  body: Readonly<{ evidenceDigest: string; reason: null }>
): readonly AutomationCommandFixture[] {
  return [
    versionLifecycle('VALIDATE_VERSION', 'VALIDATE_AUTOMATION_VERSION', 'validateVersion', body),
    versionLifecycle('SUBMIT_VERSION', 'SUBMIT_AUTOMATION_VERSION', 'submitVersion', body),
    versionLifecycle('APPROVE_VERSION', 'APPROVE_AUTOMATION_VERSION', 'approveVersion', body),
    versionLifecycle('ACTIVATE_VERSION', 'ACTIVATE_AUTOMATION_VERSION', 'activateVersion', body),
  ];
}

function versionLifecycle(
  kind: 'VALIDATE_VERSION' | 'SUBMIT_VERSION' | 'APPROVE_VERSION' | 'ACTIVATE_VERSION',
  commandType: string,
  action: 'validateVersion' | 'submitVersion' | 'approveVersion' | 'activateVersion',
  body: Readonly<{ evidenceDigest: string; reason: null }>
): AutomationCommandFixture {
  return {
    command: {
      kind,
      definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
      versionNumber: 4,
      body,
    } as AutomationCommand,
    commandType,
    actionKey: AUTOMATION_ACTION_KEYS[action],
  };
}

function scheduleLifecycleFixtures(
  body: Readonly<{ evidenceDigest: string; reason: null }>
): readonly AutomationCommandFixture[] {
  return [
    scheduleLifecycle('SUBMIT_SCHEDULE', 'SUBMIT_AUTOMATION_SCHEDULE', 'submitSchedule', body),
    scheduleLifecycle('APPROVE_SCHEDULE', 'APPROVE_AUTOMATION_SCHEDULE', 'approveSchedule', body),
    scheduleLifecycle(
      'ACTIVATE_SCHEDULE',
      'ACTIVATE_AUTOMATION_SCHEDULE',
      'activateSchedule',
      body
    ),
    scheduleLifecycle('SUSPEND_SCHEDULE', 'SUSPEND_AUTOMATION_SCHEDULE', 'suspendSchedule', body),
  ];
}

function scheduleLifecycle(
  kind: 'SUBMIT_SCHEDULE' | 'APPROVE_SCHEDULE' | 'ACTIVATE_SCHEDULE' | 'SUSPEND_SCHEDULE',
  commandType: string,
  action: 'submitSchedule' | 'approveSchedule' | 'activateSchedule' | 'suspendSchedule',
  body: Readonly<{ evidenceDigest: string; reason: null }>
): AutomationCommandFixture {
  return {
    command: { kind, schedulePublicId: AUTOMATION_FIXTURE_IDS.schedule, body } as AutomationCommand,
    commandType,
    actionKey: AUTOMATION_ACTION_KEYS[action],
  };
}

export function collectionAction(): CollectionActionDescriptor {
  return {
    method: 'POST',
    actionKey: AUTOMATION_ACTION_KEYS.createDefinition,
    targetResourceType: 'AUTOMATION_DEFINITION_COLLECTION',
    resolvedHref: '/api/platform/v1/admin/hris/automations',
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  };
}

export function resourceAction(
  actionKey: Exclude<AutomationActionKey, typeof AUTOMATION_ACTION_KEYS.createDefinition>,
  targetResourceType: ResourceActionDescriptor['targetResourceType'],
  targetPublicId: string,
  expectedObjectRevision: number,
  resolvedHref: string,
  targetVersion?: number
): ResourceActionDescriptor {
  return {
    method: 'POST',
    actionKey,
    targetResourceType,
    targetPublicId,
    ...(targetVersion === undefined ? {} : { targetVersion }),
    expectedObjectRevision,
    resolvedHref,
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  };
}
