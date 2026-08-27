import applicationArchitecture from '../../../../architecture/frontend-apps.json';
import routerSource from '../../../../architecture/product-page-routes.v1.json';

import { createProductApplicationRuntime } from './create-product-application-runtime';
import {
  buildProductApplicationDescriptor,
  type GovernedProductBoundarySource,
} from './product-application-descriptor';
import type { ProductApplicationRuntime } from './product-application-runtime';
import type { ProductSurfaceManifest } from './product-manifest';
import { GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES } from './product-sensitive-query-prefixes';
import type {
  ProductLegacyRouteSource,
  ProductPageRouteContractSource,
} from '../routes/product-route-contract-source';

type FrontendArchitecture = {
  governedProductSurfaces: readonly GovernedProductBoundarySource[];
};

type RouterSource = {
  pageRoutes: readonly ProductPageRouteContractSource[];
  legacyRedirects: readonly ProductLegacyRouteSource[];
};

const architecture = applicationArchitecture as FrontendArchitecture;
const routes = routerSource as RouterSource;

/** Full-registry adapter for the monolithic shell and company administration composition only. */
export function createGlobalProductApplicationRuntime(
  applicationId: 'shell' | 'administration',
  productManifests: readonly ProductSurfaceManifest[] = []
): ProductApplicationRuntime {
  const descriptor = buildProductApplicationDescriptor({
    applicationId,
    governedProducts: architecture.governedProductSurfaces,
    mountedProductIds:
      applicationId === 'administration'
        ? architecture.governedProductSurfaces.map((product) => product.productId)
        : productManifests.map((manifest) => manifest.id),
    officialPageRoutes: routes.pageRoutes,
    legacyRoutes: routes.legacyRedirects,
    sensitiveQueryPrefixRegistry: GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES,
    globalGovernance: true,
    administration: applicationId === 'administration',
    includeGovernedContextAuthorization: applicationId === 'shell',
    globalRuntimeHosts: applicationId === 'shell' ? ['notifications', 'dwaion'] : [],
  });
  return createProductApplicationRuntime(descriptor, productManifests);
}
