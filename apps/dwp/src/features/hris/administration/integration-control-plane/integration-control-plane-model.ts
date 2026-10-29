import {
  HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS,
  HRIS_INTEGRATION_CONTROL_PLANE_STATES,
} from './integration-control-plane-contract';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  INTEGRATION_ACTION_KEYS,
  INTEGRATION_COMMAND_TYPE_BY_ACTION,
  INTEGRATION_EXECUTION_STATES,
} from './integration-control-plane-types';

import type {
  HrisIntegrationControlPlaneProjection,
  HrisIntegrationControlPlaneState,
} from './integration-control-plane-contract';
import type {
  ConnectorCatalogItem,
  ConnectorCatalogResponse,
  ConnectorExecutionResponse,
  IntegrationActionKey,
  IntegrationCommandReceipt,
  IntegrationFieldGroup,
  IntegrationProjectedField,
  IntegrationProjectionItem,
  IntegrationProjectionResponse,
  SafeProjectedValue,
} from './integration-control-plane-types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;
const ACTIONS = Object.freeze(Object.values(INTEGRATION_ACTION_KEYS));
const COMMAND_TYPES = Object.freeze(Object.values(INTEGRATION_COMMAND_TYPE_BY_ACTION));
const QUERY_STATES = ['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'] as const;
const RECEIPT_STATES = [
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'RESULT_UNKNOWN',
] as const;
const FORBIDDEN_PROJECTED_KEY =
  /(?:secret|password|credential|access.?token|private.?key|raw|payload|employee|sample.?ref|mapping.?ref|provider.?receipt.?ref)/i;
const SAFE_SUMMARY_KEYS = [
  'displayName',
  'connectorKey',
  'connectorType',
  'type',
  'state',
  'status',
  'version',
  'definitionVersion',
  'mappingVersion',
  'policyRevision',
  'operationMode',
  'retryMode',
  'effectiveFrom',
  'effectiveTo',
] as const;

const PROJECTION_FIELD_GROUPS = Object.freeze({
  PRIMARY_HRIS_SETTINGS: Object.freeze([
    'CONNECTOR_METADATA',
    'POLICY_VERSION',
    'EFFECTIVE_STATUS',
  ]),
  PRIMARY_DWP_CONTROL: Object.freeze([
    'CONNECTOR_METADATA',
    'EXECUTION_POLICY',
    'EFFECTIVE_STATUS',
  ]),
} satisfies Readonly<
  Record<HrisIntegrationControlPlaneProjection, readonly IntegrationFieldGroup[]>
>);

export type IntegrationProjectionRow = Readonly<{
  key: string;
  title: string;
  context: string;
  effectiveStatus: string;
  effectiveStatusRevision: number;
  actions: readonly IntegrationActionKey[];
  redacted: boolean;
  item: IntegrationProjectionItem;
}>;

export function assertIntegrationProjectionResponse(
  value: unknown,
  expectedProjection?: HrisIntegrationControlPlaneProjection
): IntegrationProjectionResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['projection', 'state', 'items']) ||
    !isOneOf(value.projection, Object.keys(HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS)) ||
    !isOneOf(value.state, QUERY_STATES) ||
    !Array.isArray(value.items) ||
    value.items.length > 100 ||
    (expectedProjection !== undefined && value.projection !== expectedProjection)
  ) {
    throw new Error('Integration projection response is invalid.');
  }

  const projection = value.projection as HrisIntegrationControlPlaneProjection;
  const state = value.state as IntegrationProjectionResponse['state'];
  const items = Object.freeze(value.items.map((item) => parseProjectionItem(item, projection)));
  if ((state === 'EMPTY' || state === 'UNAVAILABLE') && items.length > 0) {
    throw new Error('Empty or unavailable integration projection cannot retain rows.');
  }
  if (state !== 'COMPLETE' && items.some(({ availableActions }) => availableActions.length > 0)) {
    throw new Error('Non-current integration evidence cannot expose commands.');
  }
  return Object.freeze({ projection, state, items });
}

