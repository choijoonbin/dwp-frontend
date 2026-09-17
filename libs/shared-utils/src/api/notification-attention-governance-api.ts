import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/notifications/v1/admin/policies/attention-governance';

export type NotificationAttentionGovernanceState =
  'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'REJECTED' | 'WITHDRAWN';

export type NotificationAttentionGovernanceSettings = {
  maxActiveUserRules: number;
  maxVipRules: number;
  maxFollowRules: number;
  approvedTopicAllowlist: string[];
  mandatoryPolicyPrecedence: boolean;
  minimumAnalyticsCohort: number;
  independentReviewerRequired: boolean;
};

export type NotificationAttentionGovernanceRevision = {
  governanceId: string;
  state: NotificationAttentionGovernanceState;
  settings: NotificationAttentionGovernanceSettings;
  revisionNumber: number;
  version: string;
  changeReason: string;
  createdBy: number;
  createdAt: string;
  approvedBy?: number | null;
  approvedAt?: string | null;
  updatedBy: number;
  updatedAt: string;
  decisionReason?: string | null;
  supersedesGovernanceId?: string | null;
};

export type NotificationAttentionGovernanceWorkspace = {
  activeRevision?: NotificationAttentionGovernanceRevision | null;
  drafts: NotificationAttentionGovernanceRevision[];
  changeVersion: string;
  generatedAt: string;
};

export type NotificationAttentionGovernanceDraftInput = {
  settings: NotificationAttentionGovernanceSettings;
  changeReason: string;
  expectedVersion: string;
  idempotencyKey: string;
};

export type NotificationAttentionGovernanceDecisionInput = {
  expectedVersion: string;
  reason: string;
  idempotencyKey: string;
};

function mutationHeaders(idempotencyKey: string): Record<string, string> {
  if (!idempotencyKey || idempotencyKey !== idempotencyKey.trim() || idempotencyKey.length > 160) {
    throw new Error('A canonical attention governance idempotency key is required.');
  }
  return { 'Idempotency-Key': idempotencyKey };
}

export function getNotificationAttentionGovernance(
  signal?: AbortSignal
): Promise<NotificationAttentionGovernanceWorkspace> {
  return axiosInstance
    .get<ApiResponse<NotificationAttentionGovernanceWorkspace>>(BASE, { signal })
    .then((response) => response.data.data);
}

export function createNotificationAttentionGovernanceDraft(
  input: NotificationAttentionGovernanceDraftInput
): Promise<NotificationAttentionGovernanceRevision> {
  const { idempotencyKey, ...body } = input;
  return axiosInstance
    .post<ApiResponse<NotificationAttentionGovernanceRevision>, typeof body>(
      `${BASE}/drafts`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

function decideNotificationAttentionGovernance(
  governanceId: string,
  decision: 'publish' | 'reject' | 'withdraw',
  input: NotificationAttentionGovernanceDecisionInput
): Promise<NotificationAttentionGovernanceRevision> {
  const { idempotencyKey, ...body } = input;
  return axiosInstance
    .post<ApiResponse<NotificationAttentionGovernanceRevision>, typeof body>(
      `${BASE}/${encodeURIComponent(governanceId)}/${decision}`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function publishNotificationAttentionGovernance(
  governanceId: string,
  input: NotificationAttentionGovernanceDecisionInput
): Promise<NotificationAttentionGovernanceRevision> {
  return decideNotificationAttentionGovernance(governanceId, 'publish', input);
}

export function rejectNotificationAttentionGovernance(
  governanceId: string,
  input: NotificationAttentionGovernanceDecisionInput
): Promise<NotificationAttentionGovernanceRevision> {
  return decideNotificationAttentionGovernance(governanceId, 'reject', input);
}

export function withdrawNotificationAttentionGovernance(
  governanceId: string,
  input: NotificationAttentionGovernanceDecisionInput
): Promise<NotificationAttentionGovernanceRevision> {
  return decideNotificationAttentionGovernance(governanceId, 'withdraw', input);
}
