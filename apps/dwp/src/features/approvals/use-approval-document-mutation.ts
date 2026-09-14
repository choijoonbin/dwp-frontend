import { useCallback } from 'react';
import { APPROVAL_DOCUMENT_ACTION_CONTRACTS } from '@dwp-frontend/shared-utils/api/approval-document-action-contracts';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import {
  ProductSurfaceMutationAuthorityError,
  useProductSurfaceGovernedMutation,
} from '../../components/use-product-surface-governed-mutation';

import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

type Key = (typeof APPROVAL_DOCUMENT_ACTION_CONTRACTS)[number]['routeContractKey'];
export function approvalDocumentActionInstalled(key: Key) {
  const contract = APPROVAL_DOCUMENT_ACTION_CONTRACTS.find(
    (value) => value.routeContractKey === key
  )!;
  const surface = key.startsWith('route.approvals.admin.') ? 'approvals.admin' : 'approvals.work';
  const projections: readonly ProductAuthorizationRouteProjection[] =
    PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS;
  const matches = projections.filter((route) => route.routeContractKey === key);
  return (
    matches.length === 1 &&
    matches[0]!.routeKind === 'ACTION' &&
    matches[0]!.productId === 'approvals' &&
    matches[0]!.surfaceId === surface &&
    matches[0]!.gatewayBindings.length === 1 &&
    matches[0]!.gatewayBindings[0]!.method === contract.method &&
    matches[0]!.gatewayBindings[0]!.path === contract.path
  );
}
export function useApprovalDocumentMutation(key: Key) {
  const admin = key.startsWith('route.approvals.admin.');
  const dispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: admin ? 'approvals.admin' : 'approvals.work',
    routeContractKey: key,
    taskKind: admin ? 'ADMINISTRATION' : 'WORK',
  });
  const available = approvalDocumentActionInstalled(key);
  const run = useCallback(
    async <T>(execute: (execution: ApprovalMutationExecution) => Promise<T>) => {
      if (!available) throw new ProductSurfaceMutationAuthorityError();
      return dispatch(execute);
    },
    [available, dispatch]
  );
  return { available, run };
}
