import routerSource from '../../../../architecture/product-page-routes.v1.json';
import { DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './draft-product-page-route-contracts';

import {
  defineProductLegacyRouteSource,
  defineProductRouteContractSource,
  generateRegisteredProductRouteCatalog,
  type ProductLegacyRouteSource,
  type ProductPageRouteContractSource,
} from './product-route-contract-source';

type ProductPageRouterSourceDocument = {
  schemaVersion: 1;
  sourceKey: 'product-page-routes.v1';
  pageRoutes: readonly ProductPageRouteContractSource[];
  legacyRedirects: readonly ProductLegacyRouteSource[];
};

const PRODUCT_PAGE_ROUTER_SOURCE = routerSource as ProductPageRouterSourceDocument;

/** Frontend Router-owned PAGE metadata. It intentionally excludes authorization and API bindings. */
export const PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE = defineProductRouteContractSource(
  PRODUCT_PAGE_ROUTER_SOURCE.pageRoutes
);

export const ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE = defineProductRouteContractSource([
  ...PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  ...DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
]);

export const PRODUCT_LEGACY_ROUTE_SOURCE = defineProductLegacyRouteSource(
  PRODUCT_PAGE_ROUTER_SOURCE.legacyRedirects,
  PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
);

export const REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG = generateRegisteredProductRouteCatalog(
  ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
);

export function requireProductPageRouteContract(routeContractKey: string) {
  const matches = ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
    (route) => route.routeContractKey === routeContractKey
  );
  if (matches.length !== 1) {
    throw new Error(
      `Product PAGE route contract resolved ${matches.length} records: ${routeContractKey}`
    );
  }
  return matches[0]!;
}

export function productPageRelativePattern(
  routeContractKey: string,
  parentPath: `/${string}`
): string {
  const route = requireProductPageRouteContract(routeContractKey);
  const prefix = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  if (!route.pattern.startsWith(prefix)) {
    throw new Error(
      `Product PAGE route is outside Router parent ${parentPath}: ${routeContractKey}`
    );
  }
  return route.pattern.slice(prefix.length);
}