export function assertConnectorCatalogResponse(value: unknown): ConnectorCatalogResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['asOf', 'items', 'freshUntil', 'staleAfter'], ['nextCursor']) ||
    !isInstant(value.asOf) ||
    !isInstant(value.freshUntil) ||
    !isInstant(value.staleAfter) ||
    (value.nextCursor !== undefined && !isCursor(value.nextCursor)) ||
    !Array.isArray(value.items) ||
    value.items.length > 100
  ) {
    throw new Error('Connector catalog response is invalid.');
  }
  return Object.freeze({
    asOf: value.asOf,
    ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }),
    items: Object.freeze(value.items.map(parseCatalogItem)),
    freshUntil: value.freshUntil,
    staleAfter: value.staleAfter,
  }) as ConnectorCatalogResponse;
}

export function assertConnectorExecutionResponse(value: unknown): ConnectorExecutionResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'executionId',
      'mappingVersion',
      'state',
      'sourceCount',
      'acceptedCount',
      'rejectedCount',
      'selectedItemCount',
      'selectedItemDigest',
      'reconciliationDigest',
      'aggregateVersion',
    ]) ||
    !isUuid(value.executionId) ||
    !isPositiveInteger(value.mappingVersion) ||
    !isOneOf(value.state, INTEGRATION_EXECUTION_STATES) ||
    !isCount(value.sourceCount) ||
    !isCount(value.acceptedCount) ||
    !isCount(value.rejectedCount) ||
    !isCount(value.selectedItemCount) ||
    !isDigest(value.selectedItemDigest) ||
    !(value.reconciliationDigest === null || isDigest(value.reconciliationDigest)) ||
    !isCount(value.aggregateVersion) ||
    value.acceptedCount + value.rejectedCount > value.sourceCount ||
    value.selectedItemCount > value.sourceCount
  ) {
    throw new Error('Connector execution response is invalid.');
  }
  return Object.freeze({ ...value }) as ConnectorExecutionResponse;
}

export function assertIntegrationCommandReceipt(value: unknown): IntegrationCommandReceipt {
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
    !isOneOf(value.commandType, COMMAND_TYPES) ||
    !isOneOf(value.originatingAction, ACTIONS) ||
    !isUuid(value.subjectPrincipalPublicId) ||
    !isDigest(value.populationScopeDigest) ||
    !isPositiveInteger(value.fieldPolicyRevision) ||
    !isBoundedString(value.purposeCode, 3, 64) ||
    !isPositiveInteger(value.authorizationRevision) ||
    !isOneOf(value.status, RECEIPT_STATES) ||
    !isUuid(value.correlationId) ||
    !isDigest(value.requestDigest) ||
    !isInstant(value.createdAt) ||
    (value.aggregateVersion !== undefined && !isCount(value.aggregateVersion)) ||
    (value.resultRef !== undefined && !isBoundedString(value.resultRef, 1, 500))
  ) {
    throw new Error('Integration command receipt is invalid.');
  }
  if ((value.aggregateVersion === undefined) !== (value.resultRef === undefined)) {
    throw new Error('Integration receipt result binding is incomplete.');
  }
  return Object.freeze({ ...value }) as IntegrationCommandReceipt;
}

export function resolveIntegrationControlPlaneState(
  input: Readonly<{
    loading: boolean;
    forbidden: boolean;
    stepUpRequired: boolean;
    readFailed: boolean;
    retryable: boolean;
    commandResultUnknown?: boolean;
    projection?: IntegrationProjectionResponse;
  }>
): HrisIntegrationControlPlaneState {
  if (input.forbidden) return 'forbidden';
  if (input.stepUpRequired) return 'step-up';
  if (input.loading) return 'loading';
  if (input.readFailed) return input.retryable ? 'retry' : 'unavailable';
  if (input.commandResultUnknown) return 'result-unknown';
  if (!input.projection) return 'unavailable';
  const state = input.projection.state.toLowerCase();
  if (!isOneOf(state, HRIS_INTEGRATION_CONTROL_PLANE_STATES)) {
    throw new Error('Integration UI state is not sealed.');
  }
  return state;
}

