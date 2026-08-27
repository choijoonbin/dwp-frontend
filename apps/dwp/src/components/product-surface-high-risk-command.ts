/**
 * Product-neutral entry point for the shared step-up command coordinator. The implementation was
 * introduced by the Approvals pilot, but its authority, replay, popup, and conflict semantics are
 * common to every governed product surface.
 */
export {
  productSurfaceHighRiskCommand,
  type ApprovalHighRiskCommandDescriptor as ProductSurfaceHighRiskCommandDescriptor,
  type ApprovalHighRiskOperation as ProductSurfaceHighRiskOperation,
} from './product-surface-high-risk-command-model';
export {
  useApprovalHighRiskCommand as useProductSurfaceHighRiskCommand,
  type ApprovalHighRiskCommandController as ProductSurfaceHighRiskCommandController,
} from './use-product-surface-high-risk-command';
export { ApprovalHighRiskCommandDialog as ProductSurfaceHighRiskCommandDialog } from './product-surface-high-risk-command-dialog';
