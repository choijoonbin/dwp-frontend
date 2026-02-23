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
  /** 청킹 전략 키 (catalog docTypes와 동일). 없으면 sourceType 등으로 대체 */
  chunkingStrategy?: string;
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

// ----------------------------------------------------------------------
// Hybrid RAG Search Types (Context-Aware)
// ----------------------------------------------------------------------

/** 계층 레벨 타입 */
export type HierarchyLevel = 'CHAPTER' | 'ARTICLE' | 'CLAUSE' | 'PARAGRAPH';

/** 계층 경로 아이템 */
export type HierarchyPathItem = {
  level: HierarchyLevel;
  number?: string;
  title?: string;
  /** chunkId를 anchorId로 사용 */
  anchorId?: string;
};

/** Child chunk (하위 청크) */
export type RagChildChunkDto = {
  chunkId: string;
  /** anchorId는 chunkId와 동일 */
  anchorId?: string;
  hierarchyPath?: HierarchyPathItem[];
  snippet: string;
  score: number;
  clause?: string;
};

/** Parent result (상위 조문) */
export type RagParentResultDto = {
  parentId: string;
  articleNo?: string;
  title?: string;
  docId?: string;
  docTitle?: string;
  version?: string;
  maxScore?: number;
  children: RagChildChunkDto[];
};

/** Hybrid RAG Search 전략 */
export type RagSearchStrategy = 'HYBRID' | 'VECTOR_ONLY' | 'BM25_ONLY';

/** Hybrid RAG Search 요청 */
export type HybridRagSearchRequest = {
  query: string;
  strategy?: RagSearchStrategy;
  topK?: number;
  rerank?: boolean;
  minScore?: number;
  docIds?: string[];
};

/** Hybrid RAG Search 응답 */
export type HybridRagSearchResponse = {
  parents: RagParentResultDto[];
  totalHits: number;
  strategy: RagSearchStrategy;
  queryHash?: string;
};

/** Hybrid Search 기본값 */
export const HYBRID_RAG_DEFAULTS = {
  strategy: 'HYBRID' as RagSearchStrategy,
  topK: 10,
  rerank: true,
  minScore: 0.3,
};

export type RegisterRagDocumentRequest = {
  title: string;
  sourceType: string;
  s3Key?: string;
  url?: string;
  checksum?: string;
  /** 문서 유형. REGULATION | MANUAL | POLICY | GENERAL. URL/S3 등록 시 사용 */
  docType?: string;
};

// ----------------------------------------------------------------------
// Chunking Strategy (Re-Chunking) — 옵션은 GET /api/synapse/agents/catalog docTypes 사용 (key/value)
// ----------------------------------------------------------------------

/** 재청킹 요청 */
export type ReChunkRequest = {
  /** 청킹 전략 키. catalog docTypes의 key와 동일 (예: REGULATION, GENERAL) */
  strategy: string;
  /** 청크 크기 (GENERAL 등 특정 전략에서 사용) */
  chunkSize?: number;
  /** 청크 오버랩 (GENERAL 등 특정 전략에서 사용) */
  chunkOverlap?: number;
};

/** 재청킹 응답 */
export type ReChunkResponse = {
  docId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  message?: string;
  chunkCount?: number;
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

/** RAG 문서 등록 (URL/S3 전용): JSON body, POST .../register */
export const registerRagDocument = async (
  body: RegisterRagDocumentRequest
): Promise<ApiResponse<RagDocumentDetailDto>> => {
  const res = await axiosInstance.post<ApiResponse<RagDocumentDetailDto>>(
    '/api/synapse/rag/documents/register',
    body
  );
  return res.data;
};

/** RAG 문서 등록 (로컬 파일 업로드): multipart/form-data. form 필드: file(필수), title, docType. metadata part 미사용 */
export const registerRagDocumentMultipart = async (
  formData: FormData
): Promise<ApiResponse<RagDocumentDetailDto>> => {
  const res = await axiosInstance.postFormData<ApiResponse<RagDocumentDetailDto>>(
    '/api/synapse/rag/documents',
    formData
  );
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

/** Hybrid RAG Search (POST /api/synapse/rag/search) */
export const searchRagHybrid = async (
  body: HybridRagSearchRequest
): Promise<ApiResponse<HybridRagSearchResponse>> => {
  const res = await axiosInstance.post<ApiResponse<HybridRagSearchResponse>>(
    '/api/synapse/rag/search',
    body
  );
  return res.data;
};

/** RAG 문서 재청킹 (청킹 전략 변경 후 재벡터화) */
export const reChunkRagDocument = async (
  docId: string,
  body: ReChunkRequest
): Promise<ApiResponse<ReChunkResponse>> => {
  const res = await axiosInstance.post<ApiResponse<ReChunkResponse>>(
    `/api/synapse/rag/documents/${encodeURIComponent(docId)}/rechunk`,
    body
  );
  return res.data;
};

/** RAG 문서 청킹 상태 조회 */
export const getRagDocumentChunkingStatus = async (
  docId: string
): Promise<ApiResponse<{ status: string; chunkCount?: number; strategy?: string }>> => {
  const res = await axiosInstance.get<ApiResponse<{ status: string; chunkCount?: number; strategy?: string }>>(
    `/api/synapse/rag/documents/${encodeURIComponent(docId)}/chunking-status`
  );
  return res.data;
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