export function integrationProjectionRows(
  projection: IntegrationProjectionResponse
): readonly IntegrationProjectionRow[] {
  return projection.items.map((item) => {
    const connector = item.fields.CONNECTOR_METADATA;
    const status = item.fields.EFFECTIVE_STATUS;
    const redacted = Object.values(item.fields).some(({ decision }) => decision === 'MASK');
    return Object.freeze({
      key: item.itemPublicId,
      title: summarizeField(connector, 'Restricted connector'),
      context: summarizeContext(item.fields),
      effectiveStatus: summarizeField(status, 'Restricted status'),
      effectiveStatusRevision: item.effectiveStatusRevision,
      actions: integrationActionsForItem(projection, item),
      redacted,
      item,
    });
  });
}

export function integrationActionsForItem(
  projection: IntegrationProjectionResponse,
  item: IntegrationProjectionItem
): readonly IntegrationActionKey[] {
  if (
    projection.state !== 'COMPLETE' ||
    Object.values(item.fields).some(({ decision }) => decision !== 'VIEW')
  ) {
    return Object.freeze([]);
  }
  return item.availableActions;
}

export function assertDualProjectionIdentity(
  hris: IntegrationProjectionResponse,
  dwp: IntegrationProjectionResponse
): void {
  if (hris.projection !== 'PRIMARY_HRIS_SETTINGS' || dwp.projection !== 'PRIMARY_DWP_CONTROL') {
    throw new Error('Dual integration projection variants are invalid.');
  }
  const hrisIdentity = new Map(
    hris.items.map(({ itemPublicId, effectiveStatusRevision }) => [
      itemPublicId,
      effectiveStatusRevision,
    ])
  );
  const dwpIdentity = new Map(
    dwp.items.map(({ itemPublicId, effectiveStatusRevision }) => [
      itemPublicId,
      effectiveStatusRevision,
    ])
  );
  if (
    hrisIdentity.size !== dwpIdentity.size ||
    [...hrisIdentity].some(([itemPublicId, revision]) => dwpIdentity.get(itemPublicId) !== revision)
  ) {
    throw new Error('Dual integration projections do not share one owner identity revision.');
  }
}

export function integrationActionLabel(action: IntegrationActionKey): string {
  const labels: Readonly<Record<IntegrationActionKey, string>> = {
    [INTEGRATION_ACTION_KEYS.createDefinition]: 'New connector',
    [INTEGRATION_ACTION_KEYS.testConnector]: 'Test connection',
    [INTEGRATION_ACTION_KEYS.dryRunMapping]: 'Run mapping preview',
    [INTEGRATION_ACTION_KEYS.createExecution]: 'Start execution',
    [INTEGRATION_ACTION_KEYS.validateDefinition]: 'Validate definition',
    [INTEGRATION_ACTION_KEYS.submitDefinition]: 'Submit definition',
    [INTEGRATION_ACTION_KEYS.approveDefinition]: 'Approve definition',
    [INTEGRATION_ACTION_KEYS.activateDefinition]: 'Activate definition',
    [INTEGRATION_ACTION_KEYS.createMapping]: 'New mapping version',
    [INTEGRATION_ACTION_KEYS.validateMapping]: 'Validate mapping',
    [INTEGRATION_ACTION_KEYS.submitMapping]: 'Submit mapping',
    [INTEGRATION_ACTION_KEYS.approveMapping]: 'Approve mapping',
    [INTEGRATION_ACTION_KEYS.activateMapping]: 'Activate mapping',
    [INTEGRATION_ACTION_KEYS.reconcileExecution]: 'Reconcile outcome',
    [INTEGRATION_ACTION_KEYS.retryExecution]: 'Retry rejected items',
    [INTEGRATION_ACTION_KEYS.cancelExecution]: 'Cancel or compensate',
  };
  return labels[action];
}

