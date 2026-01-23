import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------

/**
 * Monitoring Summary API Parameters
 */
export type MonitoringSummaryParams = {
  from?: string; // ISO 8601 date string
  to?: string; // ISO 8601 date string
  compareFrom?: string; // ISO 8601 date string (for comparison period)
  compareTo?: string; // ISO 8601 date string (for comparison period)
};

/**
 * Monitoring Summary Response
 */
export type MonitoringSummaryResponse = {
  pv: number; // Page Views
  uv: number; // Unique Visitors
  events: number; // Total Events
  apiErrorRate: number; // API Error Rate (%)
  pvDeltaPercent?: number; // Percentage change vs comparison period
  uvDeltaPercent?: number; // Percentage change vs comparison period
  eventDeltaPercent?: number; // Percentage change vs comparison period
  apiErrorDeltaPercent?: number; // Percentage change vs comparison period
  comparePeriod?: {
    pv?: number;
    uv?: number;
    events?: number;
    apiErrorRate?: number;
  };
  // Legacy fields (backward compatibility)
  pvTrend?: number;
  uvTrend?: number;
  eventsTrend?: number;
  apiErrorRateTrend?: number;
};

/**
 * Monitoring List API Parameters (for PageViews and ApiHistories)
 */
export type MonitoringListParams = {
  page?: number; // Page number (1-based)
  size?: number; // Page size
  from?: string; // ISO 8601 date string
  to?: string; // ISO 8601 date string
  keyword?: string; // Search keyword
  route?: string; // Filter by route
  menu?: string; // Filter by menu key
  path?: string; // Filter by path
  userId?: string; // Filter by user ID
  apiName?: string; // Filter by API name
  apiUrl?: string; // Filter by API URL
  statusCode?: string; // Filter by status code
};

/**
 * Monitoring Visitors API Parameters
 */
export type MonitoringVisitorsParams = {
  page?: number; // Page number (1-based)
  size?: number; // Page size
  from?: string; // ISO 8601 date string
  to?: string; // ISO 8601 date string
  keyword?: string; // Search keyword (visitorId/path)
};

/**
 * Monitoring Events API Parameters
 */
export type MonitoringEventsParams = {
  page?: number; // Page number (1-based)
  size?: number; // Page size
  from?: string; // ISO 8601 date string
  to?: string; // ISO 8601 date string
  keyword?: string; // Search keyword (action/label/path)
  eventType?: string; // Filter by event type
  resourceKey?: string; // Filter by resource key
};

/**
 * Monitoring Timeseries API Parameters
 */
export type MonitoringTimeseriesParams = {
  from: string; // ISO 8601 date string (required)
  to: string; // ISO 8601 date string (required)
  interval: 'HOUR' | 'DAY'; // Time interval
  metric: 'PV' | 'UV' | 'API_TOTAL' | 'API_ERROR' | 'EVENT'; // Metric type
};

/**
 * Page View Item (Backend format)
 */
export type PageViewItemBackend = {
  pageViewEventId: number;
  tenantId: number;
  userId?: number | null;
  sessionId: string; // Visitor ID
  pageKey: string; // Can be URL path (e.g., "/sign-in?returnUrl=...") or menu key (e.g., "menu.admin.monitoring")
  eventName?: string | null; // Page title
  eventType: string; // "PAGE_VIEW"
  targetKey?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  durationMs?: number | null;
  metadataJson?: string | null;
  createdAt: string; // ISO 8601 date string
  createdBy?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
};

/**
 * Page View Item (Frontend format)
 */
export type PageViewItem = {
  id: string;
  route: string; // Derived from menuKey or path
  path: string; // Full path
  userId?: string;
  timestamp: string; // ISO 8601 date string
  userAgent?: string;
  device?: string;
  referrer?: string;
  menuKey?: string;
  title?: string;
};

/**
 * Page Views Response
 */
export type PageViewsResponse = {
  items: PageViewItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
};

/**
 * API History Item (Backend format)
 */
