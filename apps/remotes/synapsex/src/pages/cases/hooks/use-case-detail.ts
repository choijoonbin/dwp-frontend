/**
 * Case detail hook — API 전용 (mock 제거)
 */

import { useMemo } from 'react';
import {
  useCaseDetailQuery,
  type CaseDetailAction,
  type CaseDetailEvidence,
  type CaseDetailReasoning,
} from '@dwp-frontend/shared-utils';

import { caseDetailDtoToUi, type CaseDetailUi } from '../adapters/case-detail-adapter';

/** BE fi_doc_items / DocumentLineItemDto → FiDocItem (필드명 snake_case/camelCase 모두 수용) */
function toNumberOrUndefined(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function extractPartner(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' || typeof value === 'number') return toStringOrUndefined(value);
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return (
      toStringOrUndefined(v.name) ??
      toStringOrUndefined(v.displayName) ??
      toStringOrUndefined(v.partnerName) ??
      toStringOrUndefined(v.vendorName) ??
      toStringOrUndefined(v.customerName) ??
      toStringOrUndefined(v.id) ??
      toStringOrUndefined(v.code)
    );
  }
  return undefined;
}

function normalizeBuzeiCandidate(value: unknown): string | undefined {
  const raw = toStringOrUndefined(value);
  if (!raw) return undefined;
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return undefined;
  // SAP BUZEI is typically 1-3 digits.
  if (digitsOnly.length > 3) return undefined;
  return digitsOnly.padStart(3, '0');
}

function looksLikeGlAccount(value: unknown): boolean {
  const raw = toStringOrUndefined(value);
  if (!raw) return false;
  const digitsOnly = raw.replace(/\D/g, '');
  // Typical G/L account length heuristic.
  return digitsOnly.length >= 4;
}

function mapRawLineItemToFiDoc(
  r: Record<string, unknown>,
  idx: number,
  itemsCurrency: string
): FiDocItem {
  const buzeiRaw = r.buzei ?? r.line_item_no ?? r.lineItemNo ?? r.line_no ?? r.lineNo ?? r.itemNo;
  const buzeiStr = normalizeBuzeiCandidate(buzeiRaw) ?? String(idx + 1).padStart(3, '0');
  const inferredAccountFromBuzei = looksLikeGlAccount(buzeiRaw) ? toStringOrUndefined(buzeiRaw) : undefined;
  const hkont = toStringOrUndefined(
    r.hkont ?? r.gl_account ?? r.glAccount ?? r.account ?? r.accountNo ?? r.account_code ?? r.saknr ?? inferredAccountFromBuzei
  );
  const wrbtr = toNumberOrUndefined(
    r.wrbtr ?? r.amount_in_doc_currency ?? r.amountInDocCurrency ?? r.amount ?? r.docAmount
  );
  const dmbtr = toNumberOrUndefined(r.dmbtr ?? r.amount_in_local ?? r.amountInLocal ?? r.localAmount);
  const sgtxt = toStringOrUndefined(
    r.sgtxt ?? r.item_text ?? r.itemText ?? r.description ?? r.itemDescription ?? r.text
  );
  const partner =
    extractPartner(r.partner) ??
    toStringOrUndefined(
      r.lifnr ??
        r.kunnr ??
        r.partner_id ??
        r.partnerId ??
        r.counterpartyId ??
        r.counterparty ??
        r.vendorName ??
        r.customerName
    );
  const waers = toStringOrUndefined(r.waers ?? r.currency ?? r.doc_currency ?? r.docCurrency);
  const isTarget = Boolean(r.isTarget ?? r.is_target);
  return {
    id: String(r.id ?? buzeiRaw ?? idx),
    buzei: buzeiStr,
    partner: partner ?? undefined,
    hkont,
    wrbtr,
    dmbtr,
    waers: waers ?? itemsCurrency,
    dueDate: (r.dueDate ?? r.zfbdt ?? r.due_date) as string | undefined,
    paymentBlock: Boolean(r.paymentBlock ?? r.payment_block),
    disputeFlag: Boolean(r.disputeFlag ?? r.dispute_flag),
    isTarget,
    shkzg: (r.shkzg ?? r.debit_credit) as string | undefined,
    bschl: (r.bschl ?? r.posting_key) as string | undefined,
    mwskz: r.mwskz as string | undefined,
    kostl: r.kostl as string | undefined,
    prctr: r.prctr as string | undefined,
    aufnr: r.aufnr as string | undefined,
    zterm: r.zterm as string | undefined,
    zfbdt: r.zfbdt as string | undefined,
    zuonr: r.zuonr as string | undefined,
    sgtxt,
  };
}

