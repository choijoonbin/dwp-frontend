import {
  createApprovalDelegation,
  getApprovalDelegations,
  revokeApprovalDelegation,
} from '@dwp-frontend/shared-utils/api/approval-api';

import type {
  ApprovalDelegation,
  ApprovalDelegationCreateInput,
} from '@dwp-frontend/shared-utils/api/approval-api';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils/api/approval-governed-mutation';

export type HrisDelegationDataSource = Readonly<{
  list: (contextScopeKey: string, signal?: AbortSignal) => Promise<ApprovalDelegation[]>;
  create: (
    input: ApprovalDelegationCreateInput,
    execution: ApprovalMutationExecution
  ) => Promise<ApprovalDelegation[]>;
  revoke: (
    delegationId: string,
    expectedVersion: number,
    execution: ApprovalMutationExecution
  ) => Promise<ApprovalDelegation[]>;
}>;

export const hrisDelegationDataSource: HrisDelegationDataSource = Object.freeze({
  list: (contextScopeKey, signal) => getApprovalDelegations(contextScopeKey, signal),
  create: (input, execution) => createApprovalDelegation(input, execution),
  revoke: (delegationId, expectedVersion, execution) =>
    revokeApprovalDelegation(delegationId, expectedVersion, execution),
});
