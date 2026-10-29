import {
  AUTOMATION_ACTION_KEYS,
  AUTOMATION_CATALOG_FIELDS,
  AUTOMATION_RESOURCE_TYPES,
} from './automation-control-plane-types';
import { formatDate } from '@dwp-frontend/shared-i18n';

import type { HrisAutomationControlPlaneState } from './automation-control-plane-contract';
import type {
  AutomationActionKey,
  AutomationAttemptProjection,
  AutomationCatalogField,
  AutomationCatalogItem,
  AutomationCatalogProjection,
  AutomationCheckpointProjection,
  AutomationCommandReceipt,
  AutomationDefinitionItem,
  AutomationItemProjection,
  AutomationRunProjection,
  AutomationScheduleItem,
  AutomationVersionItem,
  CollectionActionDescriptor,
  MaskedField,
  OmittedField,
  ProjectedValue,
  ResourceActionDescriptor,
} from './automation-control-plane-types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;
const AUTOMATION_KEY = /^[a-z][a-z0-9.-]{2,63}$/;
const HANDLER_KEY = /^[a-z][a-z0-9._-]{2,127}$/;
const SCHEMA_VERSION = /^[A-Za-z][A-Za-z0-9._-]{0,127}\.v[1-9][0-9]*$/;
const ERROR_CODE = /^[A-Z][A-Z0-9._-]{0,79}$/;
const MAX_SAFE_REVISION = Number.MAX_SAFE_INTEGER;

const DEFINITION_STATES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED'] as const;
const VERSION_STATES = [
  'DRAFT',
  'VALIDATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED',
] as const;
const SCHEDULE_STATES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED'] as const;
const RUN_STATES = [
  'QUEUED',
  'LEASED',
  'RUNNING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
  'DEAD_LETTER',
] as const;
const ITEM_STATES = [
  'PENDING',
  'LEASED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'CANCELLED',
  'DEAD_LETTER',
] as const;
const EFFECT_STATES = [
  'NOT_STARTED',
  'PREPARED',
  'NO_EFFECT_CONFIRMED',
  'COMMITTED',
  'RESULT_UNKNOWN',
] as const;
const COMPENSATION_STATES = [
  'NOT_REQUIRED',
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
] as const;

const COLLECTION_KEYS = [
  'method',
  'actionKey',
  'targetResourceType',
  'resolvedHref',
  'idempotencyPolicy',
  'stepUpPolicy',
] as const;
const RESOURCE_ACTION_REQUIRED_KEYS = [
  'method',
  'actionKey',
  'targetResourceType',
  'targetPublicId',
  'expectedObjectRevision',
  'resolvedHref',
  'idempotencyPolicy',
  'stepUpPolicy',
] as const;

const DEFINITION_ACTIONS: Readonly<
  Record<(typeof DEFINITION_STATES)[number], readonly AutomationActionKey[]>
> = {
  DRAFT: [AUTOMATION_ACTION_KEYS.createVersion, AUTOMATION_ACTION_KEYS.createSchedule],
  ACTIVE: [
    AUTOMATION_ACTION_KEYS.queueRun,
    AUTOMATION_ACTION_KEYS.createVersion,
    AUTOMATION_ACTION_KEYS.createSchedule,
  ],
  SUSPENDED: [],
  RETIRED: [],
};
const VERSION_ACTIONS: Readonly<
  Record<(typeof VERSION_STATES)[number], readonly AutomationActionKey[]>
> = {
  DRAFT: [AUTOMATION_ACTION_KEYS.validateVersion],
  VALIDATED: [AUTOMATION_ACTION_KEYS.submitVersion],
  PENDING_APPROVAL: [AUTOMATION_ACTION_KEYS.approveVersion],
  APPROVED: [AUTOMATION_ACTION_KEYS.activateVersion],
  ACTIVE: [],
  SUSPENDED: [],
  RETIRED: [],
};
const SCHEDULE_ACTIONS: Readonly<
  Record<(typeof SCHEDULE_STATES)[number], readonly AutomationActionKey[]>
> = {
  DRAFT: [AUTOMATION_ACTION_KEYS.submitSchedule],
  PENDING_APPROVAL: [AUTOMATION_ACTION_KEYS.approveSchedule],
  APPROVED: [AUTOMATION_ACTION_KEYS.activateSchedule],
  ACTIVE: [AUTOMATION_ACTION_KEYS.suspendSchedule],
  SUSPENDED: [],
};

