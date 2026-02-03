/**
 * Archive list API DTO → UI model adapter
 */

import type { ArchiveListRowDto } from '@dwp-frontend/shared-utils';

export type ArchiveListItem = {
  id: string;
  caseId: string;
  actionType: string;
  type: string;
  status: string;
  outcome?: string;
  executedAt?: string;
  failureReason?: string;
  docKey?: string;
  partyId?: number;
  description: string;
  amount?: number;
  createdAt: string;
};

export const archiveListDtoToUi = (dto: ArchiveListRowDto): ArchiveListItem => ({
  id: String(dto.actionId),
  caseId: String(dto.caseId),
  actionType: dto.actionType ?? '',
  type: dto.actionType ?? '',
  status: (dto.status ?? '').toLowerCase(),
  outcome: dto.outcome,
  executedAt: dto.executedAt,
  failureReason: dto.failureReason,
  docKey: dto.docKey,
  partyId: dto.partyId,
  description: `${dto.actionType ?? 'Action'} for case ${dto.caseId}`,
  createdAt: dto.executedAt ?? '',
});