/** 라인 항목 UI 모델 — evidence.documentOrOpenItem.items[] 또는 evidence.fi_doc_items[] (BE 규격) 기반 */
export type FiDocItem = {
  id: string;
  /** 라인 번호 (buzei) */
  buzei?: string;
  /** 거래처: lifnr(매입) 또는 kunnr(매출) */
  partner?: string;
  /** 손익계정 */
  hkont?: string;
  /** 금액 (transaction currency) */
  wrbtr?: number;
  /** 금액 (document currency, BE dmbtr) */
  dmbtr?: number;
  /** 통화 (전표 레벨 fallback 가능) */
  waers?: string;
  /** 만기일 */
  dueDate?: string;
  /** 결제 차단 플래그 */
  paymentBlock?: boolean;
  /** 분쟁 플래그 */
  disputeFlag?: boolean;
  /** 케이스 buzei와 일치 시 true (BE DocumentLineItemDto.isTarget) */
  isTarget?: boolean;
  /** 차대 구분 (S/H) */
  shkzg?: string;
  /** 전기 유형 */
  bschl?: string;
  /** 세금 코드 */
  mwskz?: string;
  /** 손익센터 */
  kostl?: string;
  /** profit center */
  prctr?: string;
  /** 주문 번호 */
  aufnr?: string;
  /** 결제 조건 */
  zterm?: string;
  /** 기준일 */
  zfbdt?: string;
  /** 배정 번호 */
  zuonr?: string;
  /** 항목 텍스트 */
  sgtxt?: string;
};

export type RelatedAction = {
  id: string;
  actionType: string;
  description?: string;
  status: string;
  riskLevel?: string;
  targetSystem?: string;
};

export type AuditEvent = {
  actor?: string;
  description?: string;
  timestamp?: string;
};

/** 조치 이력 UI 모델 (WorkbenchActionHistoryTimeline) */
export type ActionHistoryItem = {
  id: string;
  actorName: string;
  actionAt: string;
  comment?: string;
};

/**
 * Aura가 뱉는 단계 명칭(eventType/stage) → 타임라인 표시용 canonical type
 * BE AiThoughtDto: eventType (예: RAG_SEARCH), stage (예: THOUGHT) — 대소문자 무관 매칭
 */
const AURA_STAGE_TO_CANONICAL: Record<string, string> = {
  hypothesis: 'hypothesis',
  Hypothesis: 'hypothesis',
  HYPOTHESIS: 'hypothesis',
  investigation: 'investigation',
  Investigation: 'investigation',
  INVESTIGATION: 'investigation',
  rag_search: 'investigation',
  RAG_SEARCH: 'investigation',
  analysis: 'analysis',
  Analysis: 'analysis',
  ANALYSIS: 'analysis',
  scoring: 'analysis',
  SCORING: 'analysis',
  conclusion: 'conclusion',
  Conclusion: 'conclusion',
  CONCLUSION: 'conclusion',
  thought: 'reasoning',
  THOUGHT: 'reasoning',
  reasoning: 'reasoning',
  Reasoning: 'reasoning',
  REASONING: 'reasoning',
  planning: 'planning',
  Planning: 'planning',
  PLANNING: 'planning',
  execution: 'execution',
  Execution: 'execution',
  EXECUTION: 'execution',
  verification: 'verification',
  Verification: 'verification',
  VERIFICATION: 'verification',
};

/** Aura eventType/stage → canonical type (타임라인 아이콘·i18n 키와 일치) */
function toCanonicalThoughtType(raw: string | undefined): string {
  if (!raw || !raw.trim()) return 'reasoning';
  const trimmed = raw.trim();
  return AURA_STAGE_TO_CANONICAL[trimmed] ?? AURA_STAGE_TO_CANONICAL[trimmed.toLowerCase()] ?? trimmed;
}

