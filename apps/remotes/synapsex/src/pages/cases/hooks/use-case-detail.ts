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
    const bukrs = (docOrItem?.bukrs as string) ?? '';
    const belnr = (docOrItem?.belnr as string) ?? '';
    const gjahr = (docOrItem?.gjahr as string) ?? '';

    const fiDoc =
      bukrs || belnr || gjahr
        ? {
            id: `${bukrs}-${belnr}-${gjahr}`,
            bukrs,
            belnr,
            gjahr,
            budat: docOrItem?.budat as string | undefined,
            wrbtr: docOrItem?.wrbtr as number | undefined,
            waers: (docOrItem?.waers as string) ?? 'USD',
            counterpartyId: docOrItem?.counterpartyId as string | undefined,
          }
        : null;

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
      fiDocItems: [] as FiDocItem[],
      relatedActions: actions,
      auditEvents: [] as AuditEvent[],
      isLoading: query.isLoading,
      error: query.error,
      refetch: query.refetch,
    };
  }, [caseId, query.data, query.isLoading, query.error, query.refetch]);
};
