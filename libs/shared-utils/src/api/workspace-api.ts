import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

export type WorkspacePriority = 'high' | 'medium' | 'low';
export type WorkspaceWorkStatus =
  'open' | 'due-soon' | 'in-progress' | 'waiting' | 'completed' | 'cancelled' | 'archived';
export type WorkspaceWorkType = 'Approval' | 'Task' | 'Service' | 'Required' | 'Review';

export type WorkspaceWorkItem = {
  workItemId: string;
  id: string;
  title: string;
  summary?: string | null;
  dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | string | null;
  type: WorkspaceWorkType;
  priority: WorkspacePriority;
  status: WorkspaceWorkStatus;
  owner: string;
  dueAt?: string | null;
  sourceSystem: string;
  sourceReference?: string | null;
  obligationKey?: string | null;
  sourceRoute?: string | null;
  reason?: string | null;
  recommendedNext?: string | null;
  latestActivity?: string | null;
  version: number;
  updatedAt: string;
  /** Server-authorized local transitions; absence never grants mutation authority. */
  capabilities?: {
    canStart: boolean;
    canComplete: boolean;
    canWait?: boolean;
  };
};

export type WorkspaceWorkSummary = {
  total: number;
  dueSoon: number;
  inProgress: number;
  waiting: number;
  completed: number;
};

export type WorkspaceWorkQueue = {
  summary: WorkspaceWorkSummary;
  items: WorkspaceWorkItem[];
  generatedAt: string;
};

export type WorkspaceActivityActor = 'agent' | 'person' | 'system';
export type WorkspaceActivityState =
  'running' | 'needs-input' | 'completed' | 'policy-blocked' | 'failed' | 'cancelled' | 'unknown';

export type WorkspaceActivityEvent = {
  id: string;
  occurredAt: string;
  actor: WorkspaceActivityActor;
  actorName: string;
  state: WorkspaceActivityState;
  title: string;
  summary?: string | null;
  objectType: string;
  objectLabel: string;
  source: string;
  tool?: string | null;
  auditId: string | null;
  progress?: number | null;
  sourceRoute?: string | null;
  eventKind?: 'CHANGE' | 'EXECUTION' | 'EXECUTION_SNAPSHOT' | 'USAGE';
  resumeCursor?: string | null;
  sourceObservedAt?: string | null;
  updatedAt?: string | null;
  sourceEventId?: string | null;
  objectId?: string | null;
  sourceReference?: string | null;
  resourceVersion?: number | null;
  idempotencyKey?: string | null;
  resultState?: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'ARCHIVED' | 'DELETED' | null;
  executionId?: string | null;
  executionVersion?: number | null;
  attempt?: number | null;
  workStatus?: string | null;
  correlationId?: string | null;
  auditRecordId?: string | null;
  auditStatus?: 'VERIFIED' | 'LINKED' | 'PENDING' | 'LEGACY_UNLINKED' | 'NOT_LINKED';
  auditAccess?: 'RESTRICTED';
  dataProvenance?: 'LIVE' | 'LEGACY' | 'SAMPLE' | 'QUARANTINED';
  sourceAccess?: 'AVAILABLE' | 'FORBIDDEN' | 'DELETED' | 'UNAVAILABLE';
};

export type WorkspaceActivityCoverage = {
  supportedObjectTypes: string[];
  sourceScope?: string;
  semantics?: string;
  excludedProvenance?: string[];
  includesUsage?: boolean;
};

export type WorkspaceActivityFeed = {
  events: WorkspaceActivityEvent[];
  generatedAt: string;
  snapshotAt?: string;
  startCursor?: string | null;
  nextCursor?: string | null;
  hasMore?: boolean;
  coverage?: WorkspaceActivityCoverage;
  executionSummary?: WorkspaceActivityExecutionSummary;
  executionSummaryStatus?: 'AVAILABLE' | 'UNAVAILABLE';
};