export type AutomationCatalogRow = Readonly<{
  key: string;
  title: string;
  resourceLabel: 'Definition' | 'Version' | 'Schedule';
  lifecycle: string;
  context: string;
  nextEvent: string;
  item: AutomationCatalogItem;
  actions: readonly ResourceActionDescriptor[];
  redacted: boolean;
}>;

export function assertAutomationCatalogProjection(value: unknown): AutomationCatalogProjection {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'asOf',
      'items',
      'nextCursor',
      'freshUntil',
      'staleAfter',
      'collectionActions',
      'fieldDecisionSummary',
      'authorizationRevision',
      'correlationId',
    ]) ||
    !isInstant(value.asOf) ||
    !isInstant(value.freshUntil) ||
    !isInstant(value.staleAfter) ||
    !isNullableCursor(value.nextCursor) ||
    !isPositiveSafeInteger(value.authorizationRevision) ||
    !isUuid(value.correlationId) ||
    !Array.isArray(value.items) ||
    value.items.length > 100 ||
    !Array.isArray(value.collectionActions) ||
    value.collectionActions.length > 1 ||
    !isFieldDecisionSummary(value.fieldDecisionSummary)
  ) {
    throw new Error('Automation catalog projection is invalid.');
  }

  const items = value.items.map(parseCatalogItem);
  const collectionActions = value.collectionActions.map(parseCollectionAction);
  if (
    new Set(collectionActions.map(({ actionKey }) => actionKey)).size !== collectionActions.length
  ) {
    throw new Error('Automation catalog collection actions are not unique.');
  }
  return Object.freeze({
    ...value,
    items: Object.freeze(items),
    collectionActions: Object.freeze(collectionActions),
  }) as AutomationCatalogProjection;
}

export function assertAutomationRunProjection(value: unknown): AutomationRunProjection {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'runPublicId',
      'definitionPublicId',
      'versionNumber',
      'state',
      'objectRevision',
      'selectionMode',
      'itemTotal',
      'itemSucceeded',
      'itemFailed',
      'outputDigest',
      'retryBudgetRemaining',
      'retryEligibleItemCount',
      'cancelEligibility',
      'attempts',
      'items',
      'checkpoints',
      'nextAttemptCursor',
      'nextItemCursor',
      'nextCheckpointCursor',
      'availableActions',
      'authorizationRevision',
      'correlationId',
    ]) ||
    !isUuid(value.runPublicId) ||
    !isUuid(value.definitionPublicId) ||
    !isPositiveSafeInteger(value.versionNumber) ||
    !isOneOf(value.state, RUN_STATES) ||
    !isPositiveSafeInteger(value.objectRevision) ||
    !isOneOf(value.selectionMode, ['ALL_ITEMS', 'FAILED_ITEMS_ONLY'] as const) ||
    !isCount(value.itemTotal) ||
    !isCount(value.itemSucceeded) ||
    !isCount(value.itemFailed) ||
    !(value.outputDigest === null || isDigest(value.outputDigest)) ||
    !isBoundedInteger(value.retryBudgetRemaining, 0, 20) ||
    !isCount(value.retryEligibleItemCount) ||
    !isOneOf(value.cancelEligibility, [
      'ELIGIBLE_NO_EFFECT',
      'ELIGIBLE_ALL_REQUIRED_PATHS',
      'INELIGIBLE',
    ] as const) ||
    !Array.isArray(value.attempts) ||
    value.attempts.length > 20 ||
    !Array.isArray(value.items) ||
    value.items.length > 100 ||
    !Array.isArray(value.checkpoints) ||
    value.checkpoints.length > 100 ||
    !isNullableCursor(value.nextAttemptCursor) ||
    !isNullableCursor(value.nextItemCursor) ||
    !isNullableCursor(value.nextCheckpointCursor) ||
    !Array.isArray(value.availableActions) ||
    value.availableActions.length > 2 ||
    !isPositiveSafeInteger(value.authorizationRevision) ||
    !isUuid(value.correlationId) ||
    value.itemSucceeded + value.itemFailed > value.itemTotal ||
    value.retryEligibleItemCount > value.itemFailed
  ) {
    throw new Error('Automation run projection is invalid.');
  }

  const projection: AutomationRunProjection = Object.freeze({
    ...(value as unknown as AutomationRunProjection),
    attempts: Object.freeze(value.attempts.map(parseAttempt)),
    items: Object.freeze(value.items.map(parseRunItem)),
    checkpoints: Object.freeze(value.checkpoints.map(parseCheckpoint)),
    availableActions: Object.freeze(value.availableActions.map(parseResourceAction)),
  });
  if (
    new Set(projection.availableActions.map(({ actionKey }) => actionKey)).size !==
    projection.availableActions.length
  ) {
    throw new Error('Automation run actions are not unique.');
  }
  if (!runProjectionStateIsConsistent(projection)) {
    throw new Error('Automation run action eligibility is inconsistent.');
  }
  return projection;
}

