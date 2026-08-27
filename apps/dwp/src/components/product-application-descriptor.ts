import type {
  ProductLegacyRouteSource,
  ProductPageRouteContractSource,
} from '../routes/product-route-contract-source.ts';

export type GovernedProductBoundarySource = Readonly<{
  productId: string;
  routePrefix: `/${string}`;
}>;

export type ProductGlobalRuntimeHost = 'notifications' | 'dwaion';
export type ProductRouteProjectionMode = 'mounted-products' | 'administration-legacy-targets';

export type ProductApplicationDescriptor = Readonly<{
  applicationId: string;
  productIds: readonly string[];
  productBoundaries: readonly { id: string; basePath: `/${string}` }[];
  manifestProductIds: readonly string[];
  authorizationProductIds: readonly string[];
  includeGovernedContextAuthorization: boolean;
  routeProjectionMode: ProductRouteProjectionMode;
  officialProductIds: readonly string[];
  pageRoutes: readonly ProductPageRouteContractSource[];
  legacyRoutes: readonly ProductLegacyRouteSource[];
  sensitiveQueryPrefixes: readonly string[];
  globalRuntimeHosts: readonly ProductGlobalRuntimeHost[];
  i18nNamespaces: readonly string[];
}>;

type BuildProductApplicationDescriptorOptions = Readonly<{
  applicationId: string;
  governedProducts: readonly GovernedProductBoundarySource[];
  mountedProductIds: readonly string[];
  officialPageRoutes: readonly ProductPageRouteContractSource[];
  legacyRoutes: readonly ProductLegacyRouteSource[];
  sensitiveQueryPrefixRegistry: Readonly<Record<string, readonly string[]>>;
  globalGovernance?: boolean;
  administration?: boolean;
  includeGovernedContextAuthorization?: boolean;
  globalRuntimeHosts?: readonly ProductGlobalRuntimeHost[];
  i18nNamespaces?: readonly string[];
}>;

function legacyTargetPageRoutes(
  officialPageRoutes: readonly ProductPageRouteContractSource[],
  legacyRoutes: readonly ProductLegacyRouteSource[]
): readonly ProductPageRouteContractSource[] {
  const officialByKey = new Map(officialPageRoutes.map((route) => [route.routeContractKey, route]));
  const targets = new Map<string, ProductPageRouteContractSource>();
  for (const redirect of legacyRoutes) {
    const official = officialByKey.get(redirect.targetRouteContractKey);
    if (official) {
      targets.set(official.routeContractKey, official);
      continue;
    }
    if (!redirect.targetPath) {
      throw new Error(`Legacy route target is not registered: ${redirect.redirectId}`);
    }
    const segments = redirect.targetRouteContractKey.split('.');
    const productId = segments[1];
    const surfaceSegment = segments[2];
    if (!productId || !surfaceSegment) {
      throw new Error(`Legacy route target key is invalid: ${redirect.redirectId}`);
    }
    targets.set(redirect.targetRouteContractKey, {
      routeId: redirect.targetRouteContractKey.replace(/^route\./u, '').replace(/\.page$/u, ''),
      pattern: redirect.targetPath,
      productId,
      surfaceId: `${productId}.${surfaceSegment}`,
      routeContractKey: redirect.targetRouteContractKey,
    });
  }
  return [...targets.values()];
}

/**
 * Projects the global architecture sources into the exact governance data mounted by one app.
 * Product builds call this in Vite's Node process and serialize the result into a virtual module;
 * no global registry document is needed by the browser runtime.
 */
export function buildProductApplicationDescriptor({
  applicationId,
  governedProducts,
  mountedProductIds,
  officialPageRoutes,
  legacyRoutes,
  sensitiveQueryPrefixRegistry,
  globalGovernance = false,
  administration = false,
  includeGovernedContextAuthorization = false,
  globalRuntimeHosts = [],
  i18nNamespaces = [],
}: BuildProductApplicationDescriptorOptions): ProductApplicationDescriptor {
  const governedIds = new Set(governedProducts.map((product) => product.productId));
  if (governedIds.size !== governedProducts.length) {
    throw new Error('Governed product boundaries contain duplicate product ids.');
  }
  const mountedIds = new Set(mountedProductIds);
  if (mountedIds.size !== mountedProductIds.length) {
    throw new Error(`Application ${applicationId} contains duplicate mounted product ids.`);
  }
  for (const mountedProductId of mountedIds) {
    if (!governedIds.has(mountedProductId)) {
      throw new Error(
        `Application ${applicationId} references an unknown mounted product: ${mountedProductId}`
      );
    }
  }
  if (administration && !globalGovernance) {
    throw new Error('Administration legacy target projection requires global governance.');
  }
  const productIds = globalGovernance
    ? governedProducts.map((product) => product.productId)
    : [...mountedIds];
  const manifestProductIds = administration ? [] : [...mountedIds];
  const authorizationProductIds = administration ? [] : [...mountedIds];
  const officialProductIds = [
    ...new Set(
      officialPageRoutes
        .filter((route) => mountedIds.has(route.productId))
        .map((route) => route.productId)
    ),
  ];
  const selectedLegacyRoutes = administration
    ? legacyRoutes
    : legacyRoutes.filter((redirect) => {
        const targetProductId = redirect.targetRouteContractKey.split('.')[1];
        return targetProductId !== undefined && mountedIds.has(targetProductId);
      });
  const pageRoutes = administration
    ? legacyTargetPageRoutes(officialPageRoutes, legacyRoutes)
    : officialPageRoutes.filter((route) => mountedIds.has(route.productId));

  return {
    applicationId,
    productIds: [...new Set(productIds)],
    productBoundaries: governedProducts
      .filter((product) => productIds.includes(product.productId))
      .map((product) => ({ id: product.productId, basePath: product.routePrefix })),
    manifestProductIds,
    authorizationProductIds,
    includeGovernedContextAuthorization,
    routeProjectionMode: administration ? 'administration-legacy-targets' : 'mounted-products',
    officialProductIds,
    pageRoutes,
    legacyRoutes: selectedLegacyRoutes,
    sensitiveQueryPrefixes: productIds.flatMap(
      (productId) => sensitiveQueryPrefixRegistry[productId] ?? []
    ),
    globalRuntimeHosts: [...new Set(globalRuntimeHosts)],
    i18nNamespaces: [...new Set(i18nNamespaces)],
  };
}