export type WorkspaceActivityFilters = {
  actor?: WorkspaceActivityActor;
  state?: WorkspaceActivityState;
  query?: string;
  source?: string;
  objectType?: string;
  objectId?: string;
  executionId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
  includeUsage?: boolean;
};

// These counts come from the execution read model, never from historical event rows.
export type WorkspaceActivityExecutionSummary = {
  total: number;
  running: number;
  needsInput: number;
  policyBlocked: number;
  completed: number;
  failed: number;
  cancelled: number;
  unknown?: number;
  generatedAt: string;
  coverage: WorkspaceActivityCoverage;
};

export type WorkspaceAppCategory =
  'productivity' | 'service' | 'people' | 'knowledge' | 'business' | 'legacy';
export type WorkspaceAppLaunchMode = 'Native' | 'SSO' | 'Deep link';
export type WorkspaceAppHealth = 'healthy' | 'managed' | 'attention' | 'configuration-required';
export type WorkspaceAppAccessState =
  | 'AVAILABLE'
  | 'REQUESTABLE'
  | 'PENDING'
  | 'APPROVED_PENDING_SYNC'
  | 'APPROVED_SYNC_FAILED'
  | 'APPROVED_REFRESHING'
  | 'CONFIGURATION_REQUIRED';

export type WorkspaceApp = {
  id: string;
  name: string;
  description: string;
  owner: string;
  category: WorkspaceAppCategory;
  launchMode: WorkspaceAppLaunchMode;
  launchTarget?: string | null;
  iconKey: string;
  resourceKey: string;
  health: WorkspaceAppHealth;
  pinned: boolean;
  lastUsedAt?: string | null;
  launchCount: number;
  version: number;
  accessState: WorkspaceAppAccessState;
  accessRequestId?: string | null;
  accessRequestState?:
    'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'REVOKED' | null;
  accessRequestUpdatedAt?: string | null;
  accessRequestVersion?: number | null;
};

