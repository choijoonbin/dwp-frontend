/**
 * Case list API DTO → UI model adapter
 */

import type { CaseListRowDto } from '@dwp-frontend/shared-utils';

export type CaseListItem = {
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
  createdAt: string;
  slaDue: string;
  assignee: string | null;
  confidence: number;
  fiDocId: string;
  docNumber: string;
  docType: string;
  description: string;
};

const mapSeverity = (s: string): CaseListItem['severity'] => {
  const lower = (s ?? '').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(lower)) {
    return lower as CaseListItem['severity'];
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

export const caseListDtoToUi = (dto: CaseListRowDto): CaseListItem => {
  const docKey = (dto.docKeys?.[0] as string | undefined) ?? '';
  const parts = docKey ? docKey.split('-') : ['', '', ''];
  const bukrs = parts[0] ?? '';
  const belnr = parts[1] ?? '';
  const party = dto.partySummary as { nameDisplay?: string; partyCode?: string; partyId?: string | number } | undefined;

  return {
    id: String(dto.caseId),
    caseNumber: `CS-${dto.caseId}`,
    title: (dto.reasonTextShort as string | undefined) ?? party?.nameDisplay ?? `Case ${dto.caseId}`,
    severity: mapSeverity((dto.severity as string | undefined) ?? ''),
    status: mapStatus((dto.status as string | undefined) ?? ''),
    anomalyType: dto.caseType ?? '',
    companyCode: bukrs || '',
    counterparty: party?.nameDisplay ?? '',
    counterpartyId: party?.partyCode ? String(party.partyId) : '',
    amount: 0,
    currency: 'USD',
    detectedAt: dto.detectedAt ?? '',
    createdAt: dto.detectedAt ?? '',
    slaDue: dto.detectedAt ?? '',
    assignee: null,
    confidence: dto.score ?? 0,
    fiDocId: docKey,
    docNumber: belnr || '',
    docType: '',
    description: (dto.reasonTextShort as string | undefined) ?? '',
  };
};
