import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type WorkspacePriority = 'high' | 'medium' | 'low';
export type WorkspaceWorkStatus = 'due-soon' | 'in-progress' | 'waiting' | 'completed';
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
  sourceRoute?: string | null;
  reason?: string | null;
  recommendedNext?: string | null;
  latestActivity?: string | null;
  version: number;
  updatedAt: string;
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
export type WorkspaceActivityState = 'running' | 'needs-input' | 'completed' | 'policy-blocked';

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
  auditId: string;
  progress?: number | null;
  sourceRoute?: string | null;
};

export type WorkspaceActivityFeed = {
  events: WorkspaceActivityEvent[];
  generatedAt: string;
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
  state: 'RUNNING' | 'NEEDS_INPUT' | 'COMPLETED' | 'POLICY_BLOCKED';
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
};

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

function mapActivityEvent(event: RawWorkspaceActivityEvent): WorkspaceActivityEvent {
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

export async function getWorkspaceWorkQueue(): Promise<WorkspaceWorkQueue> {
  const response = await axiosInstance.get<ApiResponse<RawWorkspaceWorkQueue>>(
    '/api/platform/v1/workspace/work-items',
    { timeoutMs: 8000 }
  );
  return normalizeWorkspaceWorkQueue(response.data.data);
}

export function normalizeWorkspaceWorkQueue(queue: RawWorkspaceWorkQueue): WorkspaceWorkQueue {
  return { ...queue, items: queue.items.map(mapWorkItem) };
}

export async function updateWorkspaceWorkStatus(
  workItemId: string,
  status: 'IN_PROGRESS' | 'WAITING' | 'COMPLETED',
  version: number
): Promise<WorkspaceWorkItem> {
  const response = await axiosInstance.patch<
    ApiResponse<RawWorkspaceWorkItem>,
    { status: string; version: number }
  >(`/api/platform/v1/workspace/work-items/${encodeURIComponent(workItemId)}/status`, {
    status,
    version,
  });
  return mapWorkItem(response.data.data);
}

export async function updateWorkspaceWorkStatuses(
  items: Array<Pick<WorkspaceWorkItem, 'workItemId' | 'version'>>,
  status: 'IN_PROGRESS' | 'WAITING' | 'COMPLETED'
): Promise<WorkspaceWorkItem[]> {
  const response = await axiosInstance.patch<
    ApiResponse<RawWorkspaceWorkItem[]>,
    { items: Array<{ workItemId: string; version: number }>; status: string }
  >('/api/platform/v1/workspace/work-items/batch/status', { items, status });
  return response.data.data.map(mapWorkItem);
}

export async function getWorkspaceActivity(): Promise<WorkspaceActivityFeed> {
  const response = await axiosInstance.get<ApiResponse<RawWorkspaceActivityFeed>>(
    '/api/platform/v1/workspace/activity',
    { timeoutMs: 8000 }
  );
  return normalizeWorkspaceActivityFeed(response.data.data);
}

export function normalizeWorkspaceActivityFeed(
  feed: RawWorkspaceActivityFeed
): WorkspaceActivityFeed {
  return { ...feed, events: feed.events.map(mapActivityEvent) };
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
