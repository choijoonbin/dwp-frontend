/**
 * Synapse Phase 4 — Reporting APIs
 * /reconciliation, /action-recon, /analytics
 * @see docs/api-spec/synapse-spec/PHASE4_GOVERNANCE_REPORTING_result.md
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Reconciliation Types
// ----------------------------------------------------------------------

export type ReconRunType = 'DOC_OPENITEM_MATCH' | 'ACTION_EFFECT';

export type ReconRunListDto = {
  runId: string;
  runType: ReconRunType;
  startedAt: string;
  endedAt?: string;
  status: string;
  passCount?: number;
  failCount?: number;
};

export type ReconResultDto = {
  resultId: string;
  resourceType: string;
  resourceKey: string;
  status: 'PASS' | 'FAIL';
  detailJson?: Record<string, unknown>;
};

export type ReconRunDetailDto = {
  runId: string;
  runType: ReconRunType;
  startedAt: string;
  endedAt?: string;
  status: string;
  passCount?: number;
  failCount?: number;
  results?: ReconResultDto[];
  summaryJson?: Record<string, unknown>;
};

export type StartReconRequest = {
  runType: ReconRunType;
};

// ----------------------------------------------------------------------
// Action-recon Types
// ----------------------------------------------------------------------

export type FailureReasonDto = {
  reason: string;
  count: number;
  actionIds?: string[];
};

export type ImpactSummaryDto = {
  byActionType?: Record<string, { count: number; amount?: number }>;
  totalAmount?: number;
};

export type ActionReconRowDto = {
  actionId: string;
  caseId: string;
  status: 'success' | 'failed' | 'pending';
  failureReason?: string;
  amount?: number;
  currency?: string;
  actionType?: string;
  bukrs?: string;
};

export type ActionReconDto = {
  successRate: number;
  totalExecuted: number;
  successCount: number;
  failedCount: number;
  failureReasons?: FailureReasonDto[];
  impactSummary?: ImpactSummaryDto;
  rows?: ActionReconRowDto[];
};

// ----------------------------------------------------------------------
// Analytics Types
// ----------------------------------------------------------------------

export type AnalyticsKpiDto = {
  savingsEstimate?: number;
  preventedLossEstimate?: number;
  medianTimeToTriageHours?: number;
  automationRate?: number;
  additionalMetrics?: Record<string, number | string | unknown>;
};

export type AnalyticsParams = {
  from?: string;
  to?: string;
  bukrs?: string;
  currency?: string;
  dims?: string;
};

// ----------------------------------------------------------------------
// Reconciliation API
// ----------------------------------------------------------------------

export const getReconRuns = async (
  runType?: ReconRunType
): Promise<ApiResponse<ReconRunListDto[]>> => {
  const query = runType ? `?runType=${encodeURIComponent(runType)}` : '';
  const res = await axiosInstance.get<ApiResponse<ReconRunListDto[]>>(
    `/api/synapse/reconciliation/runs${query}`
  );
  return res.data;
};

export const getReconRunDetail = async (
  runId: string
): Promise<ApiResponse<ReconRunDetailDto>> => {
  const res = await axiosInstance.get<ApiResponse<ReconRunDetailDto>>(
    `/api/synapse/reconciliation/runs/${encodeURIComponent(runId)}`
  );
  return res.data;
};

export const startReconRun = async (
  body: StartReconRequest
): Promise<ApiResponse<ReconRunDetailDto>> => {
  const res = await axiosInstance.post<ApiResponse<ReconRunDetailDto>>(
    '/api/synapse/reconciliation/runs',
    body
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Action-recon API
// ----------------------------------------------------------------------

export const getActionRecon = async (): Promise<ApiResponse<ActionReconDto>> => {
  const res = await axiosInstance.get<ApiResponse<ActionReconDto>>('/api/synapse/action-recon');
  return res.data;
};

// ----------------------------------------------------------------------
// Analytics API
// ----------------------------------------------------------------------

export const getAnalyticsKpis = async (
  params?: AnalyticsParams
): Promise<ApiResponse<AnalyticsKpiDto>> => {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.bukrs) query.set('bukrs', params.bukrs);
  if (params?.currency) query.set('currency', params.currency);
  if (params?.dims) query.set('dims', params.dims);
  const url = `/api/synapse/analytics/kpis${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<AnalyticsKpiDto>>(url);
  return res.data;
};
