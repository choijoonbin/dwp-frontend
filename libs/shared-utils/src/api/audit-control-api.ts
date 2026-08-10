import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type AuditWindow = 'H24' | 'D7' | 'D30' | 'D90';
export type AuditCategory =
  | 'ALL'
  | 'ADMIN_CHANGE'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'DATA_ACCESS'
  | 'DATA_EXPORT'
  | 'PROVISIONING'
  | 'AI_ACTION'
  | 'POLICY_DENIED'
  | 'SYSTEM_EVENT';
export type AuditSeverity = 'ALL' | 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AuditOutcome = 'ALL' | 'SUCCESS' | 'DENIED' | 'FAILED';

export type AuditEvent = {
  eventId: string;
  occurredAt: string;
  ingestedAt: string;
  tenantId: number;
  category: Exclude<AuditCategory, 'ALL'>;
  action: string;
  outcome: Exclude<AuditOutcome, 'ALL'>;
  severity: Exclude<AuditSeverity, 'ALL'>;
  riskScore: number;
  actorType: string;
  actorId?: string | null;
  actorPrincipal?: string | null;
  actorDisplayName?: string | null;
  actorRoles: string[];
  sourceService: string;
  sourceModule: string;
  sourceInstance?: string | null;
  environment: string;
  targetType: string;
  targetId: string;
  targetDisplayName?: string | null;
  reason?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
  authenticationMethod?: string | null;
  policyId?: string | null;
  policyDecision?: string | null;
  approvalId?: string | null;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  changedFields: string[];
  metadata: Record<string, unknown>;
  retentionClass: 'STANDARD' | 'EXTENDED' | 'LEGAL_HOLD';
  recordHash: string;
};

