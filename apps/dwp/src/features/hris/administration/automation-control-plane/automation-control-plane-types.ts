import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

export const AUTOMATION_CONTROL_PLANE_EXPERIENCE = Object.freeze({
  primaryUsers: Object.freeze([
    'HRIS configuration author',
    'HRIS configuration publisher',
    'HRIS integration executor',
  ]),
  operationalQuestion:
    'Which tenant automation needs governance intervention, and is its next transition safe and authorized?',
  primaryAction:
    'Review an actionable definition, version, schedule, or run and submit only the server-authorized next transition.',
  pageArchetype: 'COMMAND_CENTER_LIST_DETAIL',
  customerImpactFirst: true,
  mounted: false,
} as const);

export const AUTOMATION_RESOURCE_TYPES = [
  'AUTOMATION_DEFINITION',
  'AUTOMATION_VERSION',
  'AUTOMATION_SCHEDULE',
] as const;
export type AutomationResourceType = (typeof AUTOMATION_RESOURCE_TYPES)[number];

export const AUTOMATION_CATALOG_FIELDS = [
  'definitionPublicId',
  'automationKey',
  'ownerDomain',
  'derivedLifecycleState',
  'activeVersionNumber',
  'versionNumber',
  'lifecycleState',
  'handlerKey',
  'handlerContractVersion',
  'objectRevision',
  'schedulePublicId',
  'pinnedVersionNumber',
  'timezone',
  'nextFireAt',
] as const;
export type AutomationCatalogField = (typeof AUTOMATION_CATALOG_FIELDS)[number];

export const AUTOMATION_SCOPE_TYPES = [
  'GLOBAL',
  'TENANT',
  'LEGAL_ENTITY',
  'ORGANIZATION',
  'POPULATION',
  'SUBJECT',
] as const;
export type AutomationScopeType = (typeof AUTOMATION_SCOPE_TYPES)[number];

export type MaskedField = Readonly<{ decision: 'MASK'; displayValue: '••••' }>;
export type OmittedField = Readonly<{ decision: 'OMIT' }>;
export type ProjectedValue<T> = T | MaskedField | OmittedField;

export const AUTOMATION_ACTION_KEYS = {
  createDefinition: 'hris.action.sys.post.platform.v1.admin.hris.automations',
  queueRun: 'hris.action.sys.post.platform.v1.admin.hris.automations.resource.runs',
  retryRun: 'hris.action.sys.post.platform.v1.admin.hris.automation-runs.resource.retry',
  createVersion: 'hris.action.sys.post.platform.v1.admin.hris.automations.resource.versions',
  validateVersion:
    'hris.action.sys.post.platform.v1.admin.hris.automations.resource.versions.resource.validate',
  submitVersion:
    'hris.action.sys.post.platform.v1.admin.hris.automations.resource.versions.resource.submit',
  approveVersion:
    'hris.action.sys.post.platform.v1.admin.hris.automations.resource.versions.resource.approve',
  activateVersion:
    'hris.action.sys.post.platform.v1.admin.hris.automations.resource.versions.resource.activate',
  createSchedule: 'hris.action.sys.post.platform.v1.admin.hris.automations.resource.schedules',
  submitSchedule:
    'hris.action.sys.post.platform.v1.admin.hris.automation-schedules.resource.submit',
  approveSchedule:
    'hris.action.sys.post.platform.v1.admin.hris.automation-schedules.resource.approve',
  activateSchedule:
    'hris.action.sys.post.platform.v1.admin.hris.automation-schedules.resource.activate',
  suspendSchedule:
    'hris.action.sys.post.platform.v1.admin.hris.automation-schedules.resource.suspend',
  cancelRun: 'hris.action.sys.post.platform.v1.admin.hris.automation-runs.resource.cancel',
} as const;
export type AutomationActionKey =
  (typeof AUTOMATION_ACTION_KEYS)[keyof typeof AUTOMATION_ACTION_KEYS];

