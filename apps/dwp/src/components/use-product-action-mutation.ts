import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../routes/product-surface-authorization.generated';
import { resolveProductSurfaceTaskKind } from '../observability/product-surface-task-kind';
import { useProductSurfaceGovernedMutation } from './use-product-surface-governed-mutation';

import type { ProductSurfaceMutationBinding } from './use-product-surface-governed-mutation';

type ProductAuthorizationProjection = (typeof PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS)[number];
type ProductActionProjection = Extract<
  ProductAuthorizationProjection,
  { routeKind: 'ACTION'; subjectType: 'PRODUCT' }
>;

export type ProductActionRouteContractKey = ProductActionProjection['routeContractKey'];

const PRODUCT_ACTION_BINDINGS = new Map<
  ProductActionRouteContractKey,
  ProductSurfaceMutationBinding
>(
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
    (route): route is ProductActionProjection =>
      route.routeKind === 'ACTION' && route.subjectType === 'PRODUCT'
  ).flatMap((route) => {
    return [
      [
        route.routeContractKey,
        {
          productKey: route.productId,
          surfaceKey: route.surfaceId,
          routeContractKey: route.routeContractKey,
          taskKind: resolveProductSurfaceTaskKind({
            productKey: route.productId,
            surfaceKey: route.surfaceId,
            routeContractKey: route.routeContractKey,
          }),
        },
      ] as const,
    ];
  })
);

export function productActionMutationBinding(routeContractKey: ProductActionRouteContractKey) {
  const binding = PRODUCT_ACTION_BINDINGS.get(routeContractKey);
  if (!binding) {
    throw new Error(`Unknown governed product ACTION: ${routeContractKey}`);
  }
  return binding;
}

/**
 * Resolves a mutation exclusively through the generated ACTION registry. The returned callback
 * preserves 000/100 compatibility and requires a fresh exact route grant in 110/111.
 */
export function useProductActionMutation(routeContractKey: ProductActionRouteContractKey) {
  return useProductSurfaceGovernedMutation(productActionMutationBinding(routeContractKey));
}

export const GOVERNED_PRODUCT_ACTION_ROUTE_KEYS = Object.freeze(
  [...PRODUCT_ACTION_BINDINGS.keys()].sort()
);
