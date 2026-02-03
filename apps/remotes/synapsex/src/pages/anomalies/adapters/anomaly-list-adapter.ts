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

export const anomalyListDtoToUi = (dto: AnomalyListRowDto): AnomalyListItem => ({
  id: String(dto.anomalyId),
  anomalyType: dto.anomalyType ?? '',
  severity: (dto.severity ?? 'medium').toLowerCase(),
  score: dto.score ?? 0,
  detectedAt: dto.detectedAt ?? '',
  docKey: dto.docKey,
  partyId: dto.partyId,
  caseNumber: `CS-${dto.anomalyId}`,
  counterparty: '',
  docNumber: dto.docKey ?? '',
  amount: 0,
  currency: 'USD',
  confidence: dto.score ?? 0,
  slaDue: dto.detectedAt ?? '',
  assignee: null,
  companyCode: '',
});
