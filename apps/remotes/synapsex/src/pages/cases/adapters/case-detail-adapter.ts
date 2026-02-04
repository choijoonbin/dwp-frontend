/**
 * Case Detail API DTO → UI 모델 변환
 */

import type { CaseDetailDto } from '@dwp-frontend/shared-utils';

export type CaseDetailUi = {
  id: string;
  caseNumber: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  anomalyType: string;
  companyCode: string;
  counterparty: string;
  counterpartyId: string;
  amount: number;
  currency: string;
  detectedAt: string;
  confidence: number;
  fiDocId: string;
  docNumber: string;
};

const mapSeverity = (s: string): CaseDetailUi['severity'] => {
  const lower = (s ?? '').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(lower)) {
    return lower as CaseDetailUi['severity'];
  }
  return 'medium';
};

const mapStatus = (s: string): string => {
  const lower = (s ?? '').toLowerCase();
  const statusMap: Record<string, string> = {
    TRIAGED: 'triage',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed',
  };
  return statusMap[lower] ?? lower;
};

export const caseDetailDtoToUi = (caseId: string, dto: CaseDetailDto | null): CaseDetailUi => {
  const reasonText = (dto?.reasoning?.reasonText as string | undefined) ?? '';
  const evidence = dto?.evidence;
  const docOrItem = evidence?.documentOrOpenItem as Record<string, unknown> | undefined;
  const bukrs = (docOrItem?.bukrs as string) ?? '';
  const belnr = (docOrItem?.belnr as string) ?? '';
  const docKey = docOrItem ? `${bukrs}-${belnr}-${(docOrItem.gjahr as string) ?? ''}` : '';

  return {
    id: caseId,
    caseNumber: `CS-${caseId}`,
    title: reasonText || `Case ${caseId}`,
    severity: mapSeverity((docOrItem?.severity as string) ?? 'medium'),
    status: mapStatus((docOrItem?.status as string) ?? 'triage'),
    anomalyType: (docOrItem?.caseType as string) ?? '',
    companyCode: bukrs,
    counterparty: (docOrItem?.counterparty as string) ?? '',
    counterpartyId: String(docOrItem?.partyId ?? ''),
    amount: Number(docOrItem?.amount ?? 0),
    currency: (docOrItem?.currency as string) ?? 'USD',
    detectedAt: (docOrItem?.detectedAt as string) ?? new Date().toISOString(),
    confidence: Number(dto?.reasoning?.score ?? 0) * 100,
    fiDocId: docKey,
    docNumber: belnr,
  };
};
