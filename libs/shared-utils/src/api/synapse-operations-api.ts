/**
 * Synapse Phase 2 — Operational APIs
 * /cases, /anomalies, /actions, /archive
 * @see docs/api-spec/synapse-spec/PHASE2_OPERATIONAL_APIS_result.md
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResponse } from '../admin/types';

// ----------------------------------------------------------------------
// Types — Cases
// ----------------------------------------------------------------------

export type CaseListRowDto = {
  caseId: number;
  detectedAt: string;
  caseType: string;
  severity: string;
  score: number;
  status: string;
  docKeys?: string[];
  partySummary?: { partyId: number; partyCode: string; nameDisplay: string };
  reasonTextShort?: string;
  relatedActionsCount?: number;
};

export type CaseDetailEvidence = {
  documentOrOpenItem?: unknown;
  reversalChainSummary?: unknown;
  relatedPartyIds?: number[];
};

export type CaseDetailReasoning = {
  score?: number;
  reasonText?: string;
  evidenceJson?: unknown;
  ragRefsJson?: unknown;
  confidenceBreakdown?: unknown;
};

export type CaseDetailAction = {
  availableActionTypes?: string[];
  actions?: unknown[];
  lineageLinkParams?: Record<string, string>;
};

export type CaseDetailDto = {
  evidence?: CaseDetailEvidence;
  reasoning?: CaseDetailReasoning;
  action?: CaseDetailAction;
};

export type CasesListParams = {
  status?: string;
  severity?: string;
  caseType?: string;
  detectedFrom?: string;
  detectedTo?: string;
  bukrs?: string;
  belnr?: string;
  gjahr?: string;
  buzei?: string;
  partyId?: number;
  page?: number;
  size?: number;
  sort?: string;
};

// ----------------------------------------------------------------------
// Types — Anomalies
// ----------------------------------------------------------------------

export type AnomalyListRowDto = {
  anomalyId: number;
  anomalyType: string;
  severity: string;
  score: number;
  detectedAt: string;
  topEvidenceFields?: Record<string, unknown>;
  docKey?: string;
  partyId?: number;
};

export type AnomaliesListParams = {
  severity?: string;
  anomalyType?: string;
  detectedFrom?: string;
  detectedTo?: string;
  page?: number;
  size?: number;
};

// ----------------------------------------------------------------------
// Types — Actions
// ----------------------------------------------------------------------

export type ActionListRowDto = {
  actionId: number;
  caseId: number;
  actionType: string;
  status: string;
  createdAt: string;
  executedAt?: string;
  outcome?: string;
  failureReason?: string;
};

export type ActionDetailDto = {
  actionId: number;
  caseId: number;
  actionType: string;
  status: string;
  payload?: Record<string, unknown>;
  simulationBefore?: unknown;
  simulationAfter?: unknown;
  diffJson?: unknown;
  createdAt: string;
};

export type CreateActionBody = {
  caseId: number;
  actionType: string;
  payload?: Record<string, unknown>;
};

export type ActionsListParams = {
  status?: string;
  type?: string;
  caseId?: number;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  size?: number;
};

// ----------------------------------------------------------------------
// Types — Archive
// ----------------------------------------------------------------------

export type ArchiveListRowDto = {
  actionId: number;
  caseId: number;
  actionType: string;
  status: string;
  outcome?: string;
  executedAt?: string;
  failureReason?: string;
  docKey?: string;
  partyId?: number;
};

export type ArchiveListParams = {
  outcome?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
};

// ----------------------------------------------------------------------
// Spring Page format (BE may return content/totalElements)
// ----------------------------------------------------------------------

type SpringPage<T> = {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
};

function toPageResponse<T>(spring: SpringPage<T> | PageResponse<T>): PageResponse<T> {
  if ('items' in spring && Array.isArray(spring.items)) {
    return spring as PageResponse<T>;
  }
  const content = (spring as SpringPage<T>).content ?? [];
  const total = (spring as SpringPage<T>).totalElements ?? content.length;
  const size = (spring as SpringPage<T>).size ?? 20;
  const number = (spring as SpringPage<T>).number ?? 0;
  return {
    items: content,
    total,
    page: number,
    size,
    totalPages: (spring as SpringPage<T>).totalPages ?? (Math.ceil(total / size) || 1),
  };
}

// ----------------------------------------------------------------------
// Cases API
// ----------------------------------------------------------------------

export const getCases = async (
  params?: CasesListParams
): Promise<ApiResponse<PageResponse<CaseListRowDto>>> => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.severity) query.set('severity', params.severity);
  if (params?.caseType) query.set('caseType', params.caseType);
  if (params?.detectedFrom) query.set('detectedFrom', params.detectedFrom);
  if (params?.detectedTo) query.set('detectedTo', params.detectedTo);
  if (params?.bukrs) query.set('bukrs', params.bukrs);
  if (params?.belnr) query.set('belnr', params.belnr);
  if (params?.gjahr) query.set('gjahr', params.gjahr);
  if (params?.buzei) query.set('buzei', params.buzei);
  if (params?.partyId != null) query.set('partyId', String(params.partyId));
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));
  if (params?.sort) query.set('sort', params.sort);

  const url = `/api/synapse/cases${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<SpringPage<CaseListRowDto> | PageResponse<CaseListRowDto>>>(url);
  const data = res.data?.data;
  if (data) {
    return { ...res.data, data: toPageResponse(data) };
  }
  return res.data as ApiResponse<PageResponse<CaseListRowDto>>;
};

export const getCaseDetail = async (
  caseId: string
): Promise<ApiResponse<CaseDetailDto>> => {
  const res = await axiosInstance.get<ApiResponse<CaseDetailDto>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}`
  );
  return res.data;
};

export const updateCaseStatus = async (
  caseId: string,
  status: 'TRIAGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/status`,
    { status }
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Anomalies API
// ----------------------------------------------------------------------

export const getAnomalies = async (
  params?: AnomaliesListParams
): Promise<ApiResponse<PageResponse<AnomalyListRowDto>>> => {
  const query = new URLSearchParams();
  if (params?.severity) query.set('severity', params.severity);
  if (params?.anomalyType) query.set('anomalyType', params.anomalyType);
  if (params?.detectedFrom) query.set('detectedFrom', params.detectedFrom);
  if (params?.detectedTo) query.set('detectedTo', params.detectedTo);
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));

  const url = `/api/synapse/anomalies${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<SpringPage<AnomalyListRowDto> | PageResponse<AnomalyListRowDto>>>(url);
  const data = res.data?.data;
  if (data) {
    return { ...res.data, data: toPageResponse(data) };
  }
  return res.data as ApiResponse<PageResponse<AnomalyListRowDto>>;
};

// ----------------------------------------------------------------------
// Actions API
// ----------------------------------------------------------------------

export const getActions = async (
  params?: ActionsListParams
): Promise<ApiResponse<PageResponse<ActionListRowDto>>> => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.type) query.set('type', params.type);
  if (params?.caseId != null) query.set('caseId', String(params.caseId));
  if (params?.createdFrom) query.set('createdFrom', params.createdFrom);
  if (params?.createdTo) query.set('createdTo', params.createdTo);
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));

  const url = `/api/synapse/actions${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<SpringPage<ActionListRowDto> | PageResponse<ActionListRowDto>>>(url);
  const data = res.data?.data;
  if (data) {
    return { ...res.data, data: toPageResponse(data) };
  }
  return res.data as ApiResponse<PageResponse<ActionListRowDto>>;
};

export const createAction = async (
  body: CreateActionBody
): Promise<ApiResponse<ActionDetailDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionDetailDto>>(
    '/api/synapse/actions',
    body
  );
  return res.data;
};

export const approveAction = async (
  actionId: string
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/synapse/actions/${encodeURIComponent(actionId)}/approve`,
    {}
  );
  return res.data;
};

export const executeAction = async (
  actionId: string
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.post<ApiResponse<unknown>>(
    `/api/synapse/actions/${encodeURIComponent(actionId)}/execute`,
    {}
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Archive API
// ----------------------------------------------------------------------

export const getArchive = async (
  params?: ArchiveListParams
): Promise<ApiResponse<PageResponse<ArchiveListRowDto>>> => {
  const query = new URLSearchParams();
  if (params?.outcome) query.set('outcome', params.outcome);
  if (params?.type) query.set('type', params.type);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));

  const url = `/api/synapse/archive${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<SpringPage<ArchiveListRowDto> | PageResponse<ArchiveListRowDto>>>(url);
  const data = res.data?.data;
  if (data) {
    return { ...res.data, data: toPageResponse(data) };
  }
  return res.data as ApiResponse<PageResponse<ArchiveListRowDto>>;
};
