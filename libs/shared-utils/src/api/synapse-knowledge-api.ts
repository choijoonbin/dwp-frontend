/**
 * Synapse Phase 3 — Knowledge/Policy APIs
 * /rag, /policies, /guardrails, /dictionary, /feedback
 * @see docs/api-spec/synapse-spec/PHASE3_KNOWLEDGE_POLICY_APIS_result.md
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResponse } from '../admin/types';

// ----------------------------------------------------------------------
// RAG Types
// ----------------------------------------------------------------------

export type RagDocumentListDto = {
  docId: string;
  title: string;
  sourceType: string;
  status: string;
  createdAt: string;
};

export type RagChunkDto = {
  chunkId: string;
  docId: string;
  pageNo?: number;
  chunkText: string;
};

export type RagDocumentDetailDto = {
  docId: string;
  title: string;
  sourceType: string;
  status: string;
  createdAt: string;
  chunks?: RagChunkDto[];
};

export type RagSearchResultDto = {
  chunkId: string;
  docId: string;
  docTitle: string;
  pageNo?: number;
  chunkText: string;
  score?: number;
};

export type RegisterRagDocumentRequest = {
  title: string;
  sourceType: string;
  s3Key?: string;
  url?: string;
  checksum?: string;
};

export type RagDocumentsListParams = {
  status?: string;
  page?: number;
  size?: number;
};

export type RagSearchParams = {
  q: string;
  page?: number;
  size?: number;
};

// ----------------------------------------------------------------------
// Policies Types
// ----------------------------------------------------------------------

export type PolicyProfileSummary = {
  profileId: string;
  profileName: string;
  isDefault?: boolean;
  scope?: string;
};

export type PolicyProfileListDto = {
  profiles: PolicyProfileSummary[];
  defaultProfileId?: string;
};

export type PolicyProfileDetailDto = {
  profileId: string;
  profileName: string;
  isDefault?: boolean;
  dataProtection?: unknown;
  thresholds?: unknown;
  piiPolicies?: unknown;
};

export type EffectivePolicyDto = {
  profileId: string;
  profileName: string;
  enabledBukrs?: string[];
  enabledCurrencies?: string[];
  dataProtection?: unknown;
  thresholds?: unknown;
  piiPolicies?: unknown;
};

export type EffectivePolicyParams = {
  profileId?: string;
  bukrs?: string;
};

// ----------------------------------------------------------------------
// Guardrails Types
// ----------------------------------------------------------------------

export type GuardrailListDto = {
  guardrailId: string;
  name: string;
  scope: string;
  ruleJson?: unknown;
  isEnabled: boolean;
  createdAt?: string;
};

export type GuardrailUpsertRequest = {
  name: string;
  scope: string;
  ruleJson?: unknown;
  isEnabled?: boolean;
};

export type GuardrailEvaluateRequest = {
  caseType?: string;
  actionType?: string;
  amount?: number;
  currency?: string;
  bukrs?: string;
  partyId?: string;
};

export type GuardrailEvaluateResponse = {
  allowed: boolean;
  requiredApprovalLevel?: string;
  violatedRules?: string[];
};

// ----------------------------------------------------------------------
// Dictionary Types
// ----------------------------------------------------------------------

export type DictionaryTermDto = {
  termId: string;
  termKey: string;
  labelKo?: string;
  description?: string;
  category?: string;
};

export type DictionaryTermUpsertRequest = {
  termKey: string;
  labelKo?: string;
  description?: string;
  category?: string;
};

export type DictionaryListParams = {
  category?: string;
};

// ----------------------------------------------------------------------
// Feedback Types
// ----------------------------------------------------------------------

export type FeedbackLabelDto = {
  feedbackId: string;
  targetType: string;
  targetId: string;
  label: string;
  comment?: string;
  createdAt: string;
};

export type FeedbackCreateRequest = {
  targetType: 'CASE' | 'DOC' | 'ENTITY';
  targetId: string;
  label: 'VALID' | 'INVALID' | 'NEEDS_REVIEW';
  comment?: string;
};

export type FeedbackListParams = {
  targetType?: string;
  targetId?: string;
};

// ----------------------------------------------------------------------
// Spring Page helper
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
// RAG API
// ----------------------------------------------------------------------

export const getRagDocuments = async (
  params?: RagDocumentsListParams
): Promise<ApiResponse<PageResponse<RagDocumentListDto>>> => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));
  const url = `/api/synapse/rag/documents${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<SpringPage<RagDocumentListDto> | PageResponse<RagDocumentListDto>>>(url);
  const data = res.data?.data;
  if (data) return { ...res.data, data: toPageResponse(data) };
  return res.data as ApiResponse<PageResponse<RagDocumentListDto>>;
};

export const registerRagDocument = async (
  body: RegisterRagDocumentRequest
): Promise<ApiResponse<RagDocumentDetailDto>> => {
  const res = await axiosInstance.post<ApiResponse<RagDocumentDetailDto>>('/api/synapse/rag/documents', body);
  return res.data;
};

export const getRagDocumentDetail = async (
  docId: string
): Promise<ApiResponse<RagDocumentDetailDto>> => {
  const res = await axiosInstance.get<ApiResponse<RagDocumentDetailDto>>(
    `/api/synapse/rag/documents/${encodeURIComponent(docId)}`
  );
  return res.data;
};

export const searchRag = async (
  params: RagSearchParams
): Promise<ApiResponse<PageResponse<RagSearchResultDto>>> => {
  const query = new URLSearchParams();
  query.set('q', params.q);
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));
  const url = `/api/synapse/rag/search?${query.toString()}`;
  const res = await axiosInstance.get<ApiResponse<SpringPage<RagSearchResultDto> | PageResponse<RagSearchResultDto>>>(url);
  const data = res.data?.data;
  if (data) return { ...res.data, data: toPageResponse(data) };
  return res.data as ApiResponse<PageResponse<RagSearchResultDto>>;
};

// ----------------------------------------------------------------------
// Policies API
// ----------------------------------------------------------------------

export const getPolicyProfiles = async (): Promise<ApiResponse<PolicyProfileListDto>> => {
  const res = await axiosInstance.get<ApiResponse<PolicyProfileListDto>>('/api/synapse/policies/profiles');
  return res.data;
};

export const getPolicyProfileDetail = async (
  profileId: string
): Promise<ApiResponse<PolicyProfileDetailDto>> => {
  const res = await axiosInstance.get<ApiResponse<PolicyProfileDetailDto>>(
    `/api/synapse/policies/profiles/${encodeURIComponent(profileId)}`
  );
  return res.data;
};

export const getEffectivePolicy = async (
  params?: EffectivePolicyParams
): Promise<ApiResponse<EffectivePolicyDto>> => {
  const query = new URLSearchParams();
  if (params?.profileId) query.set('profileId', params.profileId);
  if (params?.bukrs) query.set('bukrs', params.bukrs);
  const url = `/api/synapse/policies/effective${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<EffectivePolicyDto>>(url);
  return res.data;
};

// ----------------------------------------------------------------------
// Guardrails API
// ----------------------------------------------------------------------

export const getGuardrails = async (
  enabledOnly?: boolean
): Promise<ApiResponse<GuardrailListDto[]>> => {
  const query = enabledOnly ? '?enabledOnly=true' : '';
  const res = await axiosInstance.get<ApiResponse<GuardrailListDto[]>>(`/api/synapse/guardrails${query}`);
  return res.data;
};

export const createGuardrail = async (
  body: GuardrailUpsertRequest
): Promise<ApiResponse<GuardrailListDto>> => {
  const res = await axiosInstance.post<ApiResponse<GuardrailListDto>>('/api/synapse/guardrails', body);
  return res.data;
};

export const updateGuardrail = async (
  guardrailId: string,
  body: GuardrailUpsertRequest
): Promise<ApiResponse<GuardrailListDto>> => {
  const res = await axiosInstance.put<ApiResponse<GuardrailListDto>>(
    `/api/synapse/guardrails/${encodeURIComponent(guardrailId)}`,
    body
  );
  return res.data;
};

export const deleteGuardrail = async (guardrailId: string): Promise<ApiResponse<void>> => {
  const res = await axiosInstance.delete<ApiResponse<void>>(
    `/api/synapse/guardrails/${encodeURIComponent(guardrailId)}`
  );
  return res.data;
};

export const evaluateGuardrail = async (
  body: GuardrailEvaluateRequest
): Promise<ApiResponse<GuardrailEvaluateResponse>> => {
  const res = await axiosInstance.post<ApiResponse<GuardrailEvaluateResponse>>(
    '/api/synapse/guardrails/evaluate',
    body
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Dictionary API
// ----------------------------------------------------------------------

export const getDictionary = async (
  params?: DictionaryListParams
): Promise<ApiResponse<DictionaryTermDto[]>> => {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  const url = `/api/synapse/dictionary${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<DictionaryTermDto[]>>(url);
  return res.data;
};

export const createDictionaryTerm = async (
  body: DictionaryTermUpsertRequest
): Promise<ApiResponse<DictionaryTermDto>> => {
  const res = await axiosInstance.post<ApiResponse<DictionaryTermDto>>('/api/synapse/dictionary', body);
  return res.data;
};

export const updateDictionaryTerm = async (
  termId: string,
  body: DictionaryTermUpsertRequest
): Promise<ApiResponse<DictionaryTermDto>> => {
  const res = await axiosInstance.put<ApiResponse<DictionaryTermDto>>(
    `/api/synapse/dictionary/${encodeURIComponent(termId)}`,
    body
  );
  return res.data;
};

export const deleteDictionaryTerm = async (termId: string): Promise<ApiResponse<void>> => {
  const res = await axiosInstance.delete<ApiResponse<void>>(
    `/api/synapse/dictionary/${encodeURIComponent(termId)}`
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Feedback API
// ----------------------------------------------------------------------

export const getFeedback = async (
  params?: FeedbackListParams
): Promise<ApiResponse<FeedbackLabelDto[]>> => {
  const query = new URLSearchParams();
  if (params?.targetType) query.set('targetType', params.targetType);
  if (params?.targetId) query.set('targetId', params.targetId);
  const url = `/api/synapse/feedback${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<FeedbackLabelDto[]>>(url);
  return res.data;
};

export const createFeedback = async (
  body: FeedbackCreateRequest
): Promise<ApiResponse<FeedbackLabelDto>> => {
  const res = await axiosInstance.post<ApiResponse<FeedbackLabelDto>>('/api/synapse/feedback', body);
  return res.data;
};
