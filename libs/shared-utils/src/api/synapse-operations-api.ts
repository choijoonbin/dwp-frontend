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
  /** 조회 기간 단축 (1h/6h/24h/7d/30d/90d) — dateFrom/dateTo 계산용 */
  range?: string;
  /** 조회 기간 (시작/종료) — from/to와 동일 */
  dateFrom?: string;
  dateTo?: string;
  /** 케이스 검출 시각(detected_at) 기준 필터 */
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

export type MyVouchersListParams = {
  statusFilter?: 'ALL' | 'PENDING_EXPLANATION';
  page?: number;
  size?: number;
  sort?: 'postingDate,desc' | 'postingDate,asc';
};

export type MyVoucherRowDto = {
  bukrs?: string;
  belnr?: string;
  gjahr?: string;
  postingDate?: string;
  wrbtr?: number;
  waers?: string;
  bktxt?: string;
  caseId?: string;
  caseStatus?: string;
  score?: number;
  detectedAt?: string;
  [key: string]: unknown;
};

export type MyVouchersListResponse = {
  content?: MyVoucherRowDto[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  hasNext?: boolean;
  sort?: string;
  [key: string]: unknown;
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
  /** 위반/이상 행 buzei 목록 — JSON 문자열 또는 객체 (evidenceMapJson) */
  evidenceMapJson?: string | Record<string, unknown>;
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

/** BE GET /api/synapse/cases/{id} — Single Source of Truth: fiDocItems, actionHistory, aiThoughts 일괄 반환 */
/** 조치 이력 항목 (BE: CaseActionHistoryItemRefDto) — JSON 키 camelCase */
export type CaseActionHistoryItemDto = {
  id?: number | string;
  caseId?: string;
  actionType?: string;
  actorId?: string;
  commentText?: string | null;
  /** BE JSON: actionAt (camelCase), ISO8601 Instant */
  actionAt?: string;
  createdAt?: string;
  metadataJson?: string;
};

/** AI 추론 항목 (BE: AiThoughtItemDto, agent_activity_log) — JSON 키 camelCase */
export type AiThoughtDto = {
  id?: string;
  /** BE: stage (예: THOUGHT) */
  stage?: string;
  /** BE: eventType (예: RAG_SEARCH) */
  eventType?: string;
  /** BE: message (본문) */
  message?: string;
  /** BE JSON: occurredAt (camelCase), ISO8601 Instant */
  occurredAt?: string;
  /** 레거시/폴백 */
  step?: number;
  type?: string;
  content?: string;
  confidence?: number;
  timestamp?: string;
};

/** evidenceMapJson 구조 예: { buzei: string[] } | { lineItems: { buzei: string }[] } | { highlightedBuzei: string[] } */
export type CaseDetailEvidenceMapJson = Record<string, unknown>;

/** [검토 로직] BE logicCheckpoints — 규정 조항·준수 여부 */
export type CaseDetailLogicCheckpoint = {
  clause?: string;
  status?: string;
  description?: string;
};

export type CaseDetailRegulationCheckpoint = {
  ruleId?: string;
  rule_id?: string;
  version?: string;
  chapter?: string;
  article?: string;
  clause?: string;
  title?: string;
  status?: string;
  statusReason?: string;
  status_reason?: string;
  description?: string;
  evidenceRefs?: string[];
  evidence_refs?: string[];
  qualitySignals?: string[];
  quality_signals?: string[];
  applied?: boolean;
  priority?: number;
  [key: string]: unknown;
};

/** [증거 맵] BE evidenceLinks — 그리드 행(itemIdx)과 연결된 증거 카드 */
export type CaseDetailEvidenceLink = {
  itemIdx?: number;
  reason?: string;
  severity?: string;
};

/** [분석 리포트] BE finalReport */
export type CaseDetailFinalReport = {
  summary?: string;
  verdict?: string;
  requestClarificationEnabled?: boolean;
  closeCaseEnabled?: boolean;
};

export type CaseDetailDto = {
  caseId: string;
  status: string;
  severity?: string;
  caseType?: string;
  detectedAt?: string;
  keys?: Record<string, unknown>;
  links?: Record<string, unknown>;
  /** @deprecated 우측 4탭은 reasoningProcess, logicCheckpoints, evidenceLinks, finalReport 사용 */
  evidenceMapJson?: string | CaseDetailEvidenceMapJson;
  evidence_map_json?: string | CaseDetailEvidenceMapJson;
  /** [사고 과정] 정제된 추론 문장 배열 */
  reasoningProcess?: string[];
  reasoning_process?: string[];
  /** [검토 로직] 규정 준수 여부 리스트 */
  logicCheckpoints?: CaseDetailLogicCheckpoint[];
  logic_checkpoints?: CaseDetailLogicCheckpoint[];
  /** [판단 규정] regulation checkpoint 리스트 (있으면 UI 우선 사용) */
  regulationCheckpoints?: CaseDetailRegulationCheckpoint[];
  regulation_checkpoints?: CaseDetailRegulationCheckpoint[];
  /** [증거 맵] 그리드 행(itemIdx) 연동 증거 카드 */
  evidenceLinks?: CaseDetailEvidenceLink[];
  evidence_links?: CaseDetailEvidenceLink[];
  /** [분석 리포트] 최종 판정·소명 요청/케이스 종료 플래그 */
  finalReport?: CaseDetailFinalReport;
  final_report?: CaseDetailFinalReport;
  /** BE: 전표 라인 (fi_doc_item) — buzei, hkont, wrbtr(BigDecimal→숫자), sgtxt. snake_case 또는 camelCase */
  fi_doc_items?: Array<Record<string, unknown>>;
  fiDocItems?: Array<Record<string, unknown>>;
  /** BE: 조치 이력 (CaseActionHistoryItemRefDto[], 최근 50건) */
  actionHistory?: CaseActionHistoryItemDto[];
  /** BE: AI 추론 (AiThoughtItemDto[], agent_activity_log, 최근 50건) */
  aiThoughts?: AiThoughtDto[];
  /** BE: 소명 이력 */
  explanationHistory?: Array<{
    explanationId?: string | number;
    userId?: string | number;
    explanationText?: string;
    evidenceAttachmentId?: string;
    createdAt?: string;
    [key: string]: unknown;
  }>;
  /** Aura 브리핑 인사이트 — [사고 과정] 탭 상단 '에이전트 총평' 섹션용 */
  briefingInsight?: string;
  briefing_insight?: string;
  evidence?: CaseDetailEvidence;
  reasoning?: CaseDetailReasoning;
  action?: CaseDetailAction;
  [key: string]: unknown;
};

export type SubmitCaseExplanationBody = {
  explanation: string;
  evidenceAttachmentId?: string;
};

export type SubmitCaseExplanationResponse = {
  caseId?: string;
  status?: string;
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
  /** 1h, 6h, 24h, 7d, 30d, 90d — 기간 단축 */
  range?: string;
  /** 조회 시작 시각 (ISO 8601) */
  from?: string;
  /** 조회 종료 시각 (ISO 8601) */
  to?: string;
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

export const getMyVouchers = async (
  params?: MyVouchersListParams
): Promise<ApiResponse<MyVouchersListResponse>> => {
  const query = new URLSearchParams();
  query.set('statusFilter', params?.statusFilter ?? 'ALL');
  query.set('page', String(params?.page ?? 0));
  query.set('size', String(params?.size ?? 20));
  query.set('sort', params?.sort ?? 'postingDate,desc');

  const res = await axiosInstance.get<ApiResponse<MyVouchersListResponse>>(
    `/api/synapse/vouchers/my?${query.toString()}`
  );
  return res.data;
};

export const getCaseDetail = async (
  caseId: string
): Promise<ApiResponse<CaseDetailDto>> => {
  const candidatePaths = [
    `/api/synapse/cases/${encodeURIComponent(caseId)}`,
  ] as const;

  for (const path of candidatePaths) {
    try {
      const res = await axiosInstance.get<ApiResponse<CaseDetailDto>>(path);
      return res.data;
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status !== 404) throw error;
    }
  }

  throw new Error('Failed to fetch case detail');
};

/**
 * 소명 제출 (일반 사용자)
 * 우선 케이스 단위 endpoint를 시도하고, 404인 경우 레거시 snake_case endpoint로 fallback.
 */
export const submitCaseExplanation = async (
  caseId: string,
  body: SubmitCaseExplanationBody
): Promise<ApiResponse<SubmitCaseExplanationResponse>> => {
  const payload = {
    explanationText: body.explanation,
    evidenceAttachmentId: body.evidenceAttachmentId,
    explanation: body.explanation,
    explanation_text: body.explanation,
    content: body.explanation,
    evidence_attachment_id: body.evidenceAttachmentId,
  };

  const candidatePaths = [
    `/api/synapse/cases/${encodeURIComponent(caseId)}/explanations`,
    `/aura/cases/${encodeURIComponent(caseId)}/explanations`,
    `/api/synapse/cases/${encodeURIComponent(caseId)}/case-explanation`,
    `/api/synapse/cases/${encodeURIComponent(caseId)}/explanation`,
  ] as const;

  for (const path of candidatePaths) {
    try {
      const res = await axiosInstance.post<ApiResponse<SubmitCaseExplanationResponse>>(path, payload);
      return res.data;
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status !== 404) throw error;
    }
  }

  const res = await axiosInstance.post<ApiResponse<SubmitCaseExplanationResponse>>(
    '/api/synapse/case_explanation',
    { caseId, ...payload }
  );
  return res.data;
};

/**
 * 관리자(감사자) 소명 요청
 * PATCH /api/synapse/cases/{caseId}/request-explanation
 */
export const requestCaseExplanation = async (
  caseId: string
): Promise<ApiResponse<CaseDetailDto>> => {
  const res = await axiosInstance.patch<ApiResponse<CaseDetailDto>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/request-explanation`,
    {}
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Case Detail Tabs API (P1)
// @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
// ----------------------------------------------------------------------

export type CaseAnalysisEvidenceDto = {
  key?: string;
  [key: string]: unknown;
};

/** Phase3: RAG reference in analysis result */
export type CaseAnalysisRagRefDto = {
  refId?: string;
  sourceType?: string;
  sourceKey?: string;
  excerpt?: string;
  score?: number;
  [key: string]: unknown;
};

export type CaseAnalysisDto = {
  runId?: string;
  score?: number;
  reasonText?: string;
  keyFactors?: Array<{ label?: string; type?: string; description?: string }>;
  anomalyType?: string;
  severity?: string;
  /** 문장별 근거 연결 맵 (Aura) */
  sentenceCitationMap?: Array<{
    sentence_index?: number;
    sentence?: string;
    citation_ids?: string[];
    chunk_id?: string;
    target_buzei?: string | number;
    grounded?: boolean;
    [key: string]: unknown;
  }>;
  sentence_citation_map?: Array<{
    sentence_index?: number;
    sentence?: string;
    citation_ids?: string[];
    chunk_id?: string;
    target_buzei?: string | number;
    grounded?: boolean;
    [key: string]: unknown;
  }>;
  /** 품질 게이트 코드 */
  qualityGateCodes?: string[];
  quality_gate_codes?: string[];
  /** 사용자 노출용 분석 신뢰 신호 (있으면 UI 우선 사용) */
  analysisQualitySignals?: string[];
  analysis_quality_signals?: string[];
  /** 분석 점수 분해(디버그) */
  analysisScoreBreakdown?: Record<string, unknown>;
  analysis_score_breakdown?: Record<string, unknown>;
  /** 근거 인용 목록 */
  citations?: Array<{
    citation_id?: string;
    chunk_id?: string;
    target_buzei?: string | number;
    sourceKey?: string;
    source_key?: string;
    excerpt?: string;
    title?: string;
    [key: string]: unknown;
  }>;
  /** 문장별 근거 존재 여부(서버 계산) */
  grounded?: boolean;
  /** 최종 판단 사유 블록(일부 BE는 하위로 제공) */
  decisionReason?: Record<string, unknown>;
  decision_reason?: Record<string, unknown>;
  /** Phase2: evidence items { key: string } */
  evidence?: CaseAnalysisEvidenceDto[];
  /** Phase3: RAG citations (policy/regulation refs) */
  ragRefs?: CaseAnalysisRagRefDto[];
  /** Phase2: confidence breakdown */
  confidenceBreakdown?: { overall?: number; [key: string]: unknown };
  [key: string]: unknown;
};

export type CaseConfidenceFactorDto = {
  id?: string;
  label?: string;
  i18nKey?: string;
  score?: number;
  weight?: number;
  icon?: string;
  description?: string;
  [key: string]: unknown;
};

export type CaseConfidenceDto = {
  overallScore?: number;
  factors?: CaseConfidenceFactorDto[];
  [key: string]: unknown;
};

export type CaseSimilarDto = {
  id?: string;
  caseId?: string;
  caseNumber?: string;
  title?: string;
  similarity?: number;
  status?: string;
  severity?: string;
  counterparty?: string;
  currency?: string;
  amount?: number;
  [key: string]: unknown;
};

export type CaseSimilarResponseDto = {
  items?: CaseSimilarDto[];
  cases?: CaseSimilarDto[];
  [key: string]: unknown;
};

export type RagEvidenceItemDto = {
  id?: string;
  sourceId?: string;
  title?: string;
  excerpt?: string;
  score?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CaseRagEvidenceDto = {
  items?: RagEvidenceItemDto[];
  citations?: RagEvidenceItemDto[];
  [key: string]: unknown;
};

export const getCaseAnalysis = async (
  caseId: string,
  params?: { runId?: string }
): Promise<ApiResponse<CaseAnalysisDto>> => {
  const search = params?.runId ? `?runId=${encodeURIComponent(params.runId)}` : '';
  const res = await axiosInstance.get<ApiResponse<CaseAnalysisDto>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/analysis${search}`
  );
  return res.data;
};

