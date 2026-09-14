import { useCallback } from 'react';
import { APPROVAL_RETENTION_BINDINGS } from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import type { ApprovalRetentionRoute } from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils/api/approval-governed-mutation';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import {
  ProductSurfaceMutationAuthorityError,
  useProductSurfaceGovernedMutation,
} from '../../components/use-product-surface-governed-mutation';

export function approvalRetentionRouteInstalled(key: ApprovalRetentionRoute) {
  const binding = APPROVAL_RETENTION_BINDINGS.find(([route]) => route === key)!;
  const matches = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
    (route) => route.routeContractKey === `route.approvals.admin.${key}`
  );
  return (
    matches.length === 1 &&
    matches[0]!.productId === 'approvals' &&
    matches[0]!.surfaceId === 'approvals.admin' &&
    matches[0]!.routeKind === (key.endsWith('.data') ? 'DATA' : 'ACTION') &&
    matches[0]!.gatewayBindings.length === 1 &&
    matches[0]!.gatewayBindings[0]!.method === binding[1] &&
    matches[0]!.gatewayBindings[0]!.path === `/api/approvals${binding[2]}`
  );
}

export function useApprovalRetentionMutation(
  key: 'retention-policy-initialize.action' | 'retention-policy-draft.action'
) {
  const dispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: `route.approvals.admin.${key}`,
    taskKind: 'ADMINISTRATION',
  });
  const available = approvalRetentionRouteInstalled(key);
  const run = useCallback(
    async <T>(execute: (execution: ApprovalMutationExecution) => Promise<T>) => {
      if (!available) throw new ProductSurfaceMutationAuthorityError();
      return dispatch(execute);
    },
    [available, dispatch]
  );
  return { available, run };
}
