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
  updatedAt?: string;
  updated_at?: string;
  version?: string;
  effectiveFrom?: string;
  effective_from?: string;
  effectiveTo?: string;
  effective_to?: string;
  isActive?: boolean;
  is_active?: boolean;
  qualityGatePassed?: boolean;
  quality_gate_passed?: boolean;
  qualityReport?: RagQualityReport;
  quality_report?: RagQualityReport;
  refCount?: number;
  ref_count?: number;
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
  updatedAt?: string;
  updated_at?: string;
  timestamp?: string;
  version?: string;
  effectiveFrom?: string;
  effective_from?: string;
  effectiveTo?: string;
  effective_to?: string;
  isActive?: boolean;
  is_active?: boolean;
  /** 청킹 전략 키 (catalog docTypes와 동일). 없으면 sourceType 등으로 대체 */
  chunkingStrategy?: string;
  chunks?: RagChunkDto[];
  qualityReport?: RagQualityReport;
  quality_report?: RagQualityReport;
  qualityGatePassed?: boolean;
  quality_gate_passed?: boolean;
};

export type RagQualityReport = {
  pass?: boolean;
  runId?: string;
  run_id?: string;
  articleCoverage?: number;
  article_coverage?: number;
  noiseRate?: number;
  noise_rate?: number;
  duplicateRate?: number;
  duplicate_rate?: number;
  shortChunkRate?: number;
  short_chunk_rate?: number;
  inputChunks?: number;
  input_chunks?: number;
  finalChunks?: number;
  final_chunks?: number;
  errors?: string[];
  missingRequired?: string[];
  missing_required?: string[];
  [key: string]: unknown;
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
  qualityReport?: RagQualityReport;
  quality_report?: RagQualityReport;
};

export type RagDocumentsListParams = {
  status?: string;
  page?: number;
  size?: number;
};

export type RagQualityMetricsDto = {
  from?: string;
  to?: string;
  totalCount?: number;
  sentenceCitationMissingCount?: number;
  evidenceCoverageLowCount?: number;
  policyReevalAppliedCount?: number;
  ragZeroCount?: number;
  sentenceCitationMissingRatio?: number;
  evidenceCoverageLowRatio?: number;
  policyReevalAppliedRatio?: number;
  ragZeroRatio?: number;
  chunkPassRate?: number;
  chunk_pass_rate?: number;
  ragZeroRate?: number;
  rag_0_rate?: number;
  ragZeroCountRate?: number;
  defaultInflowRate?: number;
  default_inflow_rate?: number;
  citationErrorRate?: number;
  citation_error_rate?: number;
  [key: string]: unknown;
};

export type AuraQualityMetricsParams = {
  from?: string;
  to?: string;
};

export type RagSearchParams = {
  q: string;
  page?: number;
  size?: number;
};

export type RagEvalRunResultJson = {
  total_cases?: number;
  zero_results?: number;
  zero_rate?: number;
  hit_at_k?: number;
  strict_hit_top1?: number;
  [key: string]: unknown;
};

export type RagEvalRunDto = {
  id: number;
  tenantId: number;
  runKey: string;
  zeroRate: number;
  hitAtK: number;
  strictHitTop1?: number;
  totalCases?: number;
  gatePassed: boolean;
  resultJson?: RagEvalRunResultJson;
  createdAt: string;
};

export type RagEvalRunCreateRequest = {
  runKey: string;
  zeroRate: number;
  hitAtK: number;
  strictHitTop1?: number;
  totalCases?: number;
  gatePassed: boolean;
  resultJson?: RagEvalRunResultJson;
};

export type RagActivateVersionResponse = {
  docId?: string;
  version?: string;
  lifecycleStatus?: string;
  lifecycle_status?: string;
  status?: string;
  [key: string]: unknown;
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

/** BE 응답: items + total + pageInfo { page, size, hasNext } + sort, order, filtersApplied, summary */
type PageInfoResponse<T> = {
  items: T[];
  total: number;
  pageInfo?: { page?: number; size?: number; hasNext?: boolean };
  sort?: string;
  order?: string;
  filtersApplied?: unknown;
  summary?: unknown;
};

function toPageResponse<T>(
  spring: SpringPage<T> | PageResponse<T> | PageInfoResponse<T>
): PageResponse<T> {
  if ('items' in spring && Array.isArray(spring.items)) {
    const raw = spring as PageInfoResponse<T> | PageResponse<T>;
    const total = (raw as { total?: number }).total ?? raw.items.length;

    // 신규 형식: pageInfo { page, size, hasNext }
    const pi = (raw as PageInfoResponse<T>).pageInfo;
    if (pi != null) {
      const page = pi.page ?? 1;
      const size = pi.size ?? 20;
      return {
        items: raw.items,
        total,
        page: Math.max(0, page - 1),
        size,
        totalPages: Math.ceil(total / size) || 1,
      };
    }

    // 기존 PageResponse (page, size, totalPages 이미 있음)
    const pr = raw as PageResponse<T>;
    if (
      typeof pr.page === 'number' &&
      typeof pr.size === 'number' &&
      typeof pr.totalPages === 'number'
    ) {
      return pr;
    }

    // items/total만 있는 경우 (pageInfo 없음)
    const size = 20;
    return {
      items: raw.items,
      total,
      page: 0,
      size,
      totalPages: Math.ceil(total / size) || 1,
    };
  }
  // Spring Page (content, totalElements, number, size)
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
  const res = await axiosInstance.get<
    ApiResponse<SpringPage<RagDocumentListDto> | PageResponse<RagDocumentListDto> | PageInfoResponse<RagDocumentListDto>>
  >(url);
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

export const createRagEvalRun = async (
  body: RagEvalRunCreateRequest
): Promise<ApiResponse<RagEvalRunDto>> => {
  const res = await axiosInstance.post<ApiResponse<RagEvalRunDto>>('/api/synapse/rag/eval-runs', body);
  return res.data;
};

export const getLatestRagEvalRun = async (): Promise<ApiResponse<RagEvalRunDto | null>> => {
  const res = await axiosInstance.get<ApiResponse<RagEvalRunDto | null>>('/api/synapse/rag/eval-runs/latest');
  return res.data;
};

export const activateRagDocumentVersion = async (
  docId: string,
  version: string
): Promise<ApiResponse<RagActivateVersionResponse>> => {
  const query = new URLSearchParams();
  query.set('version', version);
  const res = await axiosInstance.post<ApiResponse<RagActivateVersionResponse>>(
    `/api/synapse/rag/documents/${encodeURIComponent(docId)}/versions/activate?${query.toString()}`,
    {}
  );
  return res.data;
};

export const replaceRagDocumentChunks = async (
  docId: string,
  body: Record<string, unknown>
): Promise<ApiResponse<Record<string, unknown>>> => {
  const res = await axiosInstance.post<ApiResponse<Record<string, unknown>>>(
    `/api/synapse/rag/documents/${encodeURIComponent(docId)}/chunks/replace`,
    body
  );
  return res.data;
};

export const getAuraQualityMetrics = async (
  params?: AuraQualityMetricsParams
): Promise<ApiResponse<RagQualityMetricsDto>> => {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const url = `/api/synapse/aura/quality-metrics${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<RagQualityMetricsDto>>(url);
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
