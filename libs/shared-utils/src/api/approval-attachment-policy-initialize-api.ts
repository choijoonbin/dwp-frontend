import { axiosInstance } from '../axios-instance';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';
import { approvalAttachmentKey, invalidApprovalAttachment } from './approval-attachment-contract';
import { readApprovalAttachmentPolicy } from './approval-attachment-policy-contract';
import { ApprovalAttachmentPolicyResponseError } from './approval-attachment-policy-api';
import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type { ApprovalAttachmentPolicyDispatchOptions } from './approval-attachment-policy-api';

export interface ApprovalAttachmentPolicyInitializeInput {
  expectedAbsent: true;
  idempotencyKey: string;
}

/** Initialization is an explicit guarded write, never a side effect of reading the policy. */
export async function initializeApprovalAttachmentPolicy(
  input: ApprovalAttachmentPolicyInitializeInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentPolicyDispatchOptions & { resourceSetKey: string }
) {
  if (
    !input ||
    Object.keys(input).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(input, 'expectedAbsent') ||
    !Object.prototype.hasOwnProperty.call(input, 'idempotencyKey') ||
    input.expectedAbsent !== true ||
    execution?.mode !== 'SECURE' ||
    !['110', '111'].includes(execution.rolloutState) ||
    execution.objectVersion !== undefined ||
    execution.stepUp !== undefined ||
    execution.idempotencyKey !== input.idempotencyKey ||
    !/^psr-[0-9a-f]{64}$/u.test(execution.expectedDecisionRevision) ||
    !options ||
    !/^RS_[A-Z0-9_]{1,76}$/u.test(options.resourceSetKey) ||
    (options.contextScopeKey !== undefined && options.contextScopeKey !== execution.contextScopeKey)
  )
    invalidApprovalAttachment();
  approvalAttachmentKey(input.idempotencyKey);
  const original = Object.freeze({
    expectedAbsent: true as const,
    idempotencyKey: input.idempotencyKey,
  });
  const config = approvalMutationExecutionConfig(execution);
  const { resourceSetKey, ...dispatch } = options;
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof original>(
    '/api/approvals/v1/admin/attachments/policies',
    original,
    {
      ...config,
      ...dispatch,
      headers: { ...config.headers, 'Idempotency-Key': original.idempotencyKey },
    }
  );
  try {
    return readApprovalAttachmentPolicy(response.data.data, undefined, resourceSetKey);
  } catch (error) {
    throw new ApprovalAttachmentPolicyResponseError(error);
  }
}