export type AppAccessRequest = {
  requestId: string;
  userId: number;
  appId: string;
  appName: string;
  resourceKey: string;
  requestedPermissionCode: 'VIEW';
  justification: string;
  state: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'REVOKED';
  requestedUntil?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  decidedBy?: number | null;
  fulfillmentState: 'NOT_REQUIRED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REVOKED' | 'EXPIRED';
  fulfillmentAttempts: number;
  fulfillmentNote?: string | null;
  lastFulfillmentAt?: string | null;
  lastFulfillmentError?: string | null;
  fulfilledAt?: string | null;
  fulfilledBy?: number | null;
  revokedAt?: string | null;
  revokedBy?: number | null;
  revocationNote?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceAppLaunch = {
  appId: string;
  launchMode: string;
  launchTarget: string;
  launchedAt: string;
};

export type RawWorkspaceWorkItem = Omit<WorkspaceWorkItem, 'type' | 'priority' | 'status'> & {
  type: 'APPROVAL' | 'TASK' | 'SERVICE' | 'REQUIRED' | 'REVIEW';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'DUE_SOON' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED';
};

export type RawWorkspaceWorkQueue = Omit<WorkspaceWorkQueue, 'items'> & {
  items: RawWorkspaceWorkItem[];
};

export type RawWorkspaceActivityEvent = Omit<WorkspaceActivityEvent, 'actor' | 'state'> & {
  actor: 'AGENT' | 'PERSON' | 'SYSTEM';
  state:
    'RUNNING' | 'NEEDS_INPUT' | 'COMPLETED' | 'POLICY_BLOCKED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';
};

export type RawWorkspaceActivityFeed = Omit<WorkspaceActivityFeed, 'events'> & {
  events: RawWorkspaceActivityEvent[];
};

type RawWorkspaceApp = Omit<WorkspaceApp, 'category' | 'launchMode' | 'health'> & {
  category: Uppercase<WorkspaceAppCategory>;
  launchMode: 'NATIVE' | 'SSO' | 'DEEP_LINK';
  health: 'HEALTHY' | 'MANAGED' | 'ATTENTION' | 'CONFIGURATION_REQUIRED';
};

const typeMap: Record<RawWorkspaceWorkItem['type'], WorkspaceWorkType> = {
  APPROVAL: 'Approval',
  TASK: 'Task',
  SERVICE: 'Service',
  REQUIRED: 'Required',
  REVIEW: 'Review',
};

const priorityMap: Record<RawWorkspaceWorkItem['priority'], WorkspacePriority> = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const statusMap: Record<RawWorkspaceWorkItem['status'], WorkspaceWorkStatus> = {
  DUE_SOON: 'due-soon',
  IN_PROGRESS: 'in-progress',
  WAITING: 'waiting',
  COMPLETED: 'completed',
};

const actorMap: Record<RawWorkspaceActivityEvent['actor'], WorkspaceActivityActor> = {
  AGENT: 'agent',
  PERSON: 'person',
  SYSTEM: 'system',
};

const activityStateMap: Record<RawWorkspaceActivityEvent['state'], WorkspaceActivityState> = {
  RUNNING: 'running',
  NEEDS_INPUT: 'needs-input',
  COMPLETED: 'completed',
  POLICY_BLOCKED: 'policy-blocked',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
};

const ACTIVITY_EVENT_KEYS = new Set([
  'id',
  'occurredAt',
  'actor',
  'actorName',
  'state',
  'title',
  'summary',
  'objectType',
  'objectLabel',
  'source',
  'tool',
  'auditId',
  'progress',
  'sourceRoute',
  'eventKind',
  'resumeCursor',
  'sourceObservedAt',
  'updatedAt',
  'sourceEventId',
  'objectId',
  'sourceReference',
  'resourceVersion',
  'idempotencyKey',
  'resultState',
  'executionId',
  'executionVersion',
  'attempt',
  'workStatus',
  'correlationId',
  'auditRecordId',
  'auditStatus',
  'auditAccess',
  'dataProvenance',
  'sourceAccess',
]);
const ACTIVITY_AUDIT_STATUSES = new Set([
  'VERIFIED',
  'LINKED',
  'PENDING',
  'LEGACY_UNLINKED',
  'NOT_LINKED',
]);
const ACTIVITY_LINKED_AUDIT_STATUSES = new Set(['VERIFIED', 'LINKED', 'PENDING']);
const ACTIVITY_EVENT_KINDS = new Set(['CHANGE', 'EXECUTION', 'EXECUTION_SNAPSHOT', 'USAGE']);
const ACTIVITY_PROVENANCE = new Set(['LIVE', 'LEGACY', 'SAMPLE', 'QUARANTINED']);
const ACTIVITY_SOURCE_ACCESS = new Set(['AVAILABLE', 'FORBIDDEN', 'DELETED', 'UNAVAILABLE']);
const PERSONAL_WORK_RESULT_STATES = new Set([
  'OPEN',
  'IN_PROGRESS',
  'WAITING',
  'COMPLETED',
  'ARCHIVED',
  'DELETED',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const launchModeMap: Record<RawWorkspaceApp['launchMode'], WorkspaceAppLaunchMode> = {
  NATIVE: 'Native',
  SSO: 'SSO',
  DEEP_LINK: 'Deep link',
};

const appHealthMap: Record<RawWorkspaceApp['health'], WorkspaceAppHealth> = {
  HEALTHY: 'healthy',
  MANAGED: 'managed',
  ATTENTION: 'attention',
  CONFIGURATION_REQUIRED: 'configuration-required',
};

function mapWorkItem(item: RawWorkspaceWorkItem): WorkspaceWorkItem {
  return {
    ...item,
    type: typeMap[item.type],
    priority: priorityMap[item.priority],
    status: statusMap[item.status],
  };
}

export function normalizeWorkspaceActivityEvent(
  event: RawWorkspaceActivityEvent
): WorkspaceActivityEvent {
  if (!isValidRawActivityEvent(event)) throw invalidActivityResponse();
  return {
    ...event,
    actor: actorMap[event.actor],
    state: activityStateMap[event.state],
  };
}

function mapApp(app: RawWorkspaceApp): WorkspaceApp {
  return {
    ...app,
    category: app.category.toLowerCase() as WorkspaceAppCategory,
    launchMode: launchModeMap[app.launchMode],
    health: appHealthMap[app.health],
  };
}

export async function getWorkspaceWorkQueue(signal?: AbortSignal): Promise<WorkspaceWorkQueue> {
  const response = await axiosInstance.get<ApiResponse<RawWorkspaceWorkQueue>>(
    '/api/platform/v1/workspace/work-items',
    { timeoutMs: 8000, signal }
  );
  return normalizeWorkspaceWorkQueue(response.data.data);
}

export function normalizeWorkspaceWorkQueue(queue: RawWorkspaceWorkQueue): WorkspaceWorkQueue {
  return { ...queue, items: queue.items.map(mapWorkItem) };
}

export async function updateWorkspaceWorkStatus(
  workItemId: string,
  status: 'IN_PROGRESS' | 'WAITING' | 'COMPLETED',
  version: number,
  signal?: AbortSignal
): Promise<WorkspaceWorkItem> {
  const response = await axiosInstance.patch<
    ApiResponse<RawWorkspaceWorkItem>,
    { status: string; version: number }
  >(
    `/api/platform/v1/workspace/work-items/${encodeURIComponent(workItemId)}/status`,
    {
      status,
      version,
    },
    { signal }
  );
  return mapWorkItem(response.data.data);
}

export async function updateWorkspaceWorkStatuses(
  items: Array<Pick<WorkspaceWorkItem, 'workItemId' | 'version'>>,
  status: 'IN_PROGRESS' | 'WAITING' | 'COMPLETED',
  signal?: AbortSignal
): Promise<WorkspaceWorkItem[]> {
  const response = await axiosInstance.patch<
    ApiResponse<RawWorkspaceWorkItem[]>,
    { items: Array<{ workItemId: string; version: number }>; status: string }
  >('/api/platform/v1/workspace/work-items/batch/status', { items, status }, { signal });
  return response.data.data.map(mapWorkItem);
}

export async function getWorkspaceActivity(
  filters: WorkspaceActivityFilters = {},
  signal?: AbortSignal
): Promise<WorkspaceActivityFeed> {
  const params = new URLSearchParams();
  for (const key of [
    'query',
    'source',
    'objectType',
    'objectId',
    'executionId',
    'from',
    'to',
    'cursor',
  ] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (filters.actor) params.set('actor', filters.actor.toUpperCase());
  if (filters.state) params.set('state', filters.state.toUpperCase().replaceAll('-', '_'));
  if (filters.limit) params.set('limit', String(Math.max(1, Math.min(100, filters.limit))));
  if (filters.includeUsage) params.set('includeUsage', 'true');
  const search = params.size ? `?${params}` : '';
  const response = await axiosInstance.get<ApiResponse<RawWorkspaceActivityFeed>>(
    `/api/platform/v1/workspace/activity${search}`,
    { timeoutMs: 8000, signal }
  );
  return normalizeWorkspaceActivityFeed(response.data.data);
}

export async function getWorkspaceActivityEvent(
  eventId: string,
  signal?: AbortSignal
): Promise<WorkspaceActivityEvent> {
  const response = await axiosInstance.get<ApiResponse<RawWorkspaceActivityEvent>>(
    `/api/platform/v1/workspace/activity/events/${encodeURIComponent(eventId)}`,
    { timeoutMs: 8000, signal }
  );
  return normalizeWorkspaceActivityEvent(response.data.data);
}

export async function getWorkspaceActivityExecutionSummary(
  signal?: AbortSignal
): Promise<WorkspaceActivityExecutionSummary> {
  const response = await axiosInstance.get<ApiResponse<WorkspaceActivityExecutionSummary>>(
    '/api/platform/v1/workspace/activity/executions/summary',
    { timeoutMs: 8000, signal }
  );
  return response.data.data;
}

export function normalizeWorkspaceActivityFeed(
  feed: RawWorkspaceActivityFeed
): WorkspaceActivityFeed {
  if (!isRecord(feed) || !Array.isArray(feed.events) || !isDate(feed.generatedAt)) {
    throw invalidActivityResponse();
  }
  if (
    (feed.snapshotAt !== undefined && !isDate(feed.snapshotAt)) ||
    (feed.startCursor !== undefined && !isNullableString(feed.startCursor)) ||
    (feed.nextCursor !== undefined && !isNullableString(feed.nextCursor)) ||
    (feed.hasMore !== undefined && typeof feed.hasMore !== 'boolean') ||
    (feed.coverage !== undefined && !isActivityCoverage(feed.coverage))
  ) {
    throw invalidActivityResponse();
  }
  return { ...feed, events: feed.events.map(normalizeWorkspaceActivityEvent) };
}

function isValidRawActivityEvent(value: unknown): value is RawWorkspaceActivityEvent {
  if (!isRecord(value) || !Object.keys(value).every((key) => ACTIVITY_EVENT_KEYS.has(key))) {
    return false;
  }
  if (
    !isPresentString(value.id) ||
    !isDate(value.occurredAt) ||
    !Object.hasOwn(actorMap, String(value.actor)) ||
    !isPresentString(value.actorName) ||
    !Object.hasOwn(activityStateMap, String(value.state)) ||
    !isPresentString(value.title) ||
    !isPresentString(value.objectType) ||
    !isPresentString(value.objectLabel) ||
    !isPresentString(value.source) ||
    !isOptionalNullableString(value.summary) ||
    !isOptionalNullableString(value.tool) ||
    !isOptionalNullableString(value.auditId) ||
    !isOptionalNullableInteger(value.progress, 0, 100) ||
    !isOptionalNullableString(value.sourceRoute) ||
    !isOptionalEnum(value.eventKind, ACTIVITY_EVENT_KINDS) ||
    !isOptionalNullableString(value.resumeCursor) ||
    !isOptionalNullableDate(value.sourceObservedAt) ||
    !isOptionalNullableDate(value.updatedAt) ||
    !isOptionalNullableString(value.sourceEventId) ||
    !isOptionalNullableString(value.objectId) ||
    !isOptionalNullableString(value.sourceReference) ||
    !isOptionalNullableInteger(value.resourceVersion, 0) ||
    !isOptionalNullableUuid(value.idempotencyKey) ||
    !(
      value.resultState === null || isOptionalEnum(value.resultState, PERSONAL_WORK_RESULT_STATES)
    ) ||
    !isOptionalNullableString(value.executionId) ||
    !isOptionalNullableInteger(value.executionVersion, 0) ||
    !isOptionalNullableInteger(value.attempt, 1) ||
    !isOptionalNullableString(value.workStatus) ||
    !isOptionalNullableString(value.correlationId) ||
    !isOptionalNullableUuid(value.auditRecordId) ||
    !isOptionalEnum(value.auditStatus, ACTIVITY_AUDIT_STATUSES) ||
    !(value.auditAccess === undefined || value.auditAccess === 'RESTRICTED') ||
    !isOptionalEnum(value.dataProvenance, ACTIVITY_PROVENANCE) ||
    !isOptionalEnum(value.sourceAccess, ACTIVITY_SOURCE_ACCESS)
  ) {
    return false;
  }

  const hasAuditRecord = typeof value.auditRecordId === 'string';
  if (
    value.auditStatus !== undefined &&
    ACTIVITY_LINKED_AUDIT_STATUSES.has(String(value.auditStatus)) !== hasAuditRecord
  ) {
    return false;
  }
  if (value.auditStatus === undefined && hasAuditRecord) return false;

  if (value.source === 'DWAI_ON') {
    return (
      UUID_PATTERN.test(String(value.id)) &&
      value.actor === 'AGENT' &&
      value.objectType === 'AGENT_RUN' &&
      value.eventKind === 'EXECUTION_SNAPSHOT' &&
      value.dataProvenance === 'LIVE' &&
      value.sourceAccess === 'AVAILABLE' &&
      value.auditAccess === 'RESTRICTED' &&
      typeof value.executionId === 'string' &&
      UUID_PATTERN.test(value.executionId) &&
      value.executionId.toLowerCase() === String(value.id).toLowerCase() &&
      typeof value.objectId === 'string' &&
      value.objectId.toLowerCase() === String(value.id).toLowerCase() &&
      typeof value.sourceEventId === 'string' &&
      value.sourceEventId.toLowerCase() === String(value.id).toLowerCase() &&
      typeof value.executionVersion === 'number' &&
      value.executionVersion >= 1 &&
      typeof value.attempt === 'number' &&
      value.attempt >= 1 &&
      isDate(value.sourceObservedAt)
    );
  }
  if (value.source === 'PERSONAL_TASK') {
    const sourceReference = String(value.sourceReference ?? '');
    const idempotencyKey = String(value.idempotencyKey ?? '');
    const expectedRoute = `/work/queue?work=${encodeURIComponent(`PERSONAL_TASK:${sourceReference}:`)}`;
    const resultState = String(value.resultState ?? '');
    const projectedWorkStatus = ['IN_PROGRESS', 'WAITING', 'COMPLETED'].includes(resultState)
      ? resultState
      : null;
    return (
      UUID_PATTERN.test(String(value.id)) &&
      value.actor === 'PERSON' &&
      value.state === 'COMPLETED' &&
      value.objectType === 'WORK_ITEM' &&
      value.eventKind === 'CHANGE' &&
      value.dataProvenance === 'LIVE' &&
      (value.sourceAccess === 'AVAILABLE' || value.sourceAccess === 'DELETED') &&
      value.auditAccess === 'RESTRICTED' &&
      value.auditStatus === 'VERIFIED' &&
      typeof value.auditRecordId === 'string' &&
      UUID_PATTERN.test(value.auditRecordId) &&
      UUID_PATTERN.test(String(value.objectId)) &&
      UUID_PATTERN.test(sourceReference) &&
      sourceReference.toLowerCase() === String(value.objectId).toLowerCase() &&
      typeof value.resourceVersion === 'number' &&
      value.resourceVersion >= 0 &&
      UUID_PATTERN.test(idempotencyKey) &&
      new RegExp(`^personal-work-command:[1-9][0-9]*:${idempotencyKey}$`, 'iu').test(
        String(value.sourceEventId)
      ) &&
      PERSONAL_WORK_RESULT_STATES.has(resultState) &&
      (value.workStatus ?? null) === projectedWorkStatus &&
      (value.sourceAccess === 'DELETED'
        ? value.sourceRoute === null
        : value.sourceRoute === expectedRoute)
    );
  }
  return true;
}

function isActivityCoverage(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.supportedObjectTypes)) return false;
  return (
    value.supportedObjectTypes.every(isPresentString) &&
    (value.sourceScope === undefined || isPresentString(value.sourceScope)) &&
    (value.semantics === undefined || isPresentString(value.semantics)) &&
    (value.excludedProvenance === undefined ||
      (Array.isArray(value.excludedProvenance) &&
        value.excludedProvenance.every(isPresentString))) &&
    (value.includesLegacy === undefined || typeof value.includesLegacy === 'boolean') &&
    (value.includesUsage === undefined || typeof value.includesUsage === 'boolean')
  );
}

function invalidActivityResponse(): HttpError {
  return new HttpError('Activity response is invalid.', 502);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPresentString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isOptionalNullableString(value: unknown): boolean {
  return value === undefined || isNullableString(value);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isOptionalNullableDate(value: unknown): boolean {
  return value === undefined || value === null || isDate(value);
}

function isOptionalNullableInteger(value: unknown, minimum: number, maximum?: number): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= minimum &&
      (maximum === undefined || value <= maximum))
  );
}

function isOptionalNullableUuid(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === 'string' && UUID_PATTERN.test(value))
  );
}

