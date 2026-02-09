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

export type FiDocItem = {
  id: string;
  hkont?: string;
  shkzg?: string;
  wrbtr?: number;
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
        relatedActions: [],
        auditEvents: [],
        isLoading: false,
        error: null,
        refetch: () => {},
      };
    }

    const dto = query.data;
    const caseData = caseDetailDtoToUi(caseId, dto ?? null);
    const evidence = dto?.evidence;
    const docOrItem = evidence?.documentOrOpenItem as Record<string, unknown> | undefined;
    const header = docOrItem?.headerSummary as Record<string, unknown> | undefined;
    const items = (docOrItem?.items as Array<Record<string, unknown>>) ?? [];

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

    const fiDocItems: FiDocItem[] = items.map((item, idx) => {
      const r = item as Record<string, unknown>;
      return {
        id: String(r.id ?? r.buzei ?? idx),
        hkont: r.hkont as string | undefined,
        shkzg: r.shkzg as string | undefined,
        wrbtr: r.wrbtr as number | undefined,
      };
    });

    const rawActions = (dto?.action?.actions ?? []) as Array<Record<string, unknown>>;
    const actions: RelatedAction[] = rawActions.map((a) => ({
      id: String(a.actionId ?? a.id ?? ''),
      actionType: String(a.actionType ?? ''),
      description: a.description as string | undefined,
      status: String(a.status ?? ''),
      riskLevel: a.riskLevel as string | undefined,
      targetSystem: a.targetSystem as string | undefined,
    }));

    return {
      caseData,
      evidence: dto?.evidence,
      reasoning: dto?.reasoning,
      action: dto?.action,
      fiDoc,
      fiDocItems,
      relatedActions: actions,
      auditEvents: [] as AuditEvent[],
      isLoading: query.isLoading,
      error: query.error,
      refetch: query.refetch,
    };
  }, [caseId, query.data, query.isLoading, query.error, query.refetch]);
};