export const getCaseConfidence = async (
  caseId: string
): Promise<ApiResponse<CaseConfidenceDto>> => {
  const res = await axiosInstance.get<ApiResponse<CaseConfidenceDto>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/confidence`
  );
  return res.data;
};

export const getCaseSimilar = async (
  caseId: string
): Promise<ApiResponse<CaseSimilarResponseDto>> => {
  const res = await axiosInstance.get<ApiResponse<CaseSimilarResponseDto>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/similar`
  );
  return res.data;
};

export const getCaseRagEvidence = async (
  caseId: string
): Promise<ApiResponse<CaseRagEvidenceDto>> => {
  const res = await axiosInstance.get<ApiResponse<CaseRagEvidenceDto>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/rag/evidence`
  );
  return res.data;
};

export const updateCaseStatus = async (
  caseId: string,
  status: 'OPEN' | 'TRIAGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'
): Promise<ApiResponse<CaseDetailDto>> => {
  const res = await axiosInstance.post<ApiResponse<CaseDetailDto>>(
    `/api/synapse/cases/${encodeURIComponent(caseId)}/status`,
    { status }
  );
  return res.data;
};

/**
 * GET /api/synapse/cases/{caseId}/audit-events — 케이스 단위 감사 로그 (감사 스트림 탭용)
 * @see back.txt — BE Phase A 케이스 단위 감사 API
 */
export type CaseAuditEventsParams = {
  page?: number;
  size?: number;
};

/** BE case_action_history / audit-events 응답 — actor 표시는 actorDisplayName | actorName | actor_id 순으로 fallback */
export type CaseAuditEventDto = {
  auditId: string;
  createdAt: string;
  eventCategory?: string;
  eventType?: string;
  outcome?: string;
  severity?: string;
  actorType?: string;
  /** 조치자 표시명 (BE 권장) */
  actorDisplayName?: string;
  /** BE가 actorName으로 내려주는 경우 */
  actorName?: string;
  /** BE가 actor_id만 내려주는 경우 — UI에서 그대로 표시 또는 해석 */
  actor_id?: string;
  resourceType?: string;
  resourceId?: string;
  [key: string]: unknown;
};

export type CaseAuditEventsResponse = {
  items: CaseAuditEventDto[];
  total: number;
  pageInfo?: { page: number; size: number; totalPages: number; total: number };
};

export const getCaseAuditEvents = async (
  caseId: string,
  params?: CaseAuditEventsParams
): Promise<ApiResponse<CaseAuditEventsResponse>> => {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.size !== undefined) query.set('size', String(params.size));
  const qs = query.toString();
  const url = `/api/synapse/cases/${encodeURIComponent(caseId)}/audit-events${qs ? `?${qs}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<CaseAuditEventsResponse>>(url);
  return res.data;
};

/**
 * GET /api/synapse/workbench/cases/{caseId}/history — 워크벤치 조치 이력 (back.txt B.3)
 * action_at DESC, ApiResponse<List<CaseActionHistoryItemDto>>
 */
export type CaseActionHistoryResponse = CaseActionHistoryItemDto[];

export const getWorkbenchCaseHistory = async (
  caseId: string
): Promise<ApiResponse<CaseActionHistoryResponse>> => {
  const res = await axiosInstance.get<ApiResponse<CaseActionHistoryResponse>>(
    `/api/synapse/workbench/cases/${encodeURIComponent(caseId)}/history`
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

/**
 * GET /api/synapse/actions/{actionId} — 조치 상세 조회
 */
export const getActionDetail = async (
  actionId: string
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.get<ApiResponse<ActionRowDto>>(
    `/api/synapse/actions/${encodeURIComponent(actionId)}`
  );
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

/**
 * GET /api/synapse/actions/hitl/{requestId} — HITL 요청 상세 조회 (Aura 직접 호출 제거, BE 단일 소스)
 */
export const getHitlRequestDetail = async (
  requestId: string
): Promise<ApiResponse<unknown>> => {
  const res = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/synapse/actions/hitl/${encodeURIComponent(requestId)}`
  );
  return res.data;
};

/** HITL 승인 — 백엔드 경유 (case_action_history 기록). comment(승인 사유) 필수 전달 권장 */
export const approveHitlAction = async (
  requestId: string,
  body?: { comment?: string }
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionRowDto>>(
    `/api/synapse/actions/hitl/${encodeURIComponent(requestId)}/approve`,
    body ?? {}
  );
  return res.data;
};

/** HITL 거절 — 백엔드 경유 (case_action_history 기록). comment(거절 사유) 포함 */
export const rejectHitlAction = async (
  requestId: string,
  body?: { comment?: string }
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionRowDto>>(
    `/api/synapse/actions/hitl/${encodeURIComponent(requestId)}/reject`,
    body ?? {}
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

/**
 * POST /api/synapse/actions/{actionId}/resume — HITL 재개 (승인 후 실행)
 */
export const resumeAction = async (
  actionId: string
): Promise<ApiResponse<ActionRowDto>> => {
  const res = await axiosInstance.post<ApiResponse<ActionRowDto>>(
    `/api/synapse/actions/${encodeURIComponent(actionId)}/resume`,
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