export function assertAutomationCommandReceipt(value: unknown): AutomationCommandReceipt {
  const required = [
    'receiptId',
    'commandType',
    'originatingAction',
    'subjectPrincipalPublicId',
    'populationScopeDigest',
    'fieldPolicyRevision',
    'purposeCode',
    'authorizationRevision',
    'status',
    'correlationId',
    'requestDigest',
    'createdAt',
  ] as const;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, required, ['aggregateVersion', 'resultRef']) ||
    !isUuid(value.receiptId) ||
    !isBoundedString(value.commandType, 1, 100) ||
    !isBoundedString(value.originatingAction, 1, 128) ||
    !isUuid(value.subjectPrincipalPublicId) ||
    !isDigest(value.populationScopeDigest) ||
    !isPositiveSafeInteger(value.fieldPolicyRevision) ||
    !isBoundedString(value.purposeCode, 3, 64) ||
    !isPositiveSafeInteger(value.authorizationRevision) ||
    !isOneOf(value.status, [
      'ACCEPTED',
      'RUNNING',
      'SUCCEEDED',
      'REJECTED',
      'FAILED',
      'RESULT_UNKNOWN',
    ] as const) ||
    !isUuid(value.correlationId) ||
    !isDigest(value.requestDigest) ||
    !isInstant(value.createdAt)
  ) {
    throw new Error('Automation command receipt is invalid.');
  }
  const hasVersion = Object.hasOwn(value, 'aggregateVersion');
  const hasResult = Object.hasOwn(value, 'resultRef');
  if (
    hasVersion !== hasResult ||
    (hasVersion && !isPositiveSafeInteger(value.aggregateVersion)) ||
    (hasResult && !isBoundedString(value.resultRef, 1, 500)) ||
    (['ACCEPTED', 'REJECTED'].includes(String(value.status)) && (hasVersion || hasResult)) ||
    (value.status === 'SUCCEEDED' && (!hasVersion || !hasResult))
  ) {
    throw new Error('Automation command receipt aggregate binding is invalid.');
  }
  return Object.freeze({ ...value }) as AutomationCommandReceipt;
}

export function resolveAutomationControlPlaneState(
  input: Readonly<{
    loading: boolean;
    forbidden: boolean;
    stepUpRequired: boolean;
    failed: boolean;
    retryable: boolean;
    catalog?: AutomationCatalogProjection;
    now?: number;
  }>
): HrisAutomationControlPlaneState {
  if (input.forbidden) return 'forbidden';
  if (input.stepUpRequired) return 'step-up';
  if (input.loading) return 'loading';
  if (input.failed) return input.retryable ? 'retry' : 'unavailable';
  if (!input.catalog) return 'unavailable';
  if (input.catalog.items.length === 0) return 'empty';
  const now = input.now ?? Date.now();
  if (now > Date.parse(input.catalog.staleAfter)) return 'unavailable';
  if (
    now > Date.parse(input.catalog.freshUntil) ||
    input.catalog.fieldDecisionSummary.masked.length > 0 ||
    input.catalog.fieldDecisionSummary.omitted.length > 0 ||
    input.catalog.items.some(hasProjectedRedaction)
  ) {
    return 'partial';
  }
  return 'complete';
}

