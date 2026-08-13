import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type ApiHistoryWindow = 'H1' | 'H6' | 'H24' | 'D7' | 'D30';
export type ApiHistoryObservationPoint = 'GATEWAY' | 'SERVICE' | 'ALL';
export type ApiHistoryOutcome =
  'SUCCESS' | 'REDIRECTION' | 'CLIENT_ERROR' | 'SERVER_ERROR' | 'CANCELLED';

export type ApiHistoryFilters = {
  window: ApiHistoryWindow;
  observationPoint: ApiHistoryObservationPoint;
  serviceName?: string;
  httpMethod?: string;
  outcome?: ApiHistoryOutcome | 'ALL';
  query?: string;
};

export type ApiHistoryEvent = {
  historyId: string;
  occurredAt: string;
  completedAt: string;
  ingestedAt: string;
  tenantId?: number | null;
  actorType: 'ANONYMOUS' | 'USER' | 'SERVICE' | 'SYSTEM' | 'AGENT';
  actorId?: string | null;
  authType: 'NONE' | 'SESSION' | 'BEARER' | 'SERVICE' | 'SCIM' | 'UNKNOWN';
  serviceName: string;
  serviceVersion?: string | null;
  serviceInstance?: string | null;
  environment: string;
  observationPoint: 'GATEWAY' | 'SERVICE';
  routeId?: string | null;
  httpMethod: string;
  routeTemplate: string;
  requestPath: string;
  httpScheme?: string | null;
  httpProtocol?: string | null;
  statusCode: number;
  outcome: ApiHistoryOutcome;
  durationMs: number;
  requestSizeBytes?: number | null;
  responseSizeBytes?: number | null;
  correlationId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  clientAddressHash?: string | null;
  userAgentFamily?: string | null;
  userAgentHash?: string | null;
  errorType?: string | null;
  capturePolicyVersion: string;
};

export type ApiHistorySummary = {
  totalRequests: number;
  successfulRequests: number;
  clientErrorRequests: number;
  serverErrorRequests: number;
  errorRate: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  requestsPerMinute: number;
  activeRoutesOrServices: number;
};

export type ApiHistoryTrendPoint = {
  bucket: string;
  totalRequests: number;
  clientErrors: number;
  serverErrors: number;
  p95DurationMs: number;
};

export type ApiHistoryRouteMetric = {
  routeId?: string | null;
  serviceName: string;
  httpMethod: string;
  routeTemplate: string;
  totalRequests: number;
  serverErrors: number;
  errorRate: number;
  p95DurationMs: number;
};

export type ApiHistoryStatusMetric = {
  statusFamily: string;
  count: number;
};

export type ApiHistoryOverview = {
  window: ApiHistoryWindow;
  observationPoint: ApiHistoryObservationPoint;
  from: string;
  to: string;
  generatedAt: string;
  summary: ApiHistorySummary;
  trend: ApiHistoryTrendPoint[];
  topRoutes: ApiHistoryRouteMetric[];
  statusDistribution: ApiHistoryStatusMetric[];
};

export type ApiHistoryEventPage = {
  content: ApiHistoryEvent[];
  nextCursor?: string | null;
  size: number;
};

export type ApiHistoryTraceDetail = {
  selected: ApiHistoryEvent;
  trace: ApiHistoryEvent[];
};

function searchParams(filters: ApiHistoryFilters): URLSearchParams {
  const params = new URLSearchParams({
    window: filters.window,
    observationPoint: filters.observationPoint,
    outcome: filters.outcome ?? 'ALL',
  });
  if (filters.serviceName?.trim()) params.set('serviceName', filters.serviceName.trim());
  if (filters.httpMethod?.trim()) params.set('httpMethod', filters.httpMethod.trim());
  if (filters.query?.trim()) params.set('query', filters.query.trim());
  return params;
}

export async function getApiHistoryOverview(
  filters: ApiHistoryFilters
): Promise<ApiHistoryOverview> {
  const response = await axiosInstance.get<ApiResponse<ApiHistoryOverview>>(
    `/api/platform/v1/admin/api-history/overview?${searchParams(filters).toString()}`
  );
  return response.data.data;
}

export async function listApiHistoryEvents(
  filters: ApiHistoryFilters,
  cursor?: string
): Promise<ApiHistoryEventPage> {
  const params = searchParams(filters);
  params.set('size', '50');
  if (cursor) params.set('cursor', cursor);
  const response = await axiosInstance.get<ApiResponse<ApiHistoryEventPage>>(
    `/api/platform/v1/admin/api-history/events?${params.toString()}`
  );
  return response.data.data;
}

export async function getApiHistoryTrace(historyId: string): Promise<ApiHistoryTraceDetail> {
  const response = await axiosInstance.get<ApiResponse<ApiHistoryTraceDetail>>(
    `/api/platform/v1/admin/api-history/events/${encodeURIComponent(historyId)}`
  );
  return response.data.data;
}
