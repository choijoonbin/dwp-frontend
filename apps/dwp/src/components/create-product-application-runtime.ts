import type { ProductApplicationDescriptor } from './product-application-descriptor';
import type { ProductApplicationRuntime } from './product-application-runtime';
import type { ProductSurfaceManifest } from './product-manifest';
import { buildProductPageRouteContractSource } from '../routes/draft-product-page-route-contract-source';
import {
  defineProductLegacyRouteSource,
  defineProductRouteContractSource,
  generateRegisteredProductRouteCatalog,
} from '../routes/product-route-contract-source';

function assertExactManifestClosure(
  descriptor: ProductApplicationDescriptor,
  productManifests: readonly ProductSurfaceManifest[]
): void {
  const expectedIds = new Set(descriptor.manifestProductIds);
  if (expectedIds.size !== descriptor.manifestProductIds.length) {
    throw new Error(
      `Product application descriptor has duplicate manifest ids: ${descriptor.applicationId}`
    );
  }
  const receivedIds = productManifests.map((manifest) => manifest.id);
  const receivedIdSet = new Set(receivedIds);
  if (
    receivedIdSet.size !== receivedIds.length ||
    receivedIds.length !== expectedIds.size ||
    receivedIds.some((productId) => !expectedIds.has(productId))
  ) {
    throw new Error(
      `Product application manifest closure mismatch for ${descriptor.applicationId}: expected [${[
        ...expectedIds,
      ].join(', ')}], received [${receivedIds.join(', ')}]`
    );
  }

  const boundaries = new Map(
    descriptor.productBoundaries.map((boundary) => [boundary.id, boundary.basePath])
  );
  for (const manifest of productManifests) {
    const expectedBasePath = boundaries.get(manifest.id);
    if (!expectedBasePath || expectedBasePath !== manifest.basePath) {
      throw new Error(
        `Product application manifest boundary mismatch for ${manifest.id}: expected ${
          expectedBasePath ?? '<missing>'
        }, received ${manifest.basePath}`
      );
    }
  }

  if (descriptor.routeProjectionMode === 'mounted-products') {
    const foreignRoute = descriptor.pageRoutes.find((route) => !expectedIds.has(route.productId));
    if (foreignRoute) {
      throw new Error(
        `Product application descriptor contains a foreign PAGE route: ${foreignRoute.routeContractKey}`
      );
    }
  } else if (
    descriptor.routeProjectionMode !== 'administration-legacy-targets' ||
    descriptor.manifestProductIds.length > 0 ||
    descriptor.authorizationProductIds.length > 0
  ) {
    throw new Error(
      `Product application descriptor has an invalid route projection mode: ${descriptor.applicationId}`
    );
  }
}

export function createProductApplicationRuntime(
  descriptor: ProductApplicationDescriptor,
  productManifests: readonly ProductSurfaceManifest[] = []
): ProductApplicationRuntime {
  assertExactManifestClosure(descriptor, productManifests);
  const pageRoutes =
    descriptor.routeProjectionMode === 'administration-legacy-targets'
      ? defineProductRouteContractSource(descriptor.pageRoutes)
      : buildProductPageRouteContractSource(productManifests, descriptor.pageRoutes);
  const targetKeys = new Set(pageRoutes.map((route) => route.routeContractKey));
  const legacyRoutes = defineProductLegacyRouteSource(
    descriptor.legacyRoutes.filter((redirect) => targetKeys.has(redirect.targetRouteContractKey)),
    pageRoutes
  );

  return Object.freeze({
    applicationId: descriptor.applicationId,
    productIds: Object.freeze([...descriptor.productIds]),
    productBoundaries: Object.freeze([...descriptor.productBoundaries]),
    manifestProductIds: Object.freeze([...descriptor.manifestProductIds]),
    authorizationProductIds: Object.freeze([...descriptor.authorizationProductIds]),
    includeGovernedContextAuthorization: descriptor.includeGovernedContextAuthorization,
    routeProjectionMode: descriptor.routeProjectionMode,
    productManifests: Object.freeze([...productManifests]),
    pageRoutes: Object.freeze([...pageRoutes]),
    registeredRoutes: Object.freeze([...generateRegisteredProductRouteCatalog(pageRoutes)]),
    legacyRoutes: Object.freeze([...legacyRoutes]),
    sensitiveQueryPrefixes: Object.freeze([...descriptor.sensitiveQueryPrefixes]),
    globalRuntimeHosts: Object.freeze([...descriptor.globalRuntimeHosts]),
    i18nNamespaces: Object.freeze([...descriptor.i18nNamespaces]),
  });
}