export type ApiHistoryItemBackend = {
  apiCallHistoryId: number;
  tenantId: number;
  userId?: number | null;
  agentId?: number | null;
  source: string;
  method: string; // GET, POST, PUT, DELETE, etc.
  path: string; // API path (e.g., "/monitoring/page-view")
  queryString?: string | null;
  statusCode: number;
  latencyMs: number; // Response time in milliseconds
  requestSizeBytes?: number | null;
  responseSizeBytes?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  traceId?: string | null;
  errorCode?: string | null;
  createdAt: string; // ISO 8601 date string
  createdBy?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
};

/**
 * API History Item (Frontend format)
 */
export type ApiHistoryItem = {
  id: string;
  apiName: string; // Derived from path
  apiUrl: string; // Full URL (path + queryString)
  method: string; // GET, POST, PUT, DELETE, etc.
  statusCode: number;
  userId?: string;
  timestamp: string; // ISO 8601 date string
  responseTime?: number; // milliseconds (from latencyMs)
  traceId?: string; // Trace ID for distributed tracing
  requestBody?: string; // JSON string
  responseBody?: string; // JSON string
};

/**
 * API Histories Response
 */
export type ApiHistoriesResponse = {
  items: ApiHistoryItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
};

/**
 * Visitor Summary Item
 */
export type VisitorSummary = {
  visitorId: string;
  firstSeenAt: string; // ISO 8601 date string
  lastSeenAt: string; // ISO 8601 date string
  pageViewCount: number;
  eventCount: number;
  lastPath?: string | null;
  lastDevice?: string | null;
  lastUserId?: number | null; // Backend uses lastUserId
  userId?: string | null; // For compatibility
};

/**
 * Spring Page Response (Backend format)
 */
type SpringPageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 0-based page number
  size: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
  pageable?: {
    pageNumber: number;
    pageSize: number;
    sort?: {
      sorted: boolean;
    };
  };
};

/**
 * Visitors Response (Frontend format)
 */
export type VisitorsResponse = {
  items: VisitorSummary[];
  total: number;
  page: number; // 1-based page number
  size: number;
  totalPages: number;
};

/**
 * Event Log Item
 */
