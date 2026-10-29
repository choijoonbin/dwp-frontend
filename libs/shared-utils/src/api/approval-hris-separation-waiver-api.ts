import { axiosInstance } from '../axios-instance';
import { approvalHighRiskMutationExecutionConfig } from './approval-governed-mutation';
import { snapshotApprovalHrisSeparationWaiverTaskApproveInput } from './approval-hris-separation-waiver-contract';
import { assertSupportedApprovalFormSchema } from './approval-management-contract';
import { readApprovalQuorumTaskSnapshot } from './approval-quorum-contract';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type { ApprovalHrisSeparationWaiverTaskApproveInput } from './approval-hris-separation-waiver-contract';
import type { ApprovalTaskDetail } from './approval-api-contracts';

export type { ApprovalHrisSeparationWaiverTaskApproveInput } from './approval-hris-separation-waiver-contract';

const base = '/api/approvals/v1/hris/separation-waiver-tasks';
const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export async function approveApprovalHrisSeparationWaiverTask(
  taskId: string,
  input: ApprovalHrisSeparationWaiverTaskApproveInput,
  execution: ApprovalMutationExecution,
  correlationId: string,
  beforeDispatch?: () => void
): Promise<ApprovalTaskDetail> {
  if (
    !canonicalUuid.test(taskId) ||
    !canonicalUuid.test(correlationId) ||
    execution.mode !== 'SECURE' ||
    execution.objectVersion !== input.expectedVersion
  ) {
    throw new Error('Invalid HRIS separation-waiver HIGH command authority');
  }
  const body = snapshotApprovalHrisSeparationWaiverTaskApproveInput(input);
  const governed = approvalHighRiskMutationExecutionConfig(execution, {
    objectVersionHeader: true,
  });
  const response = await axiosInstance.post<ApiResponse<ApprovalTaskDetail>, typeof body>(
    `${base}/${encodeURIComponent(taskId)}/approve`,
    body,
    {
      ...governed,
      headers: { ...governed.headers, 'X-Correlation-ID': correlationId },
      ...(beforeDispatch ? { beforeDispatch } : {}),
      csrfReplay: 'NEVER',
    }
  );
  if (response.data.data.formSchema) {
    assertSupportedApprovalFormSchema(response.data.data.formSchema);
  }
  if (response.data.data.quorum != null) {
    return {
      ...response.data.data,
      quorum: readApprovalQuorumTaskSnapshot(response.data.data.quorum),
    };
  }
  return response.data.data;
}
