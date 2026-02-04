/**
 * Anomaly list API DTO → UI model adapter
 */

import type { AnomalyListRowDto } from '@dwp-frontend/shared-utils';

export type AnomalyListItem = {
  id: string;
  anomalyType: string;
  severity: string;
  score: number;
  detectedAt: string;
  docKey?: string;
  partyId?: number;
  caseNumber: string;
  counterparty: string;
  docNumber: string;
  amount: number;
  currency: string;
  confidence: number;
  slaDue: string;
  assignee: string | null;
  companyCode: string;
};

export const anomalyListDtoToUi = (dto: AnomalyListRowDto): AnomalyListItem => {
  const score = Number(dto.score ?? 0);
  const docKey = dto.docKey as string | undefined;
  return {
    id: String(dto.anomalyId),
    anomalyType: String(dto.anomalyType ?? ''),
    severity: String(dto.severity ?? 'medium').toLowerCase(),
    score,
    detectedAt: String(dto.detectedAt ?? ''),
    docKey,
    partyId: dto.partyId as number | undefined,
    caseNumber: `CS-${dto.anomalyId}`,
    counterparty: '',
    docNumber: docKey ?? '',
    amount: 0,
    currency: 'USD',
    confidence: score,
    slaDue: String(dto.detectedAt ?? ''),
    assignee: null,
    companyCode: '',
  };
};