export function catalogRows(catalog: AutomationCatalogProjection): readonly AutomationCatalogRow[] {
  return catalog.items.map((item, index) => {
    const redacted = hasProjectedRedaction(item);
    const actions = automationActionsForItem(item);
    if (item.resourceType === 'AUTOMATION_DEFINITION') {
      return Object.freeze({
        key: visibleText(item.definitionPublicId) ?? `definition-redacted-${index}`,
        title: visibleText(item.automationKey) ?? 'Restricted definition',
        resourceLabel: 'Definition' as const,
        lifecycle: visibleText(item.derivedLifecycleState) ?? 'Restricted',
        context: visibleText(item.ownerDomain) ?? 'Owner hidden',
        nextEvent:
          typeof item.activeVersionNumber === 'number'
            ? `Active version ${item.activeVersionNumber}`
            : item.activeVersionNumber === null
              ? 'No active version'
              : 'Version hidden',
        item,
        actions,
        redacted,
      });
    }
    if (item.resourceType === 'AUTOMATION_VERSION') {
      const version =
        typeof item.versionNumber === 'number' ? `Version ${item.versionNumber}` : 'Version hidden';
      return Object.freeze({
        key: `${visibleText(item.definitionPublicId) ?? `version-redacted-${index}`}:${version}`,
        title: version,
        resourceLabel: 'Version' as const,
        lifecycle: visibleText(item.lifecycleState) ?? 'Restricted',
        context: visibleText(item.handlerKey) ?? 'Handler hidden',
        nextEvent: visibleText(item.handlerContractVersion) ?? 'Contract hidden',
        item,
        actions,
        redacted,
      });
    }
    return Object.freeze({
      key: visibleText(item.schedulePublicId) ?? `schedule-redacted-${index}`,
      title: visibleText(item.timezone) ?? 'Restricted schedule',
      resourceLabel: 'Schedule' as const,
      lifecycle: visibleText(item.lifecycleState) ?? 'Restricted',
      context:
        typeof item.pinnedVersionNumber === 'number'
          ? `Pinned to version ${item.pinnedVersionNumber}`
          : 'Version hidden',
      nextEvent:
        typeof item.nextFireAt === 'string'
          ? formatAutomationTimestamp(item.nextFireAt)
          : item.nextFireAt === null
            ? 'No next fire'
            : 'Next fire hidden',
      item,
      actions,
      redacted,
    });
  });
}

export function automationActionsForItem(
  item: AutomationCatalogItem
): readonly ResourceActionDescriptor[] {
  if (hasProjectedRedaction(item)) return [];
  let allowed: readonly AutomationActionKey[] = [];
  let targetPublicId = '';
  let targetVersion: number | undefined;
  if (item.resourceType === 'AUTOMATION_DEFINITION') {
    allowed = DEFINITION_ACTIONS[item.derivedLifecycleState as keyof typeof DEFINITION_ACTIONS];
    targetPublicId = item.definitionPublicId as string;
  } else if (item.resourceType === 'AUTOMATION_VERSION') {
    allowed = VERSION_ACTIONS[item.lifecycleState as keyof typeof VERSION_ACTIONS];
    targetPublicId = item.definitionPublicId as string;
    targetVersion = item.versionNumber as number;
  } else {
    allowed = SCHEDULE_ACTIONS[item.lifecycleState as keyof typeof SCHEDULE_ACTIONS];
    targetPublicId = item.schedulePublicId as string;
  }
  return item.availableActions.filter(
    (action) =>
      allowed.includes(action.actionKey) &&
      action.targetPublicId === targetPublicId &&
      (targetVersion === undefined || action.targetVersion === targetVersion) &&
      action.expectedObjectRevision === item.objectRevision
  );
}

export function automationActionsForRun(
  run: AutomationRunProjection
): readonly ResourceActionDescriptor[] {
  const allowed: readonly AutomationActionKey[] =
    run.state === 'QUEUED' || run.state === 'LEASED'
      ? [AUTOMATION_ACTION_KEYS.cancelRun]
      : run.state === 'RUNNING' && run.cancelEligibility !== 'INELIGIBLE'
        ? [AUTOMATION_ACTION_KEYS.cancelRun]
        : (run.state === 'PARTIAL' || run.state === 'FAILED') &&
            run.retryBudgetRemaining > 0 &&
            run.retryEligibleItemCount > 0
          ? [AUTOMATION_ACTION_KEYS.retryRun]
          : [];
  return run.availableActions.filter(
    (action) =>
      allowed.includes(action.actionKey) &&
      action.targetPublicId === run.runPublicId &&
      action.expectedObjectRevision === run.objectRevision
  );
}

