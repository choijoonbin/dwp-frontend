/**
 * Synapse Ingest Run API (원천 적재 실행)
 * GET /api/synapse/admin/ingest/runs — 목록
 * GET /api/synapse/admin/ingest/runs/{runId} — 상세
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type IngestRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'COMPLETED';

export type IngestRunSummary = {
  runId: string | number;
  startedAt: string;
  status: IngestRunStatus;
  windowFrom?: string;
  windowTo?: string;
  durationMs?: number;
  ingestedCount?: number;
  failedCount?: number;
  message?: string;
};

export type IngestRunDetail = IngestRunSummary & {
  countsJson?: Record<string, unknown>;
  traceId?: string;
  auditId?: string;
  /** SKIPPED 시: 실행 중인 run ID */
  runningRunId?: string;
  /** SKIPPED 시: 건너뜀 사유 */
  skipReason?: string;
};

export type IngestRunsListParams = {
  from?: string;
  to?: string;
  status?: IngestRunStatus | IngestRunStatus[];
  page?: number;
  size?: number;
  sort?: string;
};

export type IngestRunsListResponse = {
  items?: IngestRunSummary[];
  content?: IngestRunSummary[];
  total?: number;
  totalElements?: number;
  totalPages?: number;
  page?: number;
  size?: number;
};

// ----------------------------------------------------------------------
// API
// ----------------------------------------------------------------------

export const getIngestRuns = async (
  params?: IngestRunsListParams
): Promise<ApiResponse<IngestRunsListResponse>> => {
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
  const url = `/api/synapse/admin/ingest/runs${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<IngestRunsListResponse>>(url);
  return res.data;
};

export const getIngestRunDetail = async (
  runId: string
): Promise<ApiResponse<IngestRunDetail>> => {
  const res = await axiosInstance.get<ApiResponse<IngestRunDetail>>(
    `/api/synapse/admin/ingest/runs/${encodeURIComponent(runId)}`
  );
  return res.data;
};
