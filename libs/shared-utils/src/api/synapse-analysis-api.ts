/**
 * Synapse Phase3 — Analysis Runs & Action Proposals
 * BE: back.txt, Aura: aura.txt 반영
 * @see docs/job/PHASE3_HANDOFF_BY_SYSTEM.md
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Analysis Runs
// ----------------------------------------------------------------------

export type CreateAnalysisRunResponse = {
  runId: string;
  status: string;
  /** FE 스트림 연결 경로. Aura는 streamPath, BE는 streamUrl/streamPath 중 하나로 전달 */
  streamUrl?: string;
  streamPath?: string;
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
  /** Phase3: BE UNIQUE(run_id, fingerprint); FE dedup by fingerprint */
  fingerprint?: string;
  /** BE: 결정 메타 (back.txt) */
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionComment?: string | null;
  /** BE: Aura 콜백에서 수신. 승인 플로우 판단용 */
  requiresApproval?: boolean | null;
  /** Aura: 추가 확인사항. 빈 배열/null이면 UI에서 섹션 숨김 (PHASE3_FOLLOWUP) */
  checklist?: string[] | null;
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

/** BE(back.txt): 승인/거절 시 선택 body (approve/reject 호출 시) */
export type ProposalDecisionRequest = {
  comment?: string;
};

/** BE 답변: decision API — POST .../decision, body { decision, comment? }. approve/reject와 동일 동작. */
export type ActionProposalDecisionBody = {
  decision: 'APPROVE' | 'REJECT';
  comment?: string;
};

export const submitActionProposalDecision = async (
  caseId: string,
  proposalId: string,
  body: ActionProposalDecisionBody
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/action-proposals/${encodeURIComponent(proposalId)}/decision`,
    body
  );
  return res.data;
};

export const approveActionProposal = async (
  caseId: string,
  proposalId: string,
  body?: ProposalDecisionRequest
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/action-proposals/${encodeURIComponent(proposalId)}/approve`,
    body ?? {}
  );
  return res.data;
};

export const rejectActionProposal = async (
  caseId: string,
  proposalId: string,
  body?: ProposalDecisionRequest
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/action-proposals/${encodeURIComponent(proposalId)}/reject`,
    body ?? {}
  );
  return res.data;
};

/** BE(back.txt): POST .../action-proposals/{proposalId}/execute — APPROVED 제안만 호출 가능 */
export type ProposalExecuteResponseDto = {
  executionId?: string;
  proposalId?: string;
  status?: string;
  mode?: string;
  executedAt?: string;
  [key: string]: unknown;
};

export const executeProposal = async (
  caseId: string,
  proposalId: string
): Promise<ApiResponse<ProposalExecuteResponseDto>> => {
  const res = await axiosInstance.post<ApiResponse<ProposalExecuteResponseDto>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/action-proposals/${encodeURIComponent(proposalId)}/execute`,
    {}
  );
  return res.data;
};