function normalizeRegulationStatus(
  raw: unknown
): 'COMPLIANT' | 'VIOLATION' | 'HOLD' | 'CONFLICT' | 'NEEDS_REVIEW' {
  const normalized = String(raw ?? '').trim().toUpperCase();
  if (normalized === 'VIOLATION' || normalized === 'VIOLATED' || normalized === '위반') return 'VIOLATION';
  if (normalized === 'COMPLETED') return 'COMPLIANT';
  if (normalized === 'HOLD') return 'HOLD';
  if (normalized === 'CONFLICT') return 'CONFLICT';
  if (normalized === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
  return 'COMPLIANT';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0);
}

/** buzei 값을 3자리 문자열로 통일 */
function normalizeBuzei(v: string | number | undefined): string {
  if (v == null) return '';
  return String(v).trim().padStart(3, '0');
}

/** [판단 규정] UI — regulationCheckpoints 또는 logicCheckpoints fallback */
export type LogicCheckpointItem = {
  clause: string;
  status: 'compliant' | 'violation';
  ruleId?: string;
  description?: string;
  statusCode?: 'COMPLIANT' | 'VIOLATION' | 'HOLD' | 'CONFLICT' | 'NEEDS_REVIEW';
  version?: string;
  chapter?: string;
  article?: string;
  title?: string;
  statusReason?: string;
  applied?: boolean;
  evidenceRefs?: string[];
  qualitySignals?: string[];
  priority?: number;
  source?: 'regulation' | 'logic';
};

/** [증거 맵] UI — itemIdx는 그리드 행 인덱스(0-based), reason, severity */
export type EvidenceLinkItem = {
  itemIdx: number;
  reason?: string;
  severity?: string;
};

/** [분석 리포트] UI */
export type FinalReportItem = {
  summary?: string;
  verdict?: string;
  requestClarificationEnabled?: boolean;
  closeCaseEnabled?: boolean;
};

/** AI 추론 과정 UI 모델 (WorkbenchThoughtChain) — type은 canonical (hypothesis, investigation 등) */
export type AiThought = {
  id: string;
  step: number;
  /** Aura eventType/stage와 매핑된 canonical 단계 (Hypothesis, Investigation 등 표시용) */
  type: string;
  content: string;
  confidence?: number;
  timestamp?: string;
  /** 규정집 청크와 연동 — 클릭 시 해당 chunk scrollIntoView + 하이라이트 */
  chunkId?: string;
};

