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
  officialProductIds: ReadonlySet<string>
): readonly ProductPageRouteContractSource[] {
  const mountedProductIds = new Set(manifests.map((manifest) => manifest.id));
  const menuRoutes: ProductPageRouteContractSource[] = manifests
    .filter((manifest) => !officialProductIds.has(manifest.id))
    .flatMap((manifest) =>
      manifest.surfaces.flatMap((surface) =>
        surface.navigation.flatMap((group) =>
          group.items.map((item) => {
            const routeName = item.view.replace(/^admin-/u, '');
            const surfaceName = surfaceSegment(manifest.id, surface.id);
            return {
              routeId: `${manifest.id}.${surfaceName}.${routeName}`,
              pattern: item.path as `/${string}`,
              productId: manifest.id,
              surfaceId: surface.id,
              routeContractKey: `route.${manifest.id}.${surfaceName}.${routeName}.page`,
            };
          })
        )
      )
    );
  const dynamicRoutes = DYNAMIC_DRAFT_PRODUCT_PAGE_ROUTES.filter((route) =>
    mountedProductIds.has(route.productId)
  );
  return defineProductRouteContractSource([...menuRoutes, ...dynamicRoutes], manifests);
}