export function automationActionLabel(action: AutomationActionKey): string {
  const labels: Readonly<Record<AutomationActionKey, string>> = {
    [AUTOMATION_ACTION_KEYS.createDefinition]: 'New definition',
    [AUTOMATION_ACTION_KEYS.queueRun]: 'Queue run',
    [AUTOMATION_ACTION_KEYS.retryRun]: 'Retry failed items',
    [AUTOMATION_ACTION_KEYS.createVersion]: 'New version',
    [AUTOMATION_ACTION_KEYS.validateVersion]: 'Validate',
    [AUTOMATION_ACTION_KEYS.submitVersion]: 'Submit for approval',
    [AUTOMATION_ACTION_KEYS.approveVersion]: 'Approve version',
    [AUTOMATION_ACTION_KEYS.activateVersion]: 'Activate version',
    [AUTOMATION_ACTION_KEYS.createSchedule]: 'New schedule',
    [AUTOMATION_ACTION_KEYS.submitSchedule]: 'Submit schedule',
    [AUTOMATION_ACTION_KEYS.approveSchedule]: 'Approve schedule',
    [AUTOMATION_ACTION_KEYS.activateSchedule]: 'Activate schedule',
    [AUTOMATION_ACTION_KEYS.suspendSchedule]: 'Suspend schedule',
    [AUTOMATION_ACTION_KEYS.cancelRun]: 'Cancel run',
  };
  return labels[action];
}

export function isProjectedRestriction(value: unknown): value is MaskedField | OmittedField {
  return (
    isRecord(value) &&
    ((hasExactKeys(value, ['decision', 'displayValue']) &&
      value.decision === 'MASK' &&
      value.displayValue === '••••') ||
      (hasExactKeys(value, ['decision']) && value.decision === 'OMIT'))
  );
}

