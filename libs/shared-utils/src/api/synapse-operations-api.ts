/**
 * Synapse Phase 2 — Operations APIs
 * cases, anomalies, actions, archive
 * @see apps/remotes/synapsex/docs/20260202/[전달용]SCREEN_TO_ENDPOINT_MATRIX.md
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Cases Types
// ----------------------------------------------------------------------

export type CasesListParams = {
  q?: string;
  status?: string;
  severity?: string;
  caseType?: string;
  driverType?: string;
  assignee?: string;
  assigneeUserId?: string;
  slaRisk?: string;
  ids?: string | string[];
  caseKey?: string;
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

export type PartySummary = {
  nameDisplay?: string;
  partyCode?: string;
  partyId?: string | number;
  [key: string]: unknown;
};

export type CaseListRowDto = {
  caseId: string;
  status: string;
  severity?: string;
  caseType?: string;
  detectedAt?: string;
  reasonTextShort?: string;
  docKeys?: string[];
  partySummary?: PartySummary;
  score?: number;
  [key: string]: unknown;
};

export type FiltersApplied = {
  range?: string;
  status?: string[];
  severity?: string[];
  company?: string[];
  type?: string[];
  anomalyType?: string[];
  assignee?: string;
  caseId?: string;
  [key: string]: unknown;
};

export type CaseListResponse = {
  items?: CaseListRowDto[];
  content?: CaseListRowDto[];
  data?: CaseListRowDto[];
  total?: number;
  totalElements?: number;
  page?: number;
  number?: number;
  size?: number;
  totalPages?: number;
  pageInfo?: { page?: number; size?: number; hasNext?: boolean };
  filtersApplied?: FiltersApplied;
};

export type CaseDetailEvidence = {
  documentOrOpenItem?: Record<string, unknown>;
  reasonText?: string;
  [key: string]: unknown;
};

export type CaseDetailReasoning = {
  score?: number;
  reasonText?: string;
  [key: string]: unknown;
};

export type CaseDetailAction = {
  actions?: Array<{
    actionId?: string;
    id?: string;
    actionType?: string;
    description?: string;
    status?: string;
    riskLevel?: string;
    targetSystem?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type CaseDetailDto = {
  caseId: string;
  status: string;
  severity?: string;
  caseType?: string;
  detectedAt?: string;
  evidence?: CaseDetailEvidence;
  reasoning?: CaseDetailReasoning;
  action?: CaseDetailAction;
  [key: string]: unknown;
};

// ----------------------------------------------------------------------
// Anomalies Types
// ----------------------------------------------------------------------

export type AnomaliesListParams = {
  severity?: string;
  anomalyType?: string;
  /** URL drill-down param (alias for anomalyType, e.g. DUPLICATE_INVOICE) */
  type?: string;
  detectedFrom?: string;
  detectedTo?: string;
  page?: number;
  size?: number;
};

export type AnomalyRowDto = {
  anomalyId: string;
  severity?: string;
  anomalyType?: string;
  detectedAt?: string;
  score?: number;
  docKey?: string;
  partyId?: number;
  [key: string]: unknown;
};

/** Alias for list row compatibility */
export type AnomalyListRowDto = AnomalyRowDto;

export type AnomaliesListResponse = {
  items?: AnomalyRowDto[];
  content?: AnomalyRowDto[];
  total?: number;
  totalElements?: number;
  page?: number;
  size?: number;
  totalPages?: number;
  filtersApplied?: FiltersApplied;
};

// ----------------------------------------------------------------------
// Actions Types
// ----------------------------------------------------------------------

export type ActionsListParams = {
  status?: string;
  /** 표준: PENDING | APPROVED | REJECTED | EXECUTED | FAILED */
  actionStatus?: string;
  requiresApproval?: boolean;
  type?: string;
  caseId?: string;
  assignee?: string;
  focus?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  size?: number;
};

export type CreateActionBody = {
  caseId: string;
  actionType?: string;
  [key: string]: unknown;
};

export type ActionRowDto = {
  actionId: string;
  caseId?: string;
  status?: string;
  actionType?: string;
  createdAt?: string;
  executedAt?: string;
  outcome?: string;
  failureReason?: string;
  docKey?: string;
  partyId?: number;
  [key: string]: unknown;
};

/** Alias for list row compatibility */
export type ActionListRowDto = ActionRowDto;

export type ActionsListResponse = {
  items?: ActionRowDto[];
  content?: ActionRowDto[];
  data?: ActionRowDto[];
  total?: number;
  totalElements?: number;
  page?: number;
  size?: number;
  filtersApplied?: FiltersApplied;
  totalPages?: number;
};

// ----------------------------------------------------------------------
// Archive Types
// ----------------------------------------------------------------------

export type ArchiveListParams = {
  outcome?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
};

export type ArchiveRowDto = {
  actionId?: string;
  archiveId?: string;
  caseId?: string;
  actionType?: string;
  status?: string;
  outcome?: string;
  type?: string;
  executedAt?: string;
  failureReason?: string;
  docKey?: string;
  partyId?: number;
  createdAt?: string;
  [key: string]: unknown;
};

/** Alias for list row compatibility */
export type ArchiveListRowDto = ArchiveRowDto;

export type ArchiveListResponse = {
  items?: ArchiveRowDto[];
  content?: ArchiveRowDto[];
  total?: number;
  totalElements?: number;
  page?: number;
  size?: number;
  totalPages?: number;
};

// ----------------------------------------------------------------------
// Cases API
// ----------------------------------------------------------------------

export const getCases = async (
  params?: CasesListParams
): Promise<ApiResponse<CaseListResponse>> => {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        if (value.length > 0) query.set(key, value.join(','));
      } else if (value !== '') {
        query.set(key, String(value));
      }
    });
  }
  const url = `/api/synapse/cases${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<CaseListResponse>>(url);
  return res.data;
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
): Promise<ApiResponse<CaseDetailDto>> => {
  const res = await axiosInstance.post<ApiResponse<CaseDetailDto>>(
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
): Promise<ApiResponse<AnomaliesListResponse>> => {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });
  }
  const url = `/api/synapse/anomalies${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<AnomaliesListResponse>>(url);
  return res.data;
};

// ----------------------------------------------------------------------
// Actions API
// ----------------------------------------------------------------------

export const getActions = async (
  params?: ActionsListParams
): Promise<ApiResponse<ActionsListResponse>> => {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });
  }
  const url = `/api/synapse/actions${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<ActionsListResponse>>(url);
  return res.data;
};

export const createAction = async (
  body: CreateActionBody
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionRowDto>>(
    '/api/synapse/actions',
    body
  );
  return res.data;
};

export const approveAction = async (
  actionId: string
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionRowDto>>(
    `/api/synapse/actions/${encodeURIComponent(actionId)}/approve`,
    {}
  );
  return res.data;
};

export const executeAction = async (
  actionId: string
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionRowDto>>(
    `/api/synapse/actions/${encodeURIComponent(actionId)}/execute`,
    {}
  );
  return res.data;
};

export const rejectAction = async (
  actionId: string
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionRowDto>>(
    `/api/synapse/actions/${encodeURIComponent(actionId)}/reject`,
    {}
  );
  return res.data;
};

export const simulateAction = async (
  actionId: string
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionRowDto>>(
    `/api/synapse/actions/${encodeURIComponent(actionId)}/simulate`,
    {}
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Archive API
// ----------------------------------------------------------------------

export const getArchive = async (
  params?: ArchiveListParams
): Promise<ApiResponse<ArchiveListResponse>> => {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });
  }
  const url = `/api/synapse/archive${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<ArchiveListResponse>>(url);
  return res.data;
};
