import { useCallback } from 'react';
import { APPROVAL_ATTACHMENT_ACTION_CONTRACTS } from '@dwp-frontend/shared-utils/api/approval-attachment-action-contracts';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import {
  ProductSurfaceMutationAuthorityError,
  useProductSurfaceGovernedMutation,
} from '../../components/use-product-surface-governed-mutation';

import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

type Key = (typeof APPROVAL_ATTACHMENT_ACTION_CONTRACTS)[number]['routeContractKey'];

export function approvalAttachmentRouteInstalled(
  key: string,
  method: string,
  path: string,
  kind: 'ACTION' | 'DATA'
) {
  const projections: readonly ProductAuthorizationRouteProjection[] =
    PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS;
  const matches = projections.filter((route) => route.routeContractKey === key);
  return (
    matches.length === 1 &&
    matches[0]!.productId === 'approvals' &&
    matches[0]!.surfaceId === 'approvals.work' &&
    matches[0]!.routeKind === kind &&
    matches[0]!.gatewayBindings.length === 1 &&
    matches[0]!.gatewayBindings[0]!.method === method &&
    matches[0]!.gatewayBindings[0]!.path === path
  );
}

export function useApprovalAttachmentMutation(key: Key) {
  const contract = APPROVAL_ATTACHMENT_ACTION_CONTRACTS.find(
    (entry) => entry.routeContractKey === key
  );
  const available = Boolean(
    contract && approvalAttachmentRouteInstalled(key, contract.method, contract.path, 'ACTION')
  );
  const dispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
    routeContractKey: key,
    taskKind: 'WORK',
  });
  const run = useCallback(
    async <T>(execute: (execution: ApprovalMutationExecution) => Promise<T>) => {
      if (!available) throw new ProductSurfaceMutationAuthorityError();
      return dispatch(execute);
    },
    [available, dispatch]
  );
  return { available, run };
}
