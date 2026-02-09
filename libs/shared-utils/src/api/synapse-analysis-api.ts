/**
 * Synapse Phase2 — Analysis Runs & Action Proposals
 * @see docs/job/BE_FOLLOWUP_QUESTIONS_PHASE2.md
 * @see docs/job/AURA_PHASE2_SERVER_CHANGES.md
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Analysis Runs
// ----------------------------------------------------------------------

export type CreateAnalysisRunResponse = {
  runId: string;
  status: string;
  streamUrl?: string;
  caseId?: string;
  [key: string]: unknown;
};

export type CreateAnalysisRunBody = {
  caseId?: string;
  evidenceSnapshot?: Record<string, unknown>;
  options?: { model?: string; policyVersion?: string };
  [key: string]: unknown;
};

export type AnalysisRunStatusDto = {
  runId: string;
  status: string;
  errorMessage?: string;
  [key: string]: unknown;
};

export const createAnalysisRun = async (
  caseId: string,
  body?: CreateAnalysisRunBody
): Promise<ApiResponse<CreateAnalysisRunResponse>> => {
  const payload: CreateAnalysisRunBody = {
    caseId,
    ...(body ?? {}),
  };
  const res = await axiosInstance.post<ApiResponse<CreateAnalysisRunResponse>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/analysis-runs`,
    payload
  );
  return res.data;
};

export const getAnalysisRunStatus = async (
  runId: string
): Promise<ApiResponse<AnalysisRunStatusDto>> => {
  const res = await axiosInstance.get<ApiResponse<AnalysisRunStatusDto>>(
    `/api/synapse/analysis-runs/${encodeURIComponent(runId)}`
  );
  return res.data;
};

export type AnalysisRunsResponse = {
  runId?: string | null;
  items?: Array<{ runId: string; status?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

export const getAnalysisRuns = async (
  caseId: string,
  params?: { latest?: boolean }
): Promise<ApiResponse<AnalysisRunsResponse>> => {
  const search = params?.latest ? '?latest=true' : '';
  const res = await axiosInstance.get<ApiResponse<AnalysisRunsResponse>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/analysis-runs${search}`
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Action Proposals (Phase2)
// ----------------------------------------------------------------------

export type CaseActionProposalDto = {
  proposalId: string;
  runId?: string;
  type: string;
  status: string;
  riskLevel?: string;
  rationale?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  /** BE: Aura 콜백에서 수신. 승인 플로우 판단용 */
  requiresApproval?: boolean | null;
  [key: string]: unknown;
};

export type CaseActionProposalsResponse = {
  items?: CaseActionProposalDto[];
  content?: CaseActionProposalDto[];
  data?: CaseActionProposalDto[];
  [key: string]: unknown;
};

export const getCaseActionProposals = async (
  caseId: string,
  params?: { runId?: string }
): Promise<ApiResponse<CaseActionProposalsResponse>> => {
  const search = params?.runId ? `?runId=${encodeURIComponent(params.runId)}` : '';
  const res = await axiosInstance.get<ApiResponse<CaseActionProposalsResponse>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/action-proposals${search}`
  );
  return res.data;
};

export const approveActionProposal = async (
  caseId: string,
  proposalId: string
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/action-proposals/${encodeURIComponent(proposalId)}/approve`,
    {}
  );
  return res.data;
};

export const rejectActionProposal = async (
  caseId: string,
  proposalId: string
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/action-proposals/${encodeURIComponent(proposalId)}/reject`,
    {}
  );
  return res.data;
};