export type AuditEventPage = {
  content: AuditEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type AuditFinding = {
  findingId: string;
  eventId?: string | null;
  findingType: string;
  ruleKey: string;
  severity: Exclude<AuditSeverity, 'ALL' | 'INFO'>;
  riskScore: number;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  title: string;
  description: string;
  sourceService: string;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  assignedTo?: string | null;
  caseId?: string | null;
  resolution?: string | null;
  updatedAt: string;
};

export type AuditCase = {
  caseId: string;
  caseNumber: number;
  title: string;
  description?: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'CLOSED';
  ownerActorId?: string | null;
  resolution?: string | null;
  openedAt: string;
  closedAt?: string | null;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  linkedEvents: number;
  linkedFindings: number;
};

export type AuditSourceHealth = {
  sourceService: string;
  lastEventAt?: string | null;
  lastIngestedAt?: string | null;
  eventCount24h: number;
  rejectedCount24h: number;
  deliveryStatus: 'HEALTHY' | 'DEGRADED' | 'STALE' | 'ERROR';
  lastError?: string | null;
};

export type AuditOverview = {
  window: AuditWindow;
  from: string;
  to: string;
  generatedAt: string;
  summary: {
    totalEvents: number;
    highRiskEvents: number;
    deniedEvents: number;
    failedEvents: number;
    openFindings: number;
    activeCases: number;
    healthySources: number;
    registeredSources: number;
  };
  trend: Array<{ bucket: string; total: number; highRisk: number; denied: number }>;
  categories: Array<{ key: string; count: number }>;
  outcomes: Array<{ key: string; count: number }>;
  topActors: Array<{ key: string; count: number }>;
  attention: AuditFinding[];
  sources: AuditSourceHealth[];
};

export type AuditRetentionPolicy = {
  standardRetentionDays: number;
  extendedRetentionDays: number;
  exportLimitRows: number;
  requireExportReason: boolean;
  integrityEnabled: boolean;
  highRiskThreshold: number;
  updatedBy?: string | null;
  updatedAt: string;
};

export type AuditIntegrityCheckpoint = {
  checkpointId: string;
  checkpointDate: string;
  recordCount: number;
  firstEventAt?: string | null;
  lastEventAt?: string | null;
  rootHash: string;
  checkpointHash: string;
  signatureAlgorithm: string;
  verificationStatus: 'VERIFIED' | 'FAILED' | 'UNAVAILABLE';
  createdAt: string;
  verifiedAt?: string | null;
};

export type AuditFilters = {
  window: AuditWindow;
  category?: AuditCategory;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  sourceService?: string;
  actor?: string;
  query?: string;
  page?: number;
  size?: number;
};

export type AuditSavedSearch = {
  savedSearchId: string;
  name: string;
  criteria: Omit<AuditFilters, 'page' | 'size'>;
  shared: boolean;
  editable: boolean;
  ownerActorId: string;
  createdAt: string;
  updatedAt: string;
};

function params(filters: AuditFilters): URLSearchParams {
  const search = new URLSearchParams({ window: filters.window });
  Object.entries(filters).forEach(([key, value]) => {
    if (key !== 'window' && value !== undefined && value !== '') search.set(key, String(value));
  });
  return search;
}

export async function getAuditOverview(window: AuditWindow): Promise<AuditOverview> {
  const response = await axiosInstance.get<ApiResponse<AuditOverview>>(
    `/api/platform/v1/admin/audit-control/overview?window=${window}`
  );
  return response.data.data;
}

export async function listAuditEvents(filters: AuditFilters): Promise<AuditEventPage> {
  const response = await axiosInstance.get<ApiResponse<AuditEventPage>>(
    `/api/platform/v1/admin/audit-control/events?${params(filters).toString()}`
  );
  return response.data.data;
}

export async function getAuditEvent(eventId: string): Promise<AuditEvent> {
  const response = await axiosInstance.get<ApiResponse<AuditEvent>>(
    `/api/platform/v1/admin/audit-control/events/${encodeURIComponent(eventId)}`
  );
  return response.data.data;
}

export async function listAuditSavedSearches(): Promise<AuditSavedSearch[]> {
  const response = await axiosInstance.get<ApiResponse<AuditSavedSearch[]>>(
    '/api/platform/v1/admin/audit-control/saved-searches'
  );
  return response.data.data;
}

export async function saveAuditSearch(
  request: Omit<AuditFilters, 'page' | 'size'> & { name: string; shared: boolean }
): Promise<AuditSavedSearch> {
  const response = await axiosInstance.post<ApiResponse<AuditSavedSearch>, typeof request>(
    '/api/platform/v1/admin/audit-control/saved-searches',
    request
  );
  return response.data.data;
}

export async function deleteAuditSavedSearch(savedSearchId: string): Promise<void> {
  await axiosInstance.delete(
    `/api/platform/v1/admin/audit-control/saved-searches/${encodeURIComponent(savedSearchId)}`
  );
}

export async function listAuditFindings(status = 'ALL'): Promise<AuditFinding[]> {
  const response = await axiosInstance.get<ApiResponse<AuditFinding[]>>(
    `/api/platform/v1/admin/audit-control/findings?status=${encodeURIComponent(status)}`
  );
  return response.data.data;
}

export async function updateAuditFinding(
  findingId: string,
  request: Partial<Pick<AuditFinding, 'status' | 'assignedTo' | 'resolution' | 'caseId'>>
): Promise<AuditFinding> {
  const response = await axiosInstance.patch<ApiResponse<AuditFinding>, typeof request>(
    `/api/platform/v1/admin/audit-control/findings/${encodeURIComponent(findingId)}`,
    request
  );
  return response.data.data;
}

export async function listAuditCases(): Promise<AuditCase[]> {
  const response = await axiosInstance.get<ApiResponse<AuditCase[]>>(
    '/api/platform/v1/admin/audit-control/cases'
  );
  return response.data.data;
}

export async function createAuditCase(request: {
  title: string;
  description?: string;
  severity: AuditCase['severity'];
  ownerActorId?: string;
}): Promise<AuditCase> {
  const response = await axiosInstance.post<ApiResponse<AuditCase>, typeof request>(
    '/api/platform/v1/admin/audit-control/cases',
    request
  );
  return response.data.data;
}

export async function updateAuditCase(
  caseId: string,
  request: Partial<
    Pick<AuditCase, 'title' | 'description' | 'severity' | 'status' | 'ownerActorId' | 'resolution'>
  >
): Promise<AuditCase> {
  const response = await axiosInstance.patch<ApiResponse<AuditCase>, typeof request>(
    `/api/platform/v1/admin/audit-control/cases/${encodeURIComponent(caseId)}`,
    request
  );
  return response.data.data;
}

export async function getAuditPolicy(): Promise<AuditRetentionPolicy> {
  const response = await axiosInstance.get<ApiResponse<AuditRetentionPolicy>>(
    '/api/platform/v1/admin/audit-control/policy'
  );
  return response.data.data;
}

export async function updateAuditPolicy(
  request: Omit<AuditRetentionPolicy, 'updatedBy' | 'updatedAt'>
): Promise<AuditRetentionPolicy> {
  const response = await axiosInstance.put<ApiResponse<AuditRetentionPolicy>, typeof request>(
    '/api/platform/v1/admin/audit-control/policy',
    request
  );
  return response.data.data;
}

export async function listAuditIntegrity(): Promise<AuditIntegrityCheckpoint[]> {
  const response = await axiosInstance.get<ApiResponse<AuditIntegrityCheckpoint[]>>(
    '/api/platform/v1/admin/audit-control/integrity'
  );
  return response.data.data;
}

export async function createAuditCheckpoint(): Promise<AuditIntegrityCheckpoint[]> {
  const response = await axiosInstance.post<ApiResponse<AuditIntegrityCheckpoint[]>, undefined>(
    '/api/platform/v1/admin/audit-control/integrity/checkpoint',
    undefined
  );
  return response.data.data;
}

export async function createAuditExport(
  request: Omit<AuditFilters, 'page' | 'size'> & { format: 'CSV' | 'JSONL'; reason: string }
): Promise<{ exportJobId: string; format: string; status: string; rowCount: number }> {
  const response = await axiosInstance.post<
    ApiResponse<{ exportJobId: string; format: string; status: string; rowCount: number }>,
    typeof request
  >('/api/platform/v1/admin/audit-control/exports', request);
  return response.data.data;
}

export async function downloadAuditExport(exportId: string): Promise<Blob> {
  const response = await axiosInstance.get<Blob>(
    `/api/platform/v1/admin/audit-control/exports/${encodeURIComponent(exportId)}/content`,
    { responseType: 'blob', headers: { Accept: 'application/octet-stream' } }
  );
  return response.data;
}
