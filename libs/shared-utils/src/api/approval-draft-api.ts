import { axiosInstance } from '../axios-instance';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type { ApprovalPage } from './approval-search-api';

export type ApprovalDraftState = {
  requestId: string;
  version: number;
  payloadRevision: number;
  deletedAt: string | null;
  deletedBy: number | null;
};
export type ApprovalDraftRevision = {
  revision: number;
  payloadSha256: string;
  changeType: string;
  changedBy: number | null;
  reason: string | null;
  createdAt: string;
  recoverable: boolean;
  recoveryReason: string | null;
};
export type ApprovalDraftRevisionDetail = {
  revision: ApprovalDraftRevision;
  payload: Record<string, unknown>;
  draftSnapshot: Record<string, unknown>;
};
export type ApprovalDraftReconciliation = {
  idempotencyKey: string;
  receipts: {
    commandType: string;
    route: string;
    draft: ApprovalDraftState;
    completedAt: string;
  }[];
};
export type ApprovalDraftCommand = {
  expectedVersion: number;
  idempotencyKey: string;
  reason: string;
};

const base = '/api/approvals/v1';

export async function getApprovalDraftReconciliation(
  key: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalDraftReconciliation> {
  const response = await axiosInstance.get<ApiResponse<ApprovalDraftReconciliation>>(
    `${base}/draft-commands/${encodeURIComponent(key)}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}

export async function getApprovalDraftRevisions(
  requestId: string,
  options: { page: number; size: number },
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalPage<ApprovalDraftRevision>> {
  const params = new URLSearchParams({ page: String(options.page), size: String(options.size) });
  const response = await axiosInstance.get<ApiResponse<ApprovalPage<ApprovalDraftRevision>>>(
    `${base}/requests/${requestId}/draft/revisions?${params}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}

export async function getApprovalDraftRevision(
  requestId: string,
  revision: number,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalDraftRevisionDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalDraftRevisionDetail>>(
    `${base}/requests/${requestId}/draft/revisions/${revision}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}

async function draftCommand(
  requestId: string,
  action: 'recover' | 'delete' | 'restore',
  input: ApprovalDraftCommand & { revision?: number },
  execution: ApprovalMutationExecution
): Promise<ApprovalDraftState> {
  const config = approvalMutationExecutionConfig(execution);
  const governedKey = config.headers['Idempotency-Key'];
  if (
    !/^[A-Za-z0-9._:-]{1,120}$/.test(input.idempotencyKey) ||
    (governedKey && governedKey !== input.idempotencyKey)
  ) {
    throw new Error('Invalid approval draft command identity');
  }
  const response = await axiosInstance.post<ApiResponse<ApprovalDraftState>, typeof input>(
    `${base}/requests/${requestId}/draft/${action}`,
    input,
    { ...config, headers: { ...config.headers, 'Idempotency-Key': input.idempotencyKey } }
  );
  return response.data.data;
}

export function recoverApprovalDraft(
  requestId: string,
  input: ApprovalDraftCommand & { revision: number },
  execution: ApprovalMutationExecution
) {
  return draftCommand(requestId, 'recover', input, execution);
}

export function deleteApprovalDraft(
  requestId: string,
  input: ApprovalDraftCommand,
  execution: ApprovalMutationExecution
) {
  return draftCommand(requestId, 'delete', input, execution);
}

export function restoreApprovalDraft(
  requestId: string,
  input: ApprovalDraftCommand,
  execution: ApprovalMutationExecution
) {
  return draftCommand(requestId, 'restore', input, execution);
}