export function formatAutomationTimestamp(value: string): string {
  return formatDate(value, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
}

function parseCatalogItem(value: unknown): AutomationCatalogItem {
  if (!isRecord(value) || !isOneOf(value.resourceType, AUTOMATION_RESOURCE_TYPES)) {
    throw new Error('Automation catalog item is invalid.');
  }
  if (value.resourceType === 'AUTOMATION_DEFINITION') return parseDefinition(value);
  if (value.resourceType === 'AUTOMATION_VERSION') return parseVersion(value);
  return parseSchedule(value);
}

function parseDefinition(value: Record<string, unknown>): AutomationDefinitionItem {
  if (
    !hasExactKeys(value, [
      'resourceType',
      'definitionPublicId',
      'automationKey',
      'ownerDomain',
      'derivedLifecycleState',
      'activeVersionNumber',
      'objectRevision',
      'availableActions',
    ]) ||
    !isProjected(value.definitionPublicId, isUuid) ||
    !isProjected(
      value.automationKey,
      (item) => typeof item === 'string' && AUTOMATION_KEY.test(item)
    ) ||
    !isProjected(value.ownerDomain, (item) =>
      isOneOf(item, ['HRM', 'PER', 'TIM', 'PAY'] as const)
    ) ||
    !isProjected(value.derivedLifecycleState, (item) => isOneOf(item, DEFINITION_STATES)) ||
    !isProjected(
      value.activeVersionNumber,
      (item) => item === null || isPositiveSafeInteger(item)
    ) ||
    !isProjected(value.objectRevision, isPositiveSafeInteger)
  ) {
    throw new Error('Automation definition projection is invalid.');
  }
  return freezeItem(value, 3) as AutomationDefinitionItem;
}

function parseVersion(value: Record<string, unknown>): AutomationVersionItem {
  if (
    !hasExactKeys(value, [
      'resourceType',
      'definitionPublicId',
      'versionNumber',
      'lifecycleState',
      'handlerKey',
      'handlerContractVersion',
      'objectRevision',
      'availableActions',
    ]) ||
    !isProjected(value.definitionPublicId, isUuid) ||
    !isProjected(value.versionNumber, isPositiveSafeInteger) ||
    !isProjected(value.lifecycleState, (item) => isOneOf(item, VERSION_STATES)) ||
    !isProjected(value.handlerKey, (item) => typeof item === 'string' && HANDLER_KEY.test(item)) ||
    !isProjected(
      value.handlerContractVersion,
      (item) => typeof item === 'string' && SCHEMA_VERSION.test(item)
    ) ||
    !isProjected(value.objectRevision, isPositiveSafeInteger)
  ) {
    throw new Error('Automation version projection is invalid.');
  }
  return freezeItem(value, 1) as AutomationVersionItem;
}

function parseSchedule(value: Record<string, unknown>): AutomationScheduleItem {
  if (
    !hasExactKeys(value, [
      'resourceType',
      'schedulePublicId',
      'definitionPublicId',
      'pinnedVersionNumber',
      'lifecycleState',
      'timezone',
      'nextFireAt',
      'objectRevision',
      'availableActions',
    ]) ||
    !isProjected(value.schedulePublicId, isUuid) ||
    !isProjected(value.definitionPublicId, isUuid) ||
    !isProjected(value.pinnedVersionNumber, isPositiveSafeInteger) ||
    !isProjected(value.lifecycleState, (item) => isOneOf(item, SCHEDULE_STATES)) ||
    !isProjected(value.timezone, (item) => isBoundedString(item, 1, 64)) ||
    !isProjected(value.nextFireAt, (item) => item === null || isInstant(item)) ||
    !isProjected(value.objectRevision, isPositiveSafeInteger)
  ) {
    throw new Error('Automation schedule projection is invalid.');
  }
  return freezeItem(value, 1) as AutomationScheduleItem;
}

function freezeItem(value: Record<string, unknown>, maxActions: number): AutomationCatalogItem {
  if (!Array.isArray(value.availableActions) || value.availableActions.length > maxActions) {
    throw new Error('Automation resource actions are invalid.');
  }
  const actions = value.availableActions.map(parseResourceAction);
  if (new Set(actions.map(({ actionKey }) => actionKey)).size !== actions.length) {
    throw new Error('Automation resource actions are not unique.');
  }
  const item = Object.freeze({
    ...value,
    availableActions: Object.freeze(actions),
  }) as AutomationCatalogItem;
  if (hasProjectedRedaction(item) && actions.length > 0) {
    throw new Error('Restricted automation facts cannot expose actions.');
  }
  return item;
}

function parseCollectionAction(value: unknown): CollectionActionDescriptor {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, COLLECTION_KEYS) ||
    value.method !== 'POST' ||
    value.actionKey !== AUTOMATION_ACTION_KEYS.createDefinition ||
    value.targetResourceType !== 'AUTOMATION_DEFINITION_COLLECTION' ||
    value.resolvedHref !== '/api/platform/v1/admin/hris/automations' ||
    value.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
    value.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED'
  ) {
    throw new Error('Automation collection action is invalid.');
  }
  return Object.freeze({ ...value }) as CollectionActionDescriptor;
}

function parseResourceAction(value: unknown): ResourceActionDescriptor {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, RESOURCE_ACTION_REQUIRED_KEYS, ['targetVersion']) ||
    value.method !== 'POST' ||
    !isOneOf(
      value.actionKey,
      Object.values(AUTOMATION_ACTION_KEYS).filter(
        (key) => key !== AUTOMATION_ACTION_KEYS.createDefinition
      ) as Exclude<AutomationActionKey, typeof AUTOMATION_ACTION_KEYS.createDefinition>[]
    ) ||
    !isOneOf(value.targetResourceType, [
      'AUTOMATION_DEFINITION',
      'AUTOMATION_VERSION',
      'AUTOMATION_SCHEDULE',
      'AUTOMATION_RUN',
    ] as const) ||
    !isUuid(value.targetPublicId) ||
    !isPositiveSafeInteger(value.expectedObjectRevision) ||
    !isBoundedString(value.resolvedHref, 1, 512) ||
    !/^\/api\/platform\/v1\/admin\/hris\/[^{}?#]+$/.test(value.resolvedHref) ||
    value.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
    value.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' ||
    (value.targetResourceType === 'AUTOMATION_VERSION'
      ? !isPositiveSafeInteger(value.targetVersion)
      : Object.hasOwn(value, 'targetVersion'))
  ) {
    throw new Error('Automation resource action is invalid.');
  }
  const descriptor = Object.freeze({ ...value }) as ResourceActionDescriptor;
  if (!resourceActionBindingIsExact(descriptor)) {
    throw new Error('Automation resource action binding is invalid.');
  }
  return descriptor;
}