function isOptionalEnum(value: unknown, allowed: ReadonlySet<string>): boolean {
  return value === undefined || (typeof value === 'string' && allowed.has(value));
}

export async function getWorkspaceApps(): Promise<WorkspaceApp[]> {
  const response = await axiosInstance.get<ApiResponse<RawWorkspaceApp[]>>(
    '/api/platform/v1/workspace/apps',
    { timeoutMs: 8000 }
  );
  return response.data.data.map(mapApp);
}

export async function setWorkspaceAppPinned(
  appId: string,
  pinned: boolean,
  version: number
): Promise<WorkspaceApp> {
  const response = await axiosInstance.patch<
    ApiResponse<RawWorkspaceApp>,
    { pinned: boolean; version: number }
  >(`/api/platform/v1/workspace/apps/${encodeURIComponent(appId)}/pin`, { pinned, version });
  return mapApp(response.data.data);
}

export async function launchWorkspaceApp(appId: string): Promise<WorkspaceAppLaunch> {
  const response = await axiosInstance.post<ApiResponse<WorkspaceAppLaunch>, Record<string, never>>(
    `/api/platform/v1/workspace/apps/${encodeURIComponent(appId)}/launch`,
    {}
  );
  return response.data.data;
}

export async function requestWorkspaceAppAccess(
  appId: string,
  request: { justification: string; requestedUntil?: string }
): Promise<AppAccessRequest> {
  const response = await axiosInstance.post<ApiResponse<AppAccessRequest>, typeof request>(
    `/api/platform/v1/workspace/apps/${encodeURIComponent(appId)}/access-requests`,
    request
  );
  return response.data.data;
}

