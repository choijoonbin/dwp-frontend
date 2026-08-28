import type { ProductSurfaceManifest } from '../components/product-manifest';
import { DYNAMIC_DRAFT_PRODUCT_PAGE_ROUTES } from './draft-product-dynamic-page-routes';
import {
  defineProductRouteContractSource,
  type ProductPageRouteContractSource,
} from './product-route-contract-source';

function surfaceSegment(productId: string, surfaceId: string): string {
  return surfaceId.startsWith(`${productId}.`) ? surfaceId.slice(productId.length + 1) : surfaceId;
}

/**
 * Builds DRAFT PAGE contracts only from the manifests mounted by the current application.
 * This is the product-runtime path; the full registry is composed in a separate module.
 */
export function buildDraftProductPageRouteContractSource(
  manifests: readonly ProductSurfaceManifest[],
  officialRoutes: readonly ProductPageRouteContractSource[]
): readonly ProductPageRouteContractSource[] {
  const mountedProductIds = new Set(manifests.map((manifest) => manifest.id));
  const officialRouteIds = new Set(officialRoutes.map((route) => route.routeId));
  const officialRoutePatterns = new Set(officialRoutes.map((route) => route.pattern));
  const menuRoutes: ProductPageRouteContractSource[] = manifests.flatMap((manifest) =>
    manifest.surfaces.flatMap((surface) =>
      surface.navigation.flatMap((group) =>
        group.items.flatMap((item) => {
          const routeName = item.view.replace(/^admin-/u, '');
          const surfaceName = surfaceSegment(manifest.id, surface.id);
          const route = {
            routeId: `${manifest.id}.${surfaceName}.${routeName}`,
            pattern: item.path as `/${string}`,
            productId: manifest.id,
            surfaceId: surface.id,
            routeContractKey: `route.${manifest.id}.${surfaceName}.${routeName}.page`,
          };
          return officialRouteIds.has(route.routeId) || officialRoutePatterns.has(route.pattern)
            ? []
            : [route];
        })
      )
    )
  );
  const dynamicRoutes = DYNAMIC_DRAFT_PRODUCT_PAGE_ROUTES.filter((route) =>
    mountedProductIds.has(route.productId)
  );
  return defineProductRouteContractSource([...menuRoutes, ...dynamicRoutes], manifests);
}

/**
 * Composes official PAGE records with the still-DRAFT manifest routes for mounted products.
 * Promotion is route-scoped: one representative PAGE must not hide the rest of a product's
 * navigation.
 */
export function buildProductPageRouteContractSource(
  manifests: readonly ProductSurfaceManifest[],
  officialRoutes: readonly ProductPageRouteContractSource[]
): readonly ProductPageRouteContractSource[] {
  const mountedProductIds = new Set(manifests.map((manifest) => manifest.id));
  return defineProductRouteContractSource(
    [
      ...officialRoutes.filter((route) => mountedProductIds.has(route.productId)),
      ...buildDraftProductPageRouteContractSource(manifests, officialRoutes),
    ],
    manifests
  );
}
