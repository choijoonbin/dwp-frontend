/**
 * Product-neutral entry point for the shared step-up command coordinator. The implementation was
 * introduced by the Approvals pilot, but its authority, replay, popup, and conflict semantics are
 * common to every governed product surface.
 */
export {
  productSurfaceHighRiskCommand,
  type ApprovalHighRiskCommandDescriptor as ProductSurfaceHighRiskCommandDescriptor,
  type ApprovalHighRiskOperation as ProductSurfaceHighRiskOperation,
} from '../features/approvals/approval-high-risk-command-model';
export {
  useApprovalHighRiskCommand as useProductSurfaceHighRiskCommand,
  type ApprovalHighRiskCommandController as ProductSurfaceHighRiskCommandController,
} from '../features/approvals/use-approval-high-risk-command';
export { ApprovalHighRiskCommandDialog as ProductSurfaceHighRiskCommandDialog } from '../features/approvals/approval-high-risk-command-dialog';
