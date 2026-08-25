import {
  APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
  APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
} from '@dwp-frontend/shared-utils';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { useProductSurfaceGovernedMutation } from '../../components/use-product-surface-governed-mutation';
import { resolveProductSurfaceTaskKind } from '../../observability/product-surface-task-kind';

import type { ProductSurfaceMutationBinding } from '../../components/use-product-surface-governed-mutation';

export { isProductSurfaceOperationCancelledError } from '../../components/use-product-surface-governed-mutation';

const contracts = [
  ...APPROVAL_GOVERNED_MUTATION_API_CONTRACTS,
  APPROVAL_HOME_PREFERENCE_MUTATION_API_CONTRACT,
] as const;

export type ApprovalGovernedMutationRouteContractKey =
  (typeof contracts)[number]['routeContractKey'];

const bindings = Object.fromEntries(
  contracts.map((contract) => {
    const routes = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) =>
        route.routeContractKey === contract.routeContractKey &&
        route.routeKind === 'ACTION' &&
        route.productId === 'approvals' &&
        route.surfaceId !== null
    );
    if (routes.length !== 1) {
      throw new Error(
        `Approval governed mutation binding is invalid: ${contract.routeContractKey}`
      );
    }
    const route = routes[0]!;
    return [
      contract.routeContractKey,
      {
        productKey: 'approvals',
        surfaceKey: route.surfaceId!,
        routeContractKey: contract.routeContractKey,
        taskKind: resolveProductSurfaceTaskKind({
          productKey: 'approvals',
          surfaceKey: route.surfaceId!,
          routeContractKey: contract.routeContractKey,
        }),
      },
    ];
  })
) as Record<
  ApprovalGovernedMutationRouteContractKey,
  ProductSurfaceMutationBinding & { productKey: 'approvals' }
>;

export function useApprovalGovernedMutation(
  routeContractKey: ApprovalGovernedMutationRouteContractKey
) {
  return useProductSurfaceGovernedMutation(bindings[routeContractKey]);
}
