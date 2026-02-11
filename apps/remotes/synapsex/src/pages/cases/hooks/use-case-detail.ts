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

/** AI 추론 과정 UI 모델 (WorkbenchThoughtChain) */
export type AiThought = {
  id: string;
  step: number;
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
    const aiThoughts: AiThought[] = rawThoughts.map((thought, idx) => ({
      id: String(thought.id ?? idx),
      step: (thought.step ?? idx + 1) as number,
      type: (thought.eventType ?? thought.stage ?? thought.type ?? 'reasoning') as string,
      content: (thought.message ?? thought.content ?? thought.text ?? '') as string,
      confidence: thought.confidence as number | undefined,
      timestamp: (thought.occurredAt ?? thought.occurred_at ?? thought.timestamp) as string | undefined,
    }));

    return {
      caseData,
      evidence: dto?.evidence,
      reasoning: dto?.reasoning,
      action: dto?.action,
      fiDoc,
      fiDocItems,
      targetBuzei,
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
