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
function mapRawLineItemToFiDoc(
  r: Record<string, unknown>,
  idx: number,
  itemsCurrency: string
): FiDocItem {
  const buzeiVal = r.buzei ?? r.line_item_no ?? r.lineItemNo;
  const buzeiStr =
    buzeiVal != null ? String(buzeiVal).padStart(3, '0') : String(idx + 1).padStart(3, '0');
  const hkont = (r.hkont ?? r.gl_account ?? r.glAccount) as string | undefined;
  const wrbtr = (r.wrbtr ?? r.amount_in_doc_currency ?? r.amountInDocCurrency ?? r.amount) as number | undefined;
  const dmbtr = (r.dmbtr ?? r.amount_in_local ?? r.amountInLocal) as number | undefined;
  const sgtxt = (r.sgtxt ?? r.item_text ?? r.itemText) as string | undefined;
  const partner = (r.lifnr ?? r.kunnr ?? r.partner_id ?? r.partnerId ?? r.partner) as string | undefined;
  const waers = (r.waers ?? r.currency ?? r.doc_currency ?? r.docCurrency) as string | undefined;
  const isTarget = Boolean(r.isTarget ?? r.is_target);
  return {
    id: String(r.id ?? r.buzei ?? r.line_item_no ?? idx),
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

/** buzei 값을 3자리 문자열로 통일 */
function normalizeBuzei(v: string | number | undefined): string {
  if (v == null) return '';
  return String(v).trim().padStart(3, '0');
}

/**
 * evidenceMapJson 파싱 — 위반/이상 행 buzei 목록 추출
 * 지원 형태: { buzei: string[] } | { lineItems: { buzei: string }[] } | { highlightedBuzei: string[] } | string (JSON)
 */
function parseEvidenceMapJson(dto: Record<string, unknown> | null | undefined): string[] {
  const raw =
    (dto?.evidenceMapJson as string | Record<string, unknown> | undefined) ??
    (dto?.evidence_map_json as string | Record<string, unknown> | undefined) ??
    (dto?.reasoning as Record<string, unknown> | undefined)?.evidenceMapJson ??
    (dto?.reasoning as Record<string, unknown> | undefined)?.evidence_map_json;
  if (raw == null) return [];

  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return [];
    }
  } else {
    obj = raw as Record<string, unknown>;
  }

  const buzeiArr = obj.buzei as string[] | undefined;
  if (Array.isArray(buzeiArr)) {
    return buzeiArr.map(normalizeBuzei).filter(Boolean);
  }

  const lineItems = obj.lineItems as Array<{ buzei?: string }> | undefined;
  if (Array.isArray(lineItems)) {
    return lineItems.map((item) => normalizeBuzei(item.buzei)).filter(Boolean);
  }

  const highlighted = obj.highlightedBuzei as string[] | undefined;
  if (Array.isArray(highlighted)) {
    return highlighted.map(normalizeBuzei).filter(Boolean);
  }

  return [];
}

/** evidenceMapJson에서 chunkId 목록 추출 — 우측 규정집 근거 문구 하이라이트용 */
function parseEvidenceMapChunkIds(dto: Record<string, unknown> | null | undefined): string[] {
  const raw =
    (dto?.evidenceMapJson as string | Record<string, unknown> | undefined) ??
    (dto?.evidence_map_json as string | Record<string, unknown> | undefined) ??
    (dto?.reasoning as Record<string, unknown> | undefined)?.evidenceMapJson ??
    (dto?.reasoning as Record<string, unknown> | undefined)?.evidence_map_json;
  if (raw == null) return [];

  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return [];
    }
  } else {
    obj = raw as Record<string, unknown>;
  }

  const chunkIds = obj.chunkIds as string[] | undefined;
  if (Array.isArray(chunkIds)) {
    return chunkIds.map((id) => String(id).trim()).filter(Boolean);
  }

  const lineItems = obj.lineItems as Array<{ chunkId?: string }> | undefined;
  if (Array.isArray(lineItems)) {
    return lineItems.map((item) => String(item.chunkId ?? '').trim()).filter(Boolean);
  }

  return [];
}

/** AI 추론 과정 UI 모델 (WorkbenchThoughtChain) — type은 canonical (hypothesis, investigation 등) */
export type AiThought = {
  id: string;
  step: number;
  /** Aura eventType/stage와 매핑된 canonical 단계 (Hypothesis, Investigation 등 표시용) */
  type: string;
  content: string;
  confidence?: number;
  timestamp?: string;
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
  /** evidenceMapJson 기반 위반/이상 행 buzei 목록 (3자리 패딩) — 좌측 전표 테이블 강조용 */
  violationBuzeiList: string[];
  /** evidenceMapJson 기반 chunkId 목록 — 우측 규정집 근거 문구 하이라이트용 */
  highlightChunkIds: string[];
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

    const evidenceMapBuzei = parseEvidenceMapJson(dto as Record<string, unknown>);
    const violationBuzeiList = Array.from(
      new Set([...(targetBuzei ? [targetBuzei] : []), ...evidenceMapBuzei])
    ).filter(Boolean);
    const highlightChunkIds = parseEvidenceMapChunkIds(dto as Record<string, unknown>);

    const fiDocItems: FiDocItem[] = items.map((item, idx) =>
      mapRawLineItemToFiDoc(item as Record<string, unknown>, idx, itemsCurrency)
    );

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