export function formatIntegrationTimestamp(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'Unavailable';
  return formatDate(time, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
}

function parseProjectionItem(
  value: unknown,
  projection: HrisIntegrationControlPlaneProjection
): IntegrationProjectionItem {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'itemPublicId',
      'effectiveStatusRevision',
      'fields',
      'availableActions',
    ]) ||
    !isUuid(value.itemPublicId) ||
    !isPositiveInteger(value.effectiveStatusRevision) ||
    !isRecord(value.fields) ||
    !Array.isArray(value.availableActions) ||
    value.availableActions.some((action) => !isOneOf(action, ACTIONS)) ||
    new Set(value.availableActions).size !== value.availableActions.length
  ) {
    throw new Error('Integration projection item is invalid.');
  }
  const allowedGroups = PROJECTION_FIELD_GROUPS[projection];
  if (Object.keys(value.fields).some((field) => !allowedGroups.includes(field as never))) {
    throw new Error('Integration projection contains a field outside its policy group.');
  }
  const fields = Object.freeze(
    Object.fromEntries(
      Object.entries(value.fields).map(([group, field]) => [group, parseProjectedField(field)])
    )
  ) as IntegrationProjectionItem['fields'];
  const availableActions = Object.freeze([
    ...value.availableActions,
  ]) as readonly IntegrationActionKey[];
  if (
    availableActions.length > 0 &&
    (Object.keys(fields).length !== allowedGroups.length ||
      allowedGroups.some((group) => fields[group]?.decision !== 'VIEW'))
  ) {
    throw new Error('Incomplete or masked integration evidence cannot expose commands.');
  }
  return Object.freeze({
    itemPublicId: value.itemPublicId,
    effectiveStatusRevision: value.effectiveStatusRevision,
    fields,
    availableActions,
  });
}

function parseProjectedField(value: unknown): IntegrationProjectedField {
  if (!isRecord(value) || !hasExactKeys(value, ['decision', 'value'])) {
    throw new Error('Integration projected field is invalid.');
  }
  if (value.decision === 'MASK' && value.value === null) {
    return Object.freeze({ decision: 'MASK', value: null });
  }
  if (value.decision === 'VIEW' && isSafeProjectedValue(value.value)) {
    return Object.freeze({ decision: 'VIEW', value: freezeProjectedValue(value.value) });
  }
  throw new Error('Integration projected field decision is invalid.');
}

function parseCatalogItem(value: unknown): ConnectorCatalogItem {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['publicId', 'key', 'type', 'state', 'version', 'updatedAt']) ||
    !isUuid(value.publicId) ||
    !isBoundedString(value.key, 1, 128) ||
    !isBoundedString(value.type, 1, 80) ||
    !isBoundedString(value.state, 1, 80) ||
    !isCount(value.version) ||
    !isInstant(value.updatedAt)
  ) {
    throw new Error('Connector catalog item is invalid.');
  }
  return Object.freeze({ ...value }) as ConnectorCatalogItem;
}

function summarizeContext(fields: IntegrationProjectionItem['fields']): string {
  const policy = fields.POLICY_VERSION ?? fields.EXECUTION_POLICY;
  return summarizeField(policy, 'Policy evidence restricted');
}

function summarizeField(field: IntegrationProjectedField | undefined, fallback: string): string {
  if (!field || field.decision === 'MASK') return fallback;
  const { value } = field;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) return 'Not set';
  if (Array.isArray(value)) return value.length === 0 ? 'None' : `${value.length} verified values`;
  if (!isRecord(value)) return 'Verified';
  const parts = SAFE_SUMMARY_KEYS.flatMap((key) => {
    const candidate = value[key];
    return typeof candidate === 'string' || typeof candidate === 'number'
      ? [String(candidate)]
      : [];
  });
  return parts.length > 0 ? parts.slice(0, 3).join(' · ') : 'Verified';
}

function isSafeProjectedValue(value: unknown, depth = 0): value is SafeProjectedValue {
  if (depth > 5) return false;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return typeof value !== 'string' || value.length <= 1000;
  }
  if (Array.isArray(value)) {
    return value.length <= 100 && value.every((item) => isSafeProjectedValue(item, depth + 1));
  }
  if (!isRecord(value) || Object.keys(value).length > 40) return false;
  return Object.entries(value).every(
    ([key, item]) =>
      !FORBIDDEN_PROJECTED_KEY.test(key) &&
      key.length <= 80 &&
      isSafeProjectedValue(item, depth + 1)
  );
}

function freezeProjectedValue(value: SafeProjectedValue): SafeProjectedValue {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeProjectedValue));
  if (value !== null && typeof value === 'object') {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, freezeProjectedValue(item)])
      )
    );
  }
  return value;
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

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST.test(value);
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 2048;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}
