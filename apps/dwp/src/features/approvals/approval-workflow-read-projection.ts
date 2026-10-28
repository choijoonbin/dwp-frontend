import { isApprovalWorkflowDetailProjection } from '@dwp-frontend/shared-utils';

import { captureApprovalWorkflowOwnerDetail } from './approval-workflow-typed-workspace-model';

import type {
  ApprovalWorkflow,
  ApprovalWorkflowOversightProjection,
  ApprovalWorkflowReadProjection,
} from '@dwp-frontend/shared-utils';
import type { ApprovalWorkflowOwnerDetail } from './approval-workflow-typed-workspace-model';

export type ApprovalWorkflowReadModel = Readonly<{
  workflow: ApprovalWorkflow | ApprovalWorkflowOversightProjection;
  owner?: ApprovalWorkflowOwnerDetail;
}>;

export async function approvalWorkflowReadModel(
  projection: ApprovalWorkflowReadProjection
): Promise<ApprovalWorkflowReadModel> {
  if (!isApprovalWorkflowDetailProjection(projection)) return { workflow: projection };
  return {
    workflow: projection.workflow,
    owner: await captureApprovalWorkflowOwnerDetail(projection),
  };
}
