/**
 * Synapse Detect Batch API
 * GET /api/synapse/admin/detect/runs — 목록
 * GET /api/synapse/admin/detect/runs/{runId} — 상세
 * POST /api/synapse/admin/detect/run — 수동 실행
 * GET /api/synapse/admin/detect/scheduler/status — 스케줄러 상태(조회 전용)
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

/** BE: COMPLETED(성공) | RUNNING | FAILED | SKIPPED */
export type DetectRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'COMPLETED';

export type DetectRunSummary = {
  /** BE가 number로 반환할 수 있음 */
  runId: string | number;
  startedAt: string;
  status: DetectRunStatus;
  windowFrom?: string;
  windowTo?: string;
  durationMs?: number;
  createdCount?: number;
  updatedCount?: number;
  suppressedCount?: number;
  message?: string;
};

export type DetectRunDetail = DetectRunSummary & {
  countsJson?: Record<string, unknown>;
  traceId?: string;
  auditId?: string;
  /** SKIPPED 시: 실행 중인 run ID */
  runningRunId?: string;
  /** SKIPPED 시: 건너뜀 사유 */
  skipReason?: string;
};

export type DetectRunsListParams = {
  from?: string;
  to?: string;
  status?: DetectRunStatus | DetectRunStatus[];
  page?: number;
  size?: number;
  sort?: string;
};

export type DetectRunNowBody = {
  windowMinutes?: number;
  from?: string;
  to?: string;
};

export type DetectRunsListResponse = {
  items?: DetectRunSummary[];
  content?: DetectRunSummary[];
  total?: number;
  totalElements?: number;
  totalPages?: number;
  page?: number;
  size?: number;
};

/** Manual Run SKIPPED 응답 시 추가 필드 */
export type DetectRunNowSkippedResponse = DetectRunSummary & {
  status: 'SKIPPED';
  skipReason?: string;
  runningRunId?: string;
};

export type DetectSchedulerStatus = {
  enabled: boolean;
  scheduleType?: 'cron' | 'interval';
  intervalMinutes?: number;
  cronExpression?: string;
  lastRunId?: string;
  lastSuccessAt?: string;
  lastFailAt?: string;
  running?: boolean;
  runningRunId?: string;
  runningSince?: string;
  nextPlannedAt?: string;
};

// ----------------------------------------------------------------------
// API
// ----------------------------------------------------------------------

export const getDetectSchedulerStatus = async (): Promise<
  ApiResponse<DetectSchedulerStatus>
> => {
  const res = await axiosInstance.get<ApiResponse<DetectSchedulerStatus>>(
    '/api/synapse/admin/detect/scheduler/status'
  );
  return res.data;
};

export const getDetectRuns = async (
  params?: DetectRunsListParams
): Promise<ApiResponse<DetectRunsListResponse>> => {
  const query = new URLSearchParams();
  if (params) {
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.status) {
      const statusArr = Array.isArray(params.status) ? params.status : [params.status];
      if (statusArr.length) query.set('status', statusArr.join(','));
    }
    if (params.page !== undefined) query.set('page', params.page.toString());
    if (params.size !== undefined) query.set('size', params.size.toString());
    if (params.sort) query.set('sort', params.sort);
  }
  const url = `/api/synapse/admin/detect/runs${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<DetectRunsListResponse>>(url);
  return res.data;
};

export const getDetectRunDetail = async (
  runId: string
): Promise<ApiResponse<DetectRunDetail>> => {
  const res = await axiosInstance.get<ApiResponse<DetectRunDetail>>(
    `/api/synapse/admin/detect/runs/${encodeURIComponent(runId)}`
  );
  return res.data;
};

export const runDetectNow = async (
  body?: DetectRunNowBody
): Promise<ApiResponse<DetectRunSummary | DetectRunNowSkippedResponse>> => {
  const res = await axiosInstance.post<ApiResponse<DetectRunSummary | DetectRunNowSkippedResponse>>(
    '/api/synapse/admin/detect/run',
    body ?? {}
  );
  return res.data;
};
