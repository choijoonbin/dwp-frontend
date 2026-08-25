import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from './product-surface-governed-mutation';

import type {
  ProductSurfaceGovernedMutationAuthority,
  ProductSurfaceSecureMutationAuthority,
  ProductSurfaceStepUpProof,
} from './product-surface-governed-mutation';

export type ApprovalStepUpProof = ProductSurfaceStepUpProof;
export type ApprovalGovernedMutationContext = Omit<
  ProductSurfaceSecureMutationAuthority,
  'mode' | 'rolloutState'
>;
export type ApprovalMutationExecution = ProductSurfaceGovernedMutationAuthority;

export function approvalMutationExecutionConfig(
  execution: ApprovalMutationExecution,
  options?: { objectVersionHeader?: boolean }
): { headers: Record<string, string>; contextScopeKey?: string } {
  return productSurfaceGovernedMutationConfig(execution, options);
}

export function approvalHighRiskMutationExecutionConfig(
  execution: ApprovalMutationExecution,
  options: { objectVersionHeader: boolean }
): { headers: Record<string, string>; contextScopeKey?: string } {
  return productSurfaceHighRiskMutationConfig(execution, options);
}
