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
  actionType: String(dto.actionType ?? ''),
  type: String(dto.actionType ?? ''),
  status: String(dto.status ?? '').toLowerCase(),
  outcome: dto.outcome as string | undefined,
  executedAt: dto.executedAt as string | undefined,
  failureReason: dto.failureReason as string | undefined,
  docKey: dto.docKey as string | undefined,
  partyId: dto.partyId as number | undefined,
  description: `${dto.actionType ?? 'Action'} for case ${dto.caseId}`,
  createdAt: String(dto.executedAt ?? ''),
});
