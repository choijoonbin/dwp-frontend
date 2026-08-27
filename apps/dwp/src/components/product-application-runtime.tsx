import { createContext, useContext, type PropsWithChildren } from 'react';

import type { ProductSurfaceManifest } from './product-manifest';
import type { ProductGlobalRuntimeHost } from './product-application-descriptor';
import type { ProductRouteProjectionMode } from './product-application-descriptor';
import type {
  ProductLegacyRouteSource,
  ProductPageRouteContractSource,
  RegisteredProductRoute,
} from '../routes/product-route-contract-source';

export type ProductApplicationRuntime = Readonly<{
  applicationId: string;
  productIds: readonly string[];
  productBoundaries: readonly { id: string; basePath: `/${string}` }[];
  manifestProductIds: readonly string[];
  authorizationProductIds: readonly string[];
  includeGovernedContextAuthorization: boolean;
  routeProjectionMode: ProductRouteProjectionMode;
  productManifests: readonly ProductSurfaceManifest[];
  pageRoutes: readonly ProductPageRouteContractSource[];
  registeredRoutes: readonly RegisteredProductRoute[];
  legacyRoutes: readonly ProductLegacyRouteSource[];
  sensitiveQueryPrefixes: readonly string[];
  globalRuntimeHosts: readonly ProductGlobalRuntimeHost[];
  i18nNamespaces: readonly string[];
}>;

const ProductApplicationRuntimeContext = createContext<ProductApplicationRuntime | null>(null);

export function ProductApplicationRuntimeProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: ProductApplicationRuntime }>) {
  return (
    <ProductApplicationRuntimeContext.Provider value={runtime}>
      {children}
    </ProductApplicationRuntimeContext.Provider>
  );
}

export function useProductApplicationRuntime(): ProductApplicationRuntime {
  const runtime = useContext(ProductApplicationRuntimeContext);
  if (!runtime) throw new Error('Product application runtime is not available.');
  return runtime;
}

export function useRuntimeProductManifest(productId: string): ProductSurfaceManifest | undefined {
  return useProductApplicationRuntime().productManifests.find(
    (manifest) => manifest.id === productId
  );
}