export type CaseDetailResult = {
  caseData: CaseDetailUi | null;
  evidence: CaseDetailEvidence | undefined;
  reasoning: CaseDetailReasoning | undefined;
  action: CaseDetailAction | undefined;
  fiDoc: {
    bukrs: string;
    belnr: string;
    gjahr: string;
    id: string;
    budat?: string;
    wrbtr?: number;
    waers?: string;
    counterpartyId?: string;
    /** lifnr/kunnr 또는 counterpartyId 표시용 */
    counterpartyDisplay?: string;
  } | null;
  fiDocItems: FiDocItem[];
  /** 케이스가 특정 라인을 가리킬 때 해당 buzei (isTarget 미제공 시 fallback) */
  targetBuzei?: string;
  /** evidenceLinks.itemIdx → fiDocItems[itemIdx].buzei 로 유도한 위반/이상 행 목록 (그리드 Red Glow용) */
  violationBuzeiList: string[];
  /** 규정집 근거 하이라이트용 chunkId (BE 별도 제공 시에만 사용) */
  highlightChunkIds: string[];
  /** [사고 과정] BE reasoningProcess — 정제된 추론 문장 배열 */
  reasoningProcess: string[];
  /** Aura 브리핑 인사이트 — [사고 과정] 탭 상단 '에이전트 총평' 섹션용 */
  briefingInsight?: string;
  /** [검토 로직] BE logicCheckpoints */
  logicCheckpoints: LogicCheckpointItem[];
  /** [증거 맵] BE evidenceLinks — itemIdx는 그리드 행 인덱스(0-based) */
  evidenceLinks: EvidenceLinkItem[];
  /** [분석 리포트] BE finalReport */
  finalReport: FinalReportItem | null;
  /** finalReport.summary | finalReport.verdict (하위 호환) */
  summaryVerdict?: string;
  /** logicCheckpoints.clause 배열 (하위 호환, case-detail 페이지용) */
  keyGrounds?: string[];
  /** 라인 수 (BE lineCount, "라인 항목(n)" 표시용) */
  lineCount?: number;
  /** 라인 항목 표시용 통화 (전표 레벨 fallback) */
  itemsCurrency?: string;
  /** 조치 이력 (BE: actionHistory[] 또는 agent_case_action_history[]) */
  actionHistory: ActionHistoryItem[];
  /** AI 추론 과정 (BE: aiThoughts[] 또는 reasoning.thoughts[]) */
  aiThoughts: AiThought[];
  relatedActions: RelatedAction[];
  auditEvents: AuditEvent[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
};

export const useCaseDetail = (caseId: string | undefined): CaseDetailResult => {
  const query = useCaseDetailQuery(caseId);

  return useMemo(() => {
    if (!caseId) {
      return {
        caseData: null,
        evidence: undefined,
        reasoning: undefined,
        action: undefined,
        fiDoc: null,
        fiDocItems: [],
        targetBuzei: undefined,
        violationBuzeiList: [],
        highlightChunkIds: [],
        reasoningProcess: [],
        logicCheckpoints: [],
        evidenceLinks: [],
        finalReport: null,
        summaryVerdict: undefined,
        keyGrounds: undefined,
        lineCount: undefined,
        itemsCurrency: undefined,
        actionHistory: [],
        aiThoughts: [],
        relatedActions: [],
        auditEvents: [],
        isLoading: false,
        error: null,
        refetch: () => {},
      };
    }

    const dto = query.data;
    const caseData = caseDetailDtoToUi(caseId, dto ?? null);
    const evidence = dto?.evidence as Record<string, unknown> | undefined;
    const docOrItem = evidence?.documentOrOpenItem as Record<string, unknown> | undefined;
    const header = docOrItem?.headerSummary as Record<string, unknown> | undefined;
    // BE Single Source of Truth: fiDocItems(camelCase) 또는 fi_doc_items(snake_case) 우선, 없으면 evidence 내부 items
    const rawItems = (dto?.fiDocItems ?? dto?.fi_doc_items ?? evidence?.fi_doc_items ?? docOrItem?.items) as
      | Array<Record<string, unknown>>
      | undefined;
    const items = Array.isArray(rawItems) ? rawItems : [];

    // PROMPT P0: evidence.documentOrOpenItem 바인딩 — flat 또는 headerSummary 구조 지원
    const bukrs =
      (header?.bukrs as string) ?? (docOrItem?.bukrs as string) ?? '';
    const belnr =
      (header?.belnr as string) ?? (docOrItem?.belnr as string) ?? '';
    const gjahr =
      (header?.gjahr as string) ?? (docOrItem?.gjahr as string) ?? '';
    const docKey = docOrItem?.docKey as string | undefined;
    const hasDocKey = Boolean(docKey || bukrs || belnr || gjahr);

    // 금액: amount+currency 또는 wrbtr+waers
    const amount = (docOrItem?.amount as number) ?? (docOrItem?.wrbtr as number);
    const currency = (docOrItem?.currency as string) ?? (docOrItem?.waers as string) ?? 'USD';
    const budat = (header?.budat as string) ?? (docOrItem?.budat as string);

    // 거래처: items[0].lifnr 또는 items[0].kunnr 우선, 그 다음 counterpartyId/partyId (PROMPT 3-2)
    const firstItem = items[0] as Record<string, unknown> | undefined;
    const lifnr = firstItem?.lifnr as string | undefined;
    const kunnr = firstItem?.kunnr as string | undefined;
    const counterpartyId = docOrItem?.counterpartyId as string | undefined;
    const partyId = docOrItem?.partyId;
    const counterpartyDisplay =
      lifnr ?? kunnr ?? counterpartyId ?? (partyId != null ? String(partyId) : undefined);
    const counterpartyIdForLink =
      counterpartyId ?? (partyId != null ? String(partyId) : undefined) ?? lifnr ?? kunnr;

    const fiDoc =
      hasDocKey
        ? {
            id: docKey ?? `${bukrs}-${belnr}-${gjahr}`,
            bukrs,
            belnr,
            gjahr,
            budat: budat || undefined,
            wrbtr: amount,
            waers: currency,
            counterpartyId: counterpartyIdForLink,
            counterpartyDisplay,
          }
        : null;

    const itemsCurrency = (docOrItem?.waers as string) ?? (docOrItem?.currency as string) ?? 'USD';
    const lineCount = docOrItem?.lineCount as number | undefined;
    // BE keys.buzei (back.txt) 또는 evidence 내 buzei
    const targetBuzeiRaw =
      (dto?.keys as Record<string, unknown> | undefined)?.buzei ??
      docOrItem?.buzei ??
      (header?.buzei as string | number | undefined);
    const targetBuzei =
      targetBuzeiRaw != null ? String(targetBuzeiRaw).padStart(3, '0') : undefined;

    const fiDocItems: FiDocItem[] = items.map((item, idx) =>
      mapRawLineItemToFiDoc(item as Record<string, unknown>, idx, itemsCurrency)
    );

    const rawReasoningProcess = (dto?.reasoningProcess ?? dto?.reasoning_process) as string[] | undefined;
    const reasoningProcess = Array.isArray(rawReasoningProcess) ? rawReasoningProcess.filter((s) => typeof s === 'string') : [];

    const briefingInsightRaw = (dto?.briefingInsight ?? dto?.briefing_insight) as string | undefined;
    const briefingInsight = typeof briefingInsightRaw === 'string' && briefingInsightRaw.trim().length > 0 ? briefingInsightRaw.trim() : undefined;

    const rawRegulationCheckpoints = (dto?.regulationCheckpoints ?? dto?.regulation_checkpoints) as
      | Array<Record<string, unknown>>
      | undefined;
    const regulationCheckpoints: LogicCheckpointItem[] = Array.isArray(rawRegulationCheckpoints)
      ? rawRegulationCheckpoints
          .map((item, idx) => {
            const statusCode = normalizeRegulationStatus(item.status ?? item.statusCode ?? item.status_code);
            const status: 'compliant' | 'violation' = statusCode === 'VIOLATION' ? 'violation' : 'compliant';
            const clause = String(
              item.clause ?? item.regulationClause ?? item.regulation_clause ?? item.article ?? ''
            ).trim();
            return {
              clause,
              status,
              statusCode,
              ruleId: (item.ruleId ?? item.rule_id) as string | undefined,
              description: (item.description as string | undefined) ?? undefined,
              version: (item.version as string | undefined) ?? undefined,
              chapter: (item.chapter as string | undefined) ?? undefined,
              article: (item.article as string | undefined) ?? undefined,
              title: (item.title as string | undefined) ?? undefined,
              statusReason:
                (item.statusReason as string | undefined) ??
                (item.status_reason as string | undefined) ??
                undefined,
              applied:
                typeof item.applied === 'boolean'
                  ? item.applied
                  : typeof item.isApplied === 'boolean'
                    ? (item.isApplied as boolean)
                    : typeof item.is_applied === 'boolean'
                      ? (item.is_applied as boolean)
                      : true,
              evidenceRefs: toStringArray(item.evidenceRefs ?? item.evidence_refs),
              qualitySignals: toStringArray(item.qualitySignals ?? item.quality_signals),
              priority:
                typeof item.priority === 'number' && Number.isFinite(item.priority)
                  ? (item.priority as number)
                  : undefined,
              source: 'regulation',
              _idx: idx,
            } as LogicCheckpointItem & { _idx: number };
          })
          .filter((x) => x.clause.length > 0 || Boolean(x.title) || Boolean(x.statusReason) || Boolean(x.description))
          .sort((a, b) => {
            const ap = a.priority ?? Number.MAX_SAFE_INTEGER;
            const bp = b.priority ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            return a._idx - b._idx;
          })
          .map(({ _idx, ...rest }) => rest)
      : [];

    const rawLogicCheckpoints = (dto?.logicCheckpoints ?? dto?.logic_checkpoints) as
      | Array<{ clause?: string; status?: string; description?: string }>
      | undefined;
    const fallbackLogicCheckpoints: LogicCheckpointItem[] = Array.isArray(rawLogicCheckpoints)
      ? rawLogicCheckpoints
          .map((x) => {
            const clause = (x.clause ?? '').trim();
            const statusCode = normalizeRegulationStatus(x.status);
            const status: 'compliant' | 'violation' = statusCode === 'VIOLATION' ? 'violation' : 'compliant';
            return { clause, status, statusCode, description: x.description, source: 'logic' as const };
          })
          .filter((x) => x.clause.length > 0)
      : [];

    const logicCheckpoints =
      regulationCheckpoints.length > 0 ? regulationCheckpoints : fallbackLogicCheckpoints;

    const rawEvidenceLinks = (dto?.evidenceLinks ?? dto?.evidence_links) as Array<{ itemIdx?: number; reason?: string; severity?: string }> | undefined;
    const evidenceLinks: EvidenceLinkItem[] = Array.isArray(rawEvidenceLinks)
      ? rawEvidenceLinks.map((x) => ({
          itemIdx: typeof x.itemIdx === 'number' ? x.itemIdx : 0,
          reason: x.reason,
          severity: x.severity,
        }))
      : [];

    const rawFinalReport = (dto?.finalReport ?? dto?.final_report) as FinalReportItem | undefined;
    const finalReport: FinalReportItem | null = rawFinalReport && typeof rawFinalReport === 'object' ? rawFinalReport : null;
    const summaryVerdict = finalReport?.summary ?? finalReport?.verdict;
    const keyGrounds = logicCheckpoints.length > 0 ? logicCheckpoints.map((x) => x.clause) : undefined;

    const violationBuzeiList = (() => {
      const fromLinks = evidenceLinks.map((link) => {
        const idx = link.itemIdx;
        const item = fiDocItems[idx];
        return item?.buzei ? normalizeBuzei(item.buzei) : null;
      }).filter((b): b is string => b != null && b.length > 0);
      return Array.from(new Set([...(targetBuzei ? [targetBuzei] : []), ...fromLinks])).filter(Boolean);
    })();

    const highlightChunkIds: string[] = [];

    const rawActions = (dto?.action?.actions ?? []) as Array<Record<string, unknown>>;
    const actions: RelatedAction[] = rawActions.map((a) => ({
      id: String(a.actionId ?? a.id ?? ''),
      actionType: String(a.actionType ?? ''),
      description: a.description as string | undefined,
      status: String(a.status ?? ''),
      riskLevel: a.riskLevel as string | undefined,
      targetSystem: a.targetSystem as string | undefined,
    }));

    // 조치 이력: BE actionHistory[] (CaseActionHistoryItemRefDto), JSON camelCase (actionAt, createdAt)
    const rawActionHistory = (dto?.actionHistory ?? dto?.agent_case_action_history ?? []) as Array<Record<string, unknown>>;
    const actionHistory: ActionHistoryItem[] = rawActionHistory.map((item, idx) => ({
      id: String(item.id ?? idx),
      actorName: (item.actorId ?? item.actor_id ?? item.actorName ?? 'System') as string,
      actionAt: (item.actionAt ?? item.action_at ?? item.createdAt ?? '') as string,
      comment: (item.commentText ?? item.comment_text ?? item.comment) as string | undefined,
    }));

    // AI 추론 과정: BE aiThoughts[] (AiThoughtItemDto) — stage, eventType, message, occurredAt (camelCase)
    const rawThoughts = (dto?.aiThoughts ?? (dto?.reasoning as Record<string, unknown> | undefined)?.thoughts ?? []) as Array<Record<string, unknown>>;
    const aiThoughts: AiThought[] = rawThoughts.map((thought, idx) => {
      const rawType = (thought.eventType ?? thought.stage ?? thought.type ?? 'reasoning') as string;
      return {
        id: String(thought.id ?? idx),
        step: (thought.step ?? idx + 1) as number,
        type: toCanonicalThoughtType(rawType),
        content: (thought.message ?? thought.content ?? thought.text ?? '') as string,
        confidence: thought.confidence as number | undefined,
        timestamp: (thought.occurredAt ?? thought.occurred_at ?? thought.timestamp) as string | undefined,
        chunkId: (thought.chunkId ?? thought.chunk_id) as string | undefined,
      };
    });

    return {
      caseData,
      evidence: dto?.evidence,
      reasoning: dto?.reasoning,
      action: dto?.action,
      fiDoc,
      fiDocItems,
      targetBuzei,
      violationBuzeiList,
      highlightChunkIds,
      reasoningProcess,
      briefingInsight,
      logicCheckpoints,
      evidenceLinks,
      finalReport,
      summaryVerdict,
      keyGrounds,
      lineCount,
      itemsCurrency,
      actionHistory,
      aiThoughts,
      relatedActions: actions,
      auditEvents: [] as AuditEvent[],
      isLoading: query.isLoading,
      error: query.error,
      refetch: query.refetch,
    };
  }, [caseId, query.data, query.isLoading, query.error, query.refetch]);
};
