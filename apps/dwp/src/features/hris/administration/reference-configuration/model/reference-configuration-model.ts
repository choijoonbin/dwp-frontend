export const REFERENCE_CONFIGURATION_RUNTIME_FLAG =
  'VITE_HRIS_REFERENCE_CONFIGURATION_ENABLED' as const;

export type ReferenceConfigurationRuntimeState = 'OFF' | 'ON';
export type ReferenceConfigurationDomain = 'HRM' | 'PER' | 'TIM' | 'PAY' | 'SYS';
export type ReferenceConfigurationLifecycle =
  | 'DRAFT'
  | 'VALIDATED'
  | 'SIMULATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'RETIRED'
  | 'FAILED_ACTIVATION';

export type ReferenceConfigurationLifecycleAction =
  'VALIDATE' | 'SIMULATE' | 'SUBMIT' | 'APPROVE' | 'SCHEDULE' | 'PUBLISH' | 'ROLLBACK' | 'RETIRE';

export type ReferenceConfigurationQueryState = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';

export type ReferenceConfigurationAction = Readonly<{
  actionKey: string;
  method: 'POST';
  hrefTemplate: string;
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type ReferenceConfigurationWorkbenchItem = Readonly<{
  itemPublicId: string;
  title: string;
  statusCode: ReferenceConfigurationLifecycle | 'RESTRICTED';
  fieldGroups: Readonly<Record<string, unknown>>;
  deepLink: Readonly<{ route: '/hr/settings/reference-data'; resourcePublicId: string }>;
  availableActions: readonly ReferenceConfigurationAction[];
}>;

export type ReferenceConfigurationWorkbench = Readonly<{
  projectionVersion: '1';
  asOf: string;
  variantKey: 'REFERENCE';
  queryState: Readonly<{
    state: ReferenceConfigurationQueryState;
    scopeDecisionRevision: string;
    freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
    nextCursor: string | null;
    fieldDecisionSummary: Readonly<{
      viewCount: number;
      maskedCount: number;
      omittedCount: number;
    }>;
    partialFailures: readonly Readonly<{
      componentKey: string;
      errorCode: string;
      correlationId: string;
      retryable: boolean;
    }>[];
    correlationId: string;
    cachePolicy: Readonly<{
      authorizationDecisionRevision: string;
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1';
      maxAgeSeconds: number;
    }>;
  }>;
  items: readonly ReferenceConfigurationWorkbenchItem[];
}>;

export type ReferenceConfigurationVersion = Readonly<{
  configurationId: string;
  version: number;
  state: ReferenceConfigurationLifecycle;
  effectiveFrom: string;
  effectiveTo: string | null;
  schemaKey: string;
  schemaVersion: number;
  payloadDigest: string;
  approvalReceiptId: string | null;
  aggregateVersion: number;
}>;

export type ReferenceConfigurationCommandReceipt = Readonly<{
  receiptId: string;
  commandType: string;
  originatingAction: string;
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: string;
  authorizationRevision: number;
  status: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN';
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion: number;
  resultRef: string;
}>;

export type ReferenceConfigurationCommandInput = Readonly<{
  action: ReferenceConfigurationLifecycleAction;
  configurationId: string;
  version: number;
  aggregateVersion: number;
}>;

/**
 * Control-owned command seam. This SYS feature never manufactures governance, step-up, or
 * high-risk catalog authority; an activated shell must inject the owner that holds those facts.
 */
export type ReferenceConfigurationCommandOwner = Readonly<{
  execute(input: ReferenceConfigurationCommandInput): Promise<unknown>;
}>;

export type ReferenceConfigurationCommandState =
  'IDLE' | 'RUNNING' | 'SUCCEEDED' | 'STALE' | 'ERROR';

export type ReferenceConfigurationViewState =
  'LOADING' | 'READY' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' | 'DENIED' | 'ERROR';

const LIFECYCLE_ACTIONS: Readonly<
  Record<ReferenceConfigurationLifecycle, readonly ReferenceConfigurationLifecycleAction[]>
> = {
  DRAFT: ['VALIDATE'],
  VALIDATED: ['SIMULATE'],
  SIMULATED: ['SUBMIT'],
  PENDING_APPROVAL: ['APPROVE'],
  APPROVED: ['SCHEDULE', 'PUBLISH'],
  SCHEDULED: ['PUBLISH'],
  PUBLISHED: ['ROLLBACK', 'RETIRE'],
  REJECTED: [],
  RETIRED: [],
  FAILED_ACTIVATION: ['ROLLBACK'],
};

export function referenceConfigurationRuntimeState(
  enabled: boolean
): ReferenceConfigurationRuntimeState {
  return enabled ? 'ON' : 'OFF';
}

export function referenceConfigurationActions(
  lifecycle: ReferenceConfigurationLifecycle
): readonly ReferenceConfigurationLifecycleAction[] {
  return LIFECYCLE_ACTIONS[lifecycle];
}

export function referenceConfigurationCommandType(
  action: ReferenceConfigurationLifecycleAction
): string {
  return `${action}_VERSION`;
}

export function referenceConfigurationOriginatingAction(
  action: ReferenceConfigurationLifecycleAction
): string {
  return `configuration.version.${action.toLowerCase()}`;
}

export function resolveReferenceConfigurationViewState(input: {
  loading: boolean;
  denied: boolean;
  failed: boolean;
  workbench?: ReferenceConfigurationWorkbench;
}): ReferenceConfigurationViewState {
  if (input.denied) return 'DENIED';
  if (input.loading) return 'LOADING';
  if (input.failed) return 'ERROR';
  if (!input.workbench || input.workbench.queryState.state === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (input.workbench.queryState.state === 'PARTIAL') return 'PARTIAL';
  if (input.workbench.queryState.state === 'EMPTY') return 'EMPTY';
  return 'READY';
}

export function assertReferenceConfigurationReceipt(
  value: unknown,
  expected: { commandType: string; originatingAction: string; resultRefPrefix: string }
): ReferenceConfigurationCommandReceipt {
  if (!isRecord(value)) throw new Error('Reference-configuration receipt is invalid.');
  if (
    !isUuid(value.receiptId) ||
    value.commandType !== expected.commandType ||
    value.originatingAction !== expected.originatingAction ||
    value.purposeCode !== 'HRIS_SYSTEM_ADMIN' ||
    value.status !== 'SUCCEEDED' ||
    !isUuid(value.subjectPrincipalPublicId) ||
    typeof value.populationScopeDigest !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(value.populationScopeDigest) ||
    !isPositiveRevision(value.fieldPolicyRevision) ||
    !isPositiveRevision(value.authorizationRevision) ||
    typeof value.resultRef !== 'string' ||
    !matchesResultRef(value.resultRef, expected.resultRefPrefix) ||
    !isUuid(value.correlationId) ||
    typeof value.requestDigest !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(value.requestDigest) ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.aggregateVersion !== 'number' ||
    !Number.isSafeInteger(value.aggregateVersion) ||
    value.aggregateVersion < 0
  ) {
    throw new Error('Reference-configuration receipt identity does not match the command.');
  }
  return value as ReferenceConfigurationCommandReceipt;
}

function matchesResultRef(value: string, expected: string): boolean {
  if (!expected.endsWith('/')) return value === expected;
  return value.startsWith(expected) && /^[1-9][0-9]*$/.test(value.slice(expected.length));
}

function isPositiveRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

export function isReferenceConfigurationWorkbench(
  value: unknown
): value is ReferenceConfigurationWorkbench {
  if (!isRecord(value) || !isRecord(value.queryState) || !Array.isArray(value.items)) return false;
  const state = value.queryState.state;
  if (!['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'].includes(String(state))) return false;
  if ((state === 'EMPTY' || state === 'UNAVAILABLE') && value.items.length !== 0) return false;
  if (
    state === 'PARTIAL' &&
    (!Array.isArray(value.queryState.partialFailures) ||
      value.queryState.partialFailures.length === 0)
  ) {
    return false;
  }
  return (
    value.projectionVersion === '1' &&
    value.variantKey === 'REFERENCE' &&
    typeof value.asOf === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
