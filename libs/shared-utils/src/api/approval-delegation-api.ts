import { axiosInstance } from '../axios-instance';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';

import type { ApprovalDelegation, ApprovalDelegationUpdateInput } from './approval-api';
import type { ApprovalMutationExecution } from './approval-governed-mutation';

type ApprovalDelegationResponse<T> = Readonly<{ data: T }>;
const base = '/api/approvals/v1';

export async function updateApprovalDelegation(
  delegationId: string,
  input: ApprovalDelegationUpdateInput,
  execution: ApprovalMutationExecution & { idempotencyKey: string }
): Promise<ApprovalDelegation[]> {
  if (
    !/^[A-Za-z0-9._:-]{1,120}$/.test(execution.idempotencyKey) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    (execution.mode === 'SECURE' && execution.objectVersion !== input.expectedVersion)
  ) {
    throw new Error('Invalid approval delegation update identity');
  }
  const config = approvalMutationExecutionConfig(execution, { objectVersionHeader: true });
  const response = await axiosInstance.put<
    ApprovalDelegationResponse<ApprovalDelegation[]>,
    typeof input
  >(`${base}/delegations/${delegationId}`, input, {
    ...config,
    headers: { ...config.headers, 'Idempotency-Key': execution.idempotencyKey },
    csrfReplay: 'NEVER',
  });
  return response.data.data;
}
