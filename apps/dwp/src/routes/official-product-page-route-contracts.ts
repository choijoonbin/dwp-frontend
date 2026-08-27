import routerSource from '../../../../architecture/product-page-routes.v1.json';

import {
  defineProductRouteContractSource,
  type ProductPageRouteContractSource,
} from './product-route-contract-source';

type ProductPageRouterSourceDocument = {
  schemaVersion: 1;
  sourceKey: 'product-page-routes.v1';
  pageRoutes: readonly ProductPageRouteContractSource[];
};

const PRODUCT_PAGE_ROUTER_SOURCE = routerSource as ProductPageRouterSourceDocument;

/** Backend-authorized PAGE metadata. This module deliberately has no product-feature imports. */
export const OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE = defineProductRouteContractSource(
  PRODUCT_PAGE_ROUTER_SOURCE.pageRoutes
);

export const OFFICIAL_PRODUCT_IDS = Object.freeze([
  ...new Set(OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.map((route) => route.productId)),
]);

export function officialProductPageRelativePattern(
  routeContractKey: string,
  parentPath: `/${string}`
): string {
  const matches = OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
    (route) => route.routeContractKey === routeContractKey
  );
  if (matches.length !== 1) {
    throw new Error(
      `Official product PAGE route resolved ${matches.length} records: ${routeContractKey}`
    );
  }
  const route = matches[0]!;
  const prefix = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  if (!route.pattern.startsWith(prefix)) {
    throw new Error(
      `Product PAGE route is outside Router parent ${parentPath}: ${routeContractKey}`
    );
  }
  return route.pattern.slice(prefix.length);
}
