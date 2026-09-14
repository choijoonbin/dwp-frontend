import { useProductSurfaceGovernedMutation } from '../../components/use-product-surface-governed-mutation';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { approvalSignatureRouteInstalled } from './approval-signature-source-model';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';

type LowLeaf =
  'signature-request-create.action' | 'signature-consent.action' | 'signature-cancel.action';

export function useApprovalSignatureMutation(leaf: LowLeaf) {
  const dispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
    routeContractKey: `route.approvals.work.${leaf}`,
    taskKind: 'WORK',
  });
  function run<T>(execute: (execution: ApprovalMutationExecution) => Promise<T>) {
    if (!approvalSignatureRouteInstalled(leaf)) throw new ProductSurfaceOperationCancelledError();
    return dispatch(execute);
  }
  return { available: approvalSignatureRouteInstalled(leaf), run };
}
