import { axiosInstance } from '../axios-instance';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
} from './approval-governed-mutation';
import { approvalAttachmentId, invalidApprovalAttachment } from './approval-attachment-contract';
import {
  readApprovalAttachmentPolicy,
  snapshotApprovalAttachmentPolicyDraft,
  snapshotApprovalAttachmentPolicyPublish,
} from './approval-attachment-policy-contract';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type { ApprovalAttachmentDispatchOptions } from './approval-attachment-api';
import type {
  ApprovalAttachmentPolicyDraftInput,
  ApprovalAttachmentPolicyPublishInput,
} from './approval-attachment-policy-contract';

const base = '/api/approvals/v1/admin/attachments';
export type ApprovalAttachmentPolicyDispatchOptions = ApprovalAttachmentDispatchOptions &
  Readonly<{ contextScopeKey?: string }>;
export class ApprovalAttachmentPolicyResponseError extends Error {
  constructor(cause: unknown) {
    super('Approval attachment policy command returned an unverifiable result.', { cause });
    this.name = 'ApprovalAttachmentPolicyResponseError';
  }
}
function result(value: unknown, policyId: string) {
  try {
    return readApprovalAttachmentPolicy(value, policyId);
  } catch (error) {
    throw new ApprovalAttachmentPolicyResponseError(error);
  }
}
function settings(
  input: { expectedVersion: number; idempotencyKey: string },
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentPolicyDispatchOptions,
  publish: boolean
) {
  if (
    (execution.mode === 'SECURE' &&
      options.contextScopeKey !== undefined &&
      options.contextScopeKey !== execution.contextScopeKey) ||
    (publish && execution.mode !== 'SECURE') ||
    (execution.mode === 'SECURE' &&
      ((execution.objectVersion !== undefined &&
        execution.objectVersion !== input.expectedVersion) ||
        (execution.idempotencyKey !== undefined &&
          execution.idempotencyKey !== input.idempotencyKey)))
  )
    invalidApprovalAttachment();
  const config = publish
    ? approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: true })
    : approvalMutationExecutionConfig(execution);
  return {
    ...config,
    ...options,
    headers: { ...config.headers, 'Idempotency-Key': input.idempotencyKey },
  };
}
export async function getApprovalAttachmentPolicy(
  contextScopeKey?: string,
  signal?: AbortSignal,
  resourceSetKey?: string
) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${base}/policy`, {
    contextScopeKey,
    signal,
  });
  return readApprovalAttachmentPolicy(response.data.data, undefined, resourceSetKey);
}
export async function saveApprovalAttachmentPolicyDraft(
  policyId: string,
  input: ApprovalAttachmentPolicyDraftInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentPolicyDispatchOptions = {}
) {
  approvalAttachmentId(policyId);
  const original = snapshotApprovalAttachmentPolicyDraft(input);
  const response = await axiosInstance.put<ApiResponse<unknown>, typeof original>(
    `${base}/policies/${policyId}/draft`,
    original,
    settings(original, execution, options, false)
  );
  return result(response.data.data, policyId);
}
export async function publishApprovalAttachmentPolicy(
  policyId: string,
  input: ApprovalAttachmentPolicyPublishInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentPolicyDispatchOptions = {}
) {
  approvalAttachmentId(policyId);
  const original = snapshotApprovalAttachmentPolicyPublish(input);
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof original>(
    `${base}/policies/${policyId}/publish`,
    original,
    settings(original, execution, options, true)
  );
  return result(response.data.data, policyId);
}