export async function cancelWorkspaceAppAccessRequest(
  requestId: string,
  version: number
): Promise<AppAccessRequest> {
  const response = await axiosInstance.post<ApiResponse<AppAccessRequest>, { version: number }>(
    `/api/platform/v1/workspace/app-access-requests/${requestId}/cancel`,
    { version }
  );
  return response.data.data;
}

export async function listAppAccessRequests(
  state: AppAccessRequest['state'] | 'ALL' = 'ALL'
): Promise<AppAccessRequest[]> {
  const response = await axiosInstance.get<ApiResponse<AppAccessRequest[]>>(
    `/api/platform/v1/admin/app-access-requests?state=${state}`
  );
  return response.data.data;
}

export async function decideAppAccessRequest(
  request: AppAccessRequest,
  decision: 'APPROVED' | 'REJECTED',
  decisionNote: string
): Promise<AppAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<AppAccessRequest>,
    { decision: 'APPROVED' | 'REJECTED'; decisionNote: string; version: number }
  >(`/api/platform/v1/admin/app-access-requests/${request.requestId}/decision`, {
    decision,
    decisionNote,
    version: request.version,
  });
  return response.data.data;
}

export async function fulfillAppAccessRequest(
  request: AppAccessRequest,
  note: string
): Promise<AppAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<AppAccessRequest>,
    { note: string; version: number }
  >(`/api/platform/v1/admin/app-access-requests/${request.requestId}/fulfillment`, {
    note,
    version: request.version,
  });
  return response.data.data;
}

export async function revokeAppAccessRequest(
  request: AppAccessRequest,
  note: string
): Promise<AppAccessRequest> {
  const response = await axiosInstance.post<
    ApiResponse<AppAccessRequest>,
    { note: string; version: number }
  >(`/api/platform/v1/admin/app-access-requests/${request.requestId}/revocation`, {
    note,
    version: request.version,
  });
  return response.data.data;
}