export type EventLogItem = {
  id?: string; // Frontend format
  sysEventLogId?: number; // Backend format
  occurredAt: string; // ISO 8601 date string
  eventType: string;
  resourceKey: string;
  action: string;
  label?: string | null;
  visitorId?: string | null;
  userId?: number | null; // Backend uses number
  path?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Events Response (Frontend format)
 */
export type EventsResponse = {
  items: EventLogItem[];
  total: number;
  page: number; // 1-based page number
  size: number;
  totalPages: number;
};

/**
 * Timeseries Data Point
 */
export type TimeseriesDataPoint = {
  timestamp: string; // ISO 8601 date string
  value: number;
};

/**
 * Timeseries Response (Backend format)
 */
export type TimeseriesResponseBackend = {
  metric: 'PV' | 'UV' | 'API_TOTAL' | 'API_ERROR' | 'EVENT';
  interval: 'HOUR' | 'DAY';
  labels: string[]; // Time labels (X-axis)
  values: number[]; // Values (Y-axis)
};

/**
 * Timeseries Response (Frontend format)
 */
export type TimeseriesResponse = {
  metric: 'PV' | 'UV' | 'API_TOTAL' | 'API_ERROR' | 'EVENT';
  interval: 'HOUR' | 'DAY';
  dataPoints: TimeseriesDataPoint[];
};

/**
 * Page View Collection Payload
 */
export type PageViewPayload = {
  path: string;
  menuKey?: string;
  title?: string;
  visitorId?: string;
  userId?: string;
  device?: string;
  referrer?: string;
};

/**
 * Event Collection Payload
 * 
 * Standardized event tracking payload.
 * action must be a valid UiAction (VIEW, CLICK, EXECUTE, etc.)
 */
export type EventPayload = {
  resourceKey: string; // e.g., 'menu.mail.send', 'menu.admin.users', 'btn.admin.roles.create'
  action: string; // Must be a valid UiAction (VIEW, CLICK, EXECUTE, etc.)
  label?: string; // Optional label (e.g., menu name, button text)
  metadata?: Record<string, unknown>; // Optional metadata
  path?: string; // Current page path (auto-filled if not provided)
  visitorId?: string; // Visitor ID (auto-filled if not provided)
  userId?: string | null; // User ID (auto-filled if not provided)
  
  // Legacy fields (deprecated, kept for backward compatibility)
  /** @deprecated Use action instead */
  eventType?: string;
};

// ----------------------------------------------------------------------

/**
 * Get monitoring summary (KPI data)
 * GET /api/admin/monitoring/summary
 */
export const getMonitoringSummary = async (
  params?: MonitoringSummaryParams
): Promise<ApiResponse<MonitoringSummaryResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.compareFrom) queryParams.append('compareFrom', params.compareFrom);
  if (params?.compareTo) queryParams.append('compareTo', params.compareTo);

  const url = `/api/admin/monitoring/summary${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<MonitoringSummaryResponse>>(url);
  return res.data;
};

/**
 * Get monitoring page views list
 * GET /api/admin/monitoring/page-views
 */
export const getMonitoringPageViews = async (
  params?: MonitoringListParams
): Promise<ApiResponse<PageViewsResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.route) queryParams.append('route', params.route);
  if (params?.menu) queryParams.append('menu', params.menu);
  if (params?.path) queryParams.append('path', params.path);
  if (params?.userId) queryParams.append('userId', params.userId);

  const url = `/api/admin/monitoring/page-views${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<SpringPageResponse<PageViewItemBackend> | PageViewsResponse>>(url);
  
  // Convert Spring Page format to Frontend format if needed
  if (res.data.data && 'content' in res.data.data) {
    const springPage = res.data.data as SpringPageResponse<PageViewItemBackend>;
    const converted = convertSpringPageToFrontend(springPage);
    
    // Map backend fields to frontend fields
    const items: PageViewItem[] = converted.items.map((item) => {
      // Extract route and path from pageKey
      // pageKey can be:
      // 1. URL path: "/sign-in?returnUrl=%2Fadmin%2Fmonitoring"
      // 2. Menu key: "menu.admin.monitoring"
      
      let route = item.pageKey;
      let path = item.pageKey;
      
      // If pageKey is a menu key (starts with "menu."), extract route by removing "menu." prefix
      if (item.pageKey.startsWith('menu.')) {
        route = item.pageKey.replace(/^menu\./, '');
        // For path, try to convert menu key to URL path
        // e.g., "menu.admin.monitoring" -> "/admin/monitoring"
        const menuPath = item.pageKey.replace(/^menu\./, '').replace(/\./g, '/');
        path = `/${menuPath}`;
      } else {
        // If pageKey is a URL path, extract route from pathname (remove query string)
        const urlPath = item.pageKey.split('?')[0]; // Remove query string
        route = urlPath;
        path = item.pageKey; // Keep full path with query string
      }
      
      return {
        id: item.pageViewEventId.toString(),
        route,
        path,
        userId: item.userId?.toString() || undefined,
        timestamp: item.createdAt,
        userAgent: item.userAgent || undefined,
        device: undefined, // Not available in backend response
        referrer: item.referrer || undefined,
        menuKey: item.pageKey.startsWith('menu.') ? item.pageKey : undefined,
        title: item.eventName || undefined,
      };
    });
    
    return {
      ...res.data,
      data: {
        ...converted,
        items,
      },
    } as ApiResponse<PageViewsResponse>;
  }
  
  // Already in frontend format (shouldn't happen, but handle gracefully)
  return res.data as ApiResponse<PageViewsResponse>;
};

/**
 * Get monitoring API histories list
 * GET /api/admin/monitoring/api-histories
 */
