import { getApprovalPolicies } from '@dwp-frontend/shared-utils/api/approval-management-api';
import { publishApprovalPolicy } from '@dwp-frontend/shared-utils/api/approval-api';

import type { ApprovalPolicy } from '@dwp-frontend/shared-utils/api/approval-management-contract';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils/api/approval-governed-mutation';

export type HrisWorkflowPolicyDataSource = Readonly<{
  list: (contextScopeKey: string, signal?: AbortSignal) => Promise<ApprovalPolicy[]>;
  publish: (
    policyId: string,
    input: Readonly<{ expectedVersion: number; reviewComment: string }>,
    execution: ApprovalMutationExecution
  ) => Promise<ApprovalPolicy[]>;
}>;

export const hrisWorkflowPolicyDataSource: HrisWorkflowPolicyDataSource = Object.freeze({
  list: (contextScopeKey, signal) => getApprovalPolicies(contextScopeKey, signal),
  publish: (policyId, input, execution) => publishApprovalPolicy(policyId, input, execution),
});
