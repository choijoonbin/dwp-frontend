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
  /** last_detected_at 또는 updated_at (BE 제공 시) */
  lastDetectedAt?: string;
  updatedAt?: string;
  /** New/Updated 배지 표시용 (BE isNew 또는 탐지 24h 이내) */
  isNew?: boolean;
  isUpdated?: boolean;
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
    triaged: 'triage',
    in_progress: 'in_progress',
    resolved: 'resolved',
    dismissed: 'dismissed',
  };
  return statusMap[lower] ?? lower;
};

const MS_24H = 24 * 60 * 60 * 1000;

export const caseListDtoToUi = (dto: CaseListRowDto): CaseListItem => {
  const docKey = (dto.docKeys?.[0] as string | undefined) ?? '';
  const parts = docKey ? docKey.split('-') : ['', '', ''];
  const bukrs = parts[0] ?? '';
  const belnr = parts[1] ?? '';
  const party = dto.partySummary as { nameDisplay?: string; partyCode?: string; partyId?: string | number } | undefined;

  const detectedAt = (dto.lastDetectedAt as string | undefined) ?? dto.detectedAt ?? '';
  const updatedAt = dto.updatedAt as string | undefined;
  const isNewFromDto = dto.isNew as boolean | undefined;
  const now = Date.now();
  const detectedMs = detectedAt ? new Date(detectedAt).getTime() : 0;
  const isNew = isNewFromDto ?? (detectedMs > 0 && now - detectedMs < MS_24H);
  const isUpdated = Boolean(updatedAt);

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
    amount: Number((dto as { amount?: number }).amount ?? 0),
    currency: (dto as { currency?: string }).currency ?? 'USD',
    detectedAt: dto.detectedAt ?? detectedAt,
    lastDetectedAt: detectedAt || undefined,
    updatedAt,
    isNew: isNew || undefined,
    isUpdated: isUpdated || undefined,
    createdAt: dto.detectedAt ?? detectedAt,
    slaDue: dto.detectedAt ?? detectedAt,
    assignee: null,
    confidence: dto.score ?? 0,
    fiDocId: docKey,
    docNumber: belnr || '',
    docType: '',
    description: (dto.reasonTextShort as string | undefined) ?? '',
  };
};