function resourceActionBindingIsExact(action: ResourceActionDescriptor): boolean {
  const definitionBase = `/api/platform/v1/admin/hris/automations/${action.targetPublicId}`;
  const scheduleBase = `/api/platform/v1/admin/hris/automation-schedules/${action.targetPublicId}`;
  const runBase = `/api/platform/v1/admin/hris/automation-runs/${action.targetPublicId}`;
  switch (action.actionKey) {
    case AUTOMATION_ACTION_KEYS.queueRun:
      return (
        action.targetResourceType === 'AUTOMATION_DEFINITION' &&
        action.resolvedHref === `${definitionBase}/runs`
      );
    case AUTOMATION_ACTION_KEYS.retryRun:
      return (
        action.targetResourceType === 'AUTOMATION_RUN' && action.resolvedHref === `${runBase}/retry`
      );
    case AUTOMATION_ACTION_KEYS.createVersion:
      return (
        action.targetResourceType === 'AUTOMATION_DEFINITION' &&
        action.resolvedHref === `${definitionBase}/versions`
      );
    case AUTOMATION_ACTION_KEYS.validateVersion:
      return versionActionBinding(action, definitionBase, 'validate');
    case AUTOMATION_ACTION_KEYS.submitVersion:
      return versionActionBinding(action, definitionBase, 'submit');
    case AUTOMATION_ACTION_KEYS.approveVersion:
      return versionActionBinding(action, definitionBase, 'approve');
    case AUTOMATION_ACTION_KEYS.activateVersion:
      return versionActionBinding(action, definitionBase, 'activate');
    case AUTOMATION_ACTION_KEYS.createSchedule:
      return (
        action.targetResourceType === 'AUTOMATION_DEFINITION' &&
        action.resolvedHref === `${definitionBase}/schedules`
      );
    case AUTOMATION_ACTION_KEYS.submitSchedule:
      return (
        action.targetResourceType === 'AUTOMATION_SCHEDULE' &&
        action.resolvedHref === `${scheduleBase}/submit`
      );
    case AUTOMATION_ACTION_KEYS.approveSchedule:
      return (
        action.targetResourceType === 'AUTOMATION_SCHEDULE' &&
        action.resolvedHref === `${scheduleBase}/approve`
      );
    case AUTOMATION_ACTION_KEYS.activateSchedule:
      return (
        action.targetResourceType === 'AUTOMATION_SCHEDULE' &&
        action.resolvedHref === `${scheduleBase}/activate`
      );
    case AUTOMATION_ACTION_KEYS.suspendSchedule:
      return (
        action.targetResourceType === 'AUTOMATION_SCHEDULE' &&
        action.resolvedHref === `${scheduleBase}/suspend`
      );
    case AUTOMATION_ACTION_KEYS.cancelRun:
      return (
        action.targetResourceType === 'AUTOMATION_RUN' &&
        action.resolvedHref === `${runBase}/cancel`
      );
  }
}

function versionActionBinding(
  action: ResourceActionDescriptor,
  definitionBase: string,
  suffix: string
): boolean {
  return (
    action.targetResourceType === 'AUTOMATION_VERSION' &&
    action.targetVersion !== undefined &&
    action.resolvedHref === `${definitionBase}/versions/${action.targetVersion}/${suffix}`
  );
}

function parseAttempt(value: unknown): AutomationAttemptProjection {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'attemptNumber',
      'selectionMode',
      'selectedItemCount',
      'selectedItemDigest',
      'state',
      'startedAt',
      'completedAt',
    ]) ||
    !isBoundedInteger(value.attemptNumber, 1, 20) ||
    !isOneOf(value.selectionMode, ['ALL_ITEMS', 'FAILED_ITEMS_ONLY'] as const) ||
    !isCount(value.selectedItemCount) ||
    !isDigest(value.selectedItemDigest) ||
    !isOneOf(value.state, RUN_STATES) ||
    !(value.startedAt === null || isInstant(value.startedAt)) ||
    !(value.completedAt === null || isInstant(value.completedAt))
  ) {
    throw new Error('Automation attempt projection is invalid.');
  }
  return Object.freeze({ ...value }) as AutomationAttemptProjection;
}