export type CollectionActionDescriptor = Readonly<{
  method: 'POST';
  actionKey: typeof AUTOMATION_ACTION_KEYS.createDefinition;
  targetResourceType: 'AUTOMATION_DEFINITION_COLLECTION';
  resolvedHref: '/api/platform/v1/admin/hris/automations';
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type ResourceActionDescriptor = Readonly<{
  method: 'POST';
  actionKey: Exclude<AutomationActionKey, typeof AUTOMATION_ACTION_KEYS.createDefinition>;
  targetResourceType:
    'AUTOMATION_DEFINITION' | 'AUTOMATION_VERSION' | 'AUTOMATION_SCHEDULE' | 'AUTOMATION_RUN';
  targetPublicId: string;
  targetVersion?: number;
  expectedObjectRevision: number;
  resolvedHref: string;
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type AutomationDefinitionItem = Readonly<{
  resourceType: 'AUTOMATION_DEFINITION';
  definitionPublicId: ProjectedValue<string>;
  automationKey: ProjectedValue<string>;
  ownerDomain: ProjectedValue<'HRM' | 'PER' | 'TIM' | 'PAY'>;
  derivedLifecycleState: ProjectedValue<'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED'>;
  activeVersionNumber: ProjectedValue<number | null>;
  objectRevision: ProjectedValue<number>;
  availableActions: readonly ResourceActionDescriptor[];
}>;

export type AutomationVersionItem = Readonly<{
  resourceType: 'AUTOMATION_VERSION';
  definitionPublicId: ProjectedValue<string>;
  versionNumber: ProjectedValue<number>;
  lifecycleState: ProjectedValue<
    'DRAFT' | 'VALIDATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED'
  >;
  handlerKey: ProjectedValue<string>;
  handlerContractVersion: ProjectedValue<string>;
  objectRevision: ProjectedValue<number>;
  availableActions: readonly ResourceActionDescriptor[];
}>;

export type AutomationScheduleItem = Readonly<{
  resourceType: 'AUTOMATION_SCHEDULE';
  schedulePublicId: ProjectedValue<string>;
  definitionPublicId: ProjectedValue<string>;
  pinnedVersionNumber: ProjectedValue<number>;
  lifecycleState: ProjectedValue<
    'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED'
  >;
  timezone: ProjectedValue<string>;
  nextFireAt: ProjectedValue<string | null>;
  objectRevision: ProjectedValue<number>;
  availableActions: readonly ResourceActionDescriptor[];
}>;

export type AutomationCatalogItem =
  AutomationDefinitionItem | AutomationVersionItem | AutomationScheduleItem;

export type AutomationCatalogProjection = Readonly<{
  asOf: string;
  items: readonly AutomationCatalogItem[];
  nextCursor: string | null;
  freshUntil: string;
  staleAfter: string;
  collectionActions: readonly CollectionActionDescriptor[];
  fieldDecisionSummary: Readonly<{
    visible: readonly AutomationCatalogField[];
    masked: readonly AutomationCatalogField[];
    omitted: readonly AutomationCatalogField[];
    fieldPolicyRevision: number;
  }>;
  authorizationRevision: number;
  correlationId: string;
}>;

export type AutomationRunState =
  | 'QUEUED'
  | 'LEASED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'
  | 'DEAD_LETTER';

export type AutomationAttemptProjection = Readonly<{
  attemptNumber: number;
  selectionMode: 'ALL_ITEMS' | 'FAILED_ITEMS_ONLY';
  selectedItemCount: number;
  selectedItemDigest: string;
  state: AutomationRunState;
  startedAt: string | null;
  completedAt: string | null;
}>;

export type AutomationItemProjection = Readonly<{
  itemPublicId: string;
  itemSequence: number;
  state:
    | 'PENDING'
    | 'LEASED'
    | 'RUNNING'
    | 'SUCCEEDED'
    | 'FAILED_RETRYABLE'
    | 'FAILED_FINAL'
    | 'CANCELLED'
    | 'DEAD_LETTER';
  attemptCount: number;
  resultDigest: string | null;
  errorCode: string | null;
  effectState: 'NOT_STARTED' | 'PREPARED' | 'NO_EFFECT_CONFIRMED' | 'COMMITTED' | 'RESULT_UNKNOWN';
  compensationState:
    'NOT_REQUIRED' | 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';
}>;

export type AutomationCheckpointProjection = Readonly<{
  checkpointPublicId: string;
  attemptNumber: number;
  checkpointOrdinal: number;
  processedItemCount: number;
  processedItemDigest: string;
  outputDigest: string;
  committedAt: string;
}>;

export type AutomationRunProjection = Readonly<{
  runPublicId: string;
  definitionPublicId: string;
  versionNumber: number;
  state: AutomationRunState;
  objectRevision: number;
  selectionMode: 'ALL_ITEMS' | 'FAILED_ITEMS_ONLY';
  itemTotal: number;
  itemSucceeded: number;
  itemFailed: number;
  outputDigest: string | null;
  retryBudgetRemaining: number;
  retryEligibleItemCount: number;
  cancelEligibility: 'ELIGIBLE_NO_EFFECT' | 'ELIGIBLE_ALL_REQUIRED_PATHS' | 'INELIGIBLE';
  attempts: readonly AutomationAttemptProjection[];
  items: readonly AutomationItemProjection[];
  checkpoints: readonly AutomationCheckpointProjection[];
  nextAttemptCursor: string | null;
  nextItemCursor: string | null;
  nextCheckpointCursor: string | null;
  availableActions: readonly ResourceActionDescriptor[];
  authorizationRevision: number;
  correlationId: string;
}>;

export type AutomationCommandReceipt = Readonly<{
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
  aggregateVersion?: number;
  resultRef?: string;
}>;

export type AutomationCatalogQuery = Readonly<{
  asOf: string;
  fields?: readonly AutomationCatalogField[];
  freshness?: 'FRESH_ONLY' | 'ALLOW_STALE';
  limit?: number;
  cursor?: string;
  filter?: string;
  resourceTypes?: readonly AutomationResourceType[];
}>;

export type AutomationRunQuery = Readonly<{
  asOf: string;
  freshness?: 'FRESH_ONLY' | 'ALLOW_STALE';
  limit?: number;
  attemptCursor?: string;
  itemCursor?: string;
  checkpointCursor?: string;
}>;

export type AutomationReadContext = Readonly<{
  correlationId: string;
  contextScopeKey?: string;
  purposeCode?: string;
  signal?: AbortSignal;
}>;

export type AutomationCommandAuthority = Readonly<{
  governance: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectRevision?: number;
}>;

export type CreateAutomationDefinitionBody = Readonly<{
  automationKey: string;
  displayName: string;
  description: string | null;
  ownerDomain: 'HRM' | 'PER' | 'TIM' | 'PAY';
}>;
export type QueueAutomationRunBody = Readonly<{
  scopeType: AutomationScopeType;
  scopeId: string | null;
  inputReference: string;
  inputDigest: string;
  expectedItemCount: number;
}>;
export type RetryAutomationRunBody = Readonly<{
  evidenceDigest: string;
}>;
export type CreateAutomationVersionBody = Readonly<{
  definitionPayload: Readonly<Record<string, unknown>>;
  definitionDigest: string;
  executionPolicy: Readonly<Record<string, unknown>>;
  executionPolicyDigest: string;
  manualConcurrencyKeyTemplate: string;
  compensationPolicyRef: string | null;
  compensationPolicyDigest: string;
  handlerOwnerService: string;
  handlerKey: string;
  handlerContractVersion: string;
  handlerManifestRevision: number;
  handlerManifestDigest: string;
  signatureKeyId: string;
  signature: string;
  signatureDigest: string;
  inputSchemaRef: string;
  inputSchemaDigest: string;
  receiptSchemaRef: string;
  receiptSchemaDigest: string;
  allowedScopeTypes: readonly AutomationScopeType[];
  retryMode: 'NONE' | 'FAILED_ITEMS_ONLY' | 'WHOLE_INVOCATION';
  maxAttempts: number;
}>;
export type AutomationLifecycleBody = Readonly<{
  evidenceDigest: string;
  reason: string | null;
}>;
export type CreateAutomationScheduleBody = Readonly<{
  pinnedVersionNumber: number;
  expression: string;
  timezone: string;
  timezoneDatabaseRevision: string;
  inputTemplateRef: string;
  inputTemplateDigest: string;
  concurrencyKeyTemplate: string;
  schedulePolicyDigest: string;
}>;
export type CancelAutomationRunBody = Readonly<{
  reason: string;
  evidenceDigest: string;
}>;

type DefinitionCommand<K extends string, B> = Readonly<{
  kind: K;
  definitionPublicId: string;
  body: B;
}>;
type VersionCommand<K extends string, B> = DefinitionCommand<K, B> &
  Readonly<{ versionNumber: number }>;
type ScheduleCommand<K extends string, B> = Readonly<{
  kind: K;
  schedulePublicId: string;
  body: B;
}>;
type RunCommand<K extends string, B> = Readonly<{ kind: K; runPublicId: string; body: B }>;

export type AutomationCommand =
  | Readonly<{ kind: 'CREATE_DEFINITION'; body: CreateAutomationDefinitionBody }>
  | DefinitionCommand<'QUEUE_RUN', QueueAutomationRunBody>
  | RunCommand<'RETRY_RUN', RetryAutomationRunBody>
  | DefinitionCommand<'CREATE_VERSION', CreateAutomationVersionBody>
  | VersionCommand<'VALIDATE_VERSION', AutomationLifecycleBody>
  | VersionCommand<'SUBMIT_VERSION', AutomationLifecycleBody>
  | VersionCommand<'APPROVE_VERSION', AutomationLifecycleBody>
  | VersionCommand<'ACTIVATE_VERSION', AutomationLifecycleBody>
  | DefinitionCommand<'CREATE_SCHEDULE', CreateAutomationScheduleBody>
  | ScheduleCommand<'SUBMIT_SCHEDULE', AutomationLifecycleBody>
  | ScheduleCommand<'APPROVE_SCHEDULE', AutomationLifecycleBody>
  | ScheduleCommand<'ACTIVATE_SCHEDULE', AutomationLifecycleBody>
  | ScheduleCommand<'SUSPEND_SCHEDULE', AutomationLifecycleBody>
  | RunCommand<'CANCEL_RUN', CancelAutomationRunBody>;

export type AutomationControlPlaneAction = Readonly<{
  descriptor: CollectionActionDescriptor | ResourceActionDescriptor;
  target?: AutomationCatalogItem | AutomationRunProjection;
}>;
