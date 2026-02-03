/**
 * Action list API DTO → UI model adapter
 */

import type { ActionListRowDto } from '@dwp-frontend/shared-utils';

export type ActionListItem = {
  id: string;
  caseId: string;
  actionType: string;
  type: string;
  status: string;
  createdAt: string;
  executedAt?: string;
  outcome?: string;
  failureReason?: string;
  description: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  autonomyMode: string;
  requiredApproval: boolean;
  targetSystem: string;
  amount?: number;
  simulation?: unknown;
};

const mapStatus = (s: string): string => {
  const lower = (s ?? '').toLowerCase();
  const statusMap: Record<string, string> = {
    PROPOSED: 'pending',
    PENDING_APPROVAL: 'pending',
    APPROVED: 'approved',
    EXECUTING: 'pending',
    EXECUTED: 'executed',
    FAILED: 'failed',
    CANCELED: 'rejected',
  };
  return statusMap[lower] ?? lower;
};

export const actionListDtoToUi = (dto: ActionListRowDto): ActionListItem => ({
  id: String(dto.actionId),
  caseId: String(dto.caseId),
  actionType: dto.actionType ?? '',
  type: dto.actionType ?? '',
  status: mapStatus(dto.status),
  createdAt: dto.createdAt ?? '',
  executedAt: dto.executedAt,
  outcome: dto.outcome,
  failureReason: dto.failureReason,
  description: `${dto.actionType ?? 'Action'} for case ${dto.caseId}`,
  riskLevel: 'medium',
  autonomyMode: 'manual',
  requiredApproval: true,
  targetSystem: 'SAP FI',
  simulation: undefined,
});