function parseRunItem(value: unknown): AutomationItemProjection {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'itemPublicId',
      'itemSequence',
      'state',
      'attemptCount',
      'resultDigest',
      'errorCode',
      'effectState',
      'compensationState',
    ]) ||
    !isUuid(value.itemPublicId) ||
    !isBoundedInteger(value.itemSequence, 1, 1_000_000_000) ||
    !isOneOf(value.state, ITEM_STATES) ||
    !isBoundedInteger(value.attemptCount, 0, 20) ||
    !(value.resultDigest === null || isDigest(value.resultDigest)) ||
    !(
      value.errorCode === null ||
      (typeof value.errorCode === 'string' && ERROR_CODE.test(value.errorCode))
    ) ||
    !isOneOf(value.effectState, EFFECT_STATES) ||
    !isOneOf(value.compensationState, COMPENSATION_STATES)
  ) {
    throw new Error('Automation run item projection is invalid.');
  }
  return Object.freeze({ ...value }) as AutomationItemProjection;
}

function parseCheckpoint(value: unknown): AutomationCheckpointProjection {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'checkpointPublicId',
      'attemptNumber',
      'checkpointOrdinal',
      'processedItemCount',
      'processedItemDigest',
      'outputDigest',
      'committedAt',
    ]) ||
    !isUuid(value.checkpointPublicId) ||
    !isBoundedInteger(value.attemptNumber, 1, 20) ||
    !isPositiveSafeInteger(value.checkpointOrdinal) ||
    !isCount(value.processedItemCount) ||
    !isDigest(value.processedItemDigest) ||
    !isDigest(value.outputDigest) ||
    !isInstant(value.committedAt)
  ) {
    throw new Error('Automation checkpoint projection is invalid.');
  }
  return Object.freeze({ ...value }) as AutomationCheckpointProjection;
}

function runProjectionStateIsConsistent(run: AutomationRunProjection): boolean {
  const actions = automationActionsForRun(run);
  if (actions.length !== run.availableActions.length) return false;
  if (['SUCCEEDED', 'CANCELLED', 'DEAD_LETTER'].includes(run.state)) {
    return (
      Boolean(run.outputDigest) &&
      run.retryEligibleItemCount === 0 &&
      run.cancelEligibility === 'INELIGIBLE'
    );
  }
  if (['QUEUED', 'LEASED'].includes(run.state)) {
    return run.retryEligibleItemCount === 0 && run.cancelEligibility === 'ELIGIBLE_NO_EFFECT';
  }
  if (run.state === 'RUNNING') return run.retryEligibleItemCount === 0;
  if (['PARTIAL', 'FAILED'].includes(run.state)) return run.cancelEligibility === 'INELIGIBLE';
  return true;
}

function hasProjectedRedaction(item: AutomationCatalogItem): boolean {
  return Object.entries(item).some(
    ([key, value]) => key !== 'availableActions' && isProjectedRestriction(value)
  );
}

function visibleText<T>(value: ProjectedValue<T>): string | undefined {
  return isProjectedRestriction(value) || value === null ? undefined : String(value);
}

function isFieldDecisionSummary(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['visible', 'masked', 'omitted', 'fieldPolicyRevision']) &&
    isCatalogFields(value.visible) &&
    isCatalogFields(value.masked) &&
    isCatalogFields(value.omitted) &&
    isPositiveSafeInteger(value.fieldPolicyRevision)
  );
}

function isCatalogFields(value: unknown): value is AutomationCatalogField[] {
  return (
    Array.isArray(value) &&
    value.length <= AUTOMATION_CATALOG_FIELDS.length &&
    new Set(value).size === value.length &&
    value.every((item) => isOneOf(item, AUTOMATION_CATALOG_FIELDS))
  );
}

function isProjected(value: unknown, visible: (candidate: unknown) => boolean): boolean {
  return visible(value) || isProjectedRestriction(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key))
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST.test(value);
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isNullableCursor(value: unknown): value is string | null {
  return value === null || isBoundedString(value, 16, 2048);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return isBoundedInteger(value, 1, MAX_SAFE_REVISION);
}

function isCount(value: unknown): value is number {
  return isBoundedInteger(value, 0, 1_000_000_000);
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