export const getMonitoringApiHistories = async (
  params?: MonitoringListParams
): Promise<ApiResponse<ApiHistoriesResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.apiName) queryParams.append('apiName', params.apiName);
  if (params?.apiUrl) queryParams.append('apiUrl', params.apiUrl);
  if (params?.statusCode) queryParams.append('statusCode', params.statusCode);
  if (params?.userId) queryParams.append('userId', params.userId);

  const url = `/api/admin/monitoring/api-histories${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<SpringPageResponse<ApiHistoryItemBackend> | ApiHistoriesResponse>>(url);
  
  // Convert Spring Page format to Frontend format if needed
  if (res.data.data && 'content' in res.data.data) {
    const springPage = res.data.data as SpringPageResponse<ApiHistoryItemBackend>;
    const converted = convertSpringPageToFrontend(springPage);
    
    // Map backend fields to frontend fields
    const items: ApiHistoryItem[] = converted.items.map((item) => {
      // Extract API name from path
      // Examples:
      //   "/monitoring/page-view" -> "page-view"
      //   "/monitoring/event" -> "event"
      //   "/main/health" -> "health"
      //   "/admin/roles" -> "roles"
      const pathParts = item.path.split('/').filter((part) => part.length > 0);
      const apiName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : item.path;
      
      // Build full URL (path + queryString)
      const apiUrl = item.queryString ? `${item.path}?${item.queryString}` : item.path;
      
      return {
        id: item.apiCallHistoryId.toString(),
        apiName,
        apiUrl,
        method: item.method,
        statusCode: item.statusCode,
        userId: item.userId?.toString() || undefined,
        timestamp: item.createdAt,
        responseTime: item.latencyMs,
        traceId: item.traceId || undefined,
        requestBody: undefined, // Not available in backend response
        responseBody: undefined, // Not available in backend response
      };
    });
    
    return {
      ...res.data,
      data: {
        ...converted,
        items,
      },
    } as ApiResponse<ApiHistoriesResponse>;
  }
  
  // Already in frontend format (shouldn't happen, but handle gracefully)
  return res.data as ApiResponse<ApiHistoriesResponse>;
};

/**
 * Post page view (for analytics collection)
 * POST /api/monitoring/page-view
 * Note: This is a public endpoint (no auth required)
 */
export const postPageView = async (payload: PageViewPayload): Promise<ApiResponse<{ success: boolean }>> => {
  try {
    const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>('/api/monitoring/page-view', payload);
    return res.data;
  } catch (error) {
    // Silent fail: Don't break the app if analytics fails
    console.warn('[Analytics] Failed to post page view:', error);
    return {
      status: 'FAIL',
      message: 'Failed to post page view',
      data: { success: false },
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Post event (for analytics collection)
 * POST /api/monitoring/event
 * Note: This is a public endpoint (no auth required)
 * 
 * Standardized event tracking with automatic field population.
 * action must be a valid UiAction (VIEW, CLICK, EXECUTE, etc.)
 */
export const postEvent = async (payload: EventPayload): Promise<ApiResponse<{ success: boolean }>> => {
  try {
    // Validate that action is provided
    if (!payload.action) {
      throw new Error('Event payload must include action field');
    }
    
    // Normalize action to uppercase (standard format)
    const normalizedPayload: EventPayload = {
      ...payload,
      action: payload.action.toUpperCase(),
    };
    
    // Include eventType for backward compatibility (if not already provided)
    if (!normalizedPayload.eventType) {
      normalizedPayload.eventType = normalizedPayload.action.toLowerCase();
    }
    
    const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>('/api/monitoring/event', normalizedPayload);
    return res.data;
  } catch (error) {
    // Silent fail: Don't break the app if analytics fails
    console.warn('[Analytics] Failed to post event:', error);
    return {
      status: 'FAIL',
      message: 'Failed to post event',
      data: { success: false },
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Convert Spring Page response to Frontend format
 */
const convertSpringPageToFrontend = <T>(
  springPage: SpringPageResponse<T>
): { items: T[]; total: number; page: number; size: number; totalPages: number } => ({
  items: springPage.content || [],
  total: springPage.totalElements || 0,
  page: (springPage.number || 0) + 1, // Convert 0-based to 1-based
  size: springPage.size || 0,
  totalPages: springPage.totalPages || 0,
});

/**
 * Get monitoring visitors list
 * GET /api/admin/monitoring/visitors
 */
export const getMonitoringVisitors = async (
  params?: MonitoringVisitorsParams
): Promise<ApiResponse<VisitorsResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  
  // Set default date range if not provided (last 30 days)
  // Check for empty string as well as undefined/null
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = (params?.from && params.from.trim() !== '') 
    ? params.from 
    : defaultFrom.toISOString().slice(0, 19);
  const to = (params?.to && params.to.trim() !== '') 
    ? params.to 
    : now.toISOString().slice(0, 19);
  
  queryParams.append('from', from);
  queryParams.append('to', to);
  
  if (params?.keyword) queryParams.append('keyword', params.keyword);

  const url = `/api/admin/monitoring/visitors?${queryParams.toString()}`;
  const res = await axiosInstance.get<ApiResponse<SpringPageResponse<VisitorSummary> | VisitorsResponse>>(url);
  
  // Convert Spring Page format to Frontend format
  if (res.data.data && 'content' in res.data.data) {
    const springPage = res.data.data as SpringPageResponse<VisitorSummary>;
    const converted = convertSpringPageToFrontend(springPage);
    // Map lastUserId to userId for compatibility
    const items = converted.items.map((item) => ({
      ...item,
      userId: item.lastUserId?.toString() || null,
    }));
    
    return {
      ...res.data,
      data: {
        ...converted,
        items,
      },
    } as ApiResponse<VisitorsResponse>;
  }
  
  // Already in frontend format
  return res.data as ApiResponse<VisitorsResponse>;
};

/**
 * Get monitoring events list
 * GET /api/admin/monitoring/events
 */
export const getMonitoringEvents = async (
  params?: MonitoringEventsParams
): Promise<ApiResponse<EventsResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  
  // Set default date range if not provided (last 30 days)
  // Check for empty string as well as undefined/null
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = (params?.from && params.from.trim() !== '') 
    ? params.from 
    : defaultFrom.toISOString().slice(0, 19);
  const to = (params?.to && params.to.trim() !== '') 
    ? params.to 
    : now.toISOString().slice(0, 19);
  
  queryParams.append('from', from);
  queryParams.append('to', to);
  
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.eventType) queryParams.append('eventType', params.eventType);
  if (params?.resourceKey) queryParams.append('resourceKey', params.resourceKey);

  const url = `/api/admin/monitoring/events?${queryParams.toString()}`;
  const res = await axiosInstance.get<ApiResponse<SpringPageResponse<EventLogItem> | EventsResponse>>(url);
  
  // Convert Spring Page format to Frontend format
  if (res.data.data && 'content' in res.data.data) {
    const springPage = res.data.data as SpringPageResponse<EventLogItem>;
    const converted = convertSpringPageToFrontend(springPage);
    // Map sysEventLogId to id for compatibility
    const items = converted.items.map((item) => ({
      ...item,
      id: item.sysEventLogId?.toString() || item.id || '',
    }));
    
    return {
      ...res.data,
      data: {
        ...converted,
        items,
      },
    } as ApiResponse<EventsResponse>;
  }
  
  // Already in frontend format
  return res.data as ApiResponse<EventsResponse>;
};

/**
 * Get monitoring timeseries data
 * GET /api/admin/monitoring/timeseries
 * 
 * Backend returns: { interval, metric, labels: string[], values: number[] }
 * Frontend expects: { interval, metric, dataPoints: [{ timestamp, value }] }
 */
export const getMonitoringTimeseries = async (
  params: MonitoringTimeseriesParams
): Promise<ApiResponse<TimeseriesResponse>> => {
  const queryParams = new URLSearchParams();
  queryParams.append('from', params.from);
  queryParams.append('to', params.to);
  queryParams.append('interval', params.interval);
  queryParams.append('metric', params.metric);

  const url = `/api/admin/monitoring/timeseries?${queryParams.toString()}`;
  const res = await axiosInstance.get<ApiResponse<TimeseriesResponseBackend>>(url);
  
  // Convert backend format (labels + values) to frontend format (dataPoints)
  if (!res.data.data) {
    return {
      ...res.data,
      data: {
        metric: params.metric,
        interval: params.interval,
        dataPoints: [],
      },
    } as ApiResponse<TimeseriesResponse>;
  }
  
  const backendData = res.data.data;
  
  // Convert labels and values arrays to dataPoints array
  const dataPoints: TimeseriesDataPoint[] = backendData.labels.map((label, index) => ({
    timestamp: label,
    value: backendData.values[index] || 0,
  }));
  
  return {
    ...res.data,
    data: {
      metric: backendData.metric,
      interval: backendData.interval,
      dataPoints,
    },
  } as ApiResponse<TimeseriesResponse>;
};
