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
  pvTrend?: number; // Percentage change vs comparison period
  uvTrend?: number; // Percentage change vs comparison period
  eventsTrend?: number; // Percentage change vs comparison period
  apiErrorRateTrend?: number; // Percentage change vs comparison period
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
 * Page View Item
 */
export type PageViewItem = {
  id: string;
  route: string;
  path: string;
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
 * API History Item
 */
export type ApiHistoryItem = {
  id: string;
  apiName: string;
  apiUrl: string;
  method: string; // GET, POST, PUT, DELETE, etc.
  statusCode: number;
  userId?: string;
  timestamp: string; // ISO 8601 date string
  responseTime?: number; // milliseconds
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
  userId?: string | null;
};

/**
 * Visitors Response
 */
export type VisitorsResponse = {
  items: VisitorSummary[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
};

/**
 * Event Log Item
 */
export type EventLogItem = {
  id: string;
  occurredAt: string; // ISO 8601 date string
  eventType: string;
  resourceKey: string;
  action: string;
  label?: string | null;
  visitorId?: string | null;
  userId?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Events Response
 */
export type EventsResponse = {
  items: EventLogItem[];
  total: number;
  page: number;
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
 * Timeseries Response
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
 */
export type EventPayload = {
  eventType: string; // e.g., 'click', 'scroll', 'submit', 'view'
  resourceKey: string; // e.g., 'menu.mail.send', 'menu.admin.users'
  action: string; // e.g., 'send_mail', 'view_users', 'execute_ai'
  label?: string; // Optional label
  metadata?: Record<string, unknown>; // Optional metadata
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
  const res = await axiosInstance.get<ApiResponse<PageViewsResponse>>(url);
  return res.data;
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
  const res = await axiosInstance.get<ApiResponse<ApiHistoriesResponse>>(url);
  return res.data;
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
 */
export const postEvent = async (payload: EventPayload): Promise<ApiResponse<{ success: boolean }>> => {
  try {
    const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>('/api/monitoring/event', payload);
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
 * Get monitoring visitors list
 * GET /api/admin/monitoring/visitors
 */
export const getMonitoringVisitors = async (
  params?: MonitoringVisitorsParams
): Promise<ApiResponse<VisitorsResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.keyword) queryParams.append('keyword', params.keyword);

  const url = `/api/admin/monitoring/visitors${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<VisitorsResponse>>(url);
  return res.data;
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
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.eventType) queryParams.append('eventType', params.eventType);
  if (params?.resourceKey) queryParams.append('resourceKey', params.resourceKey);

  const url = `/api/admin/monitoring/events${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<EventsResponse>>(url);
  return res.data;
};

/**
 * Get monitoring timeseries data
 * GET /api/admin/monitoring/timeseries
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
  const res = await axiosInstance.get<ApiResponse<TimeseriesResponse>>(url);
  return res.data;
};
