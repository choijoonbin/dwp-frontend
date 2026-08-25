import { GOVERNED_PRODUCT_MANIFESTS } from '../components/product-manifest-registry';
import {
  defineProductRouteContractSource,
  type ProductPageRouteContractSource,
} from './product-route-contract-source';

const OFFICIAL_PRODUCT_IDS = new Set(['approvals', 'communications', 'hcm', 'services']);

function surfaceSegment(productId: string, surfaceId: string): string {
  return surfaceId.startsWith(`${productId}.`) ? surfaceId.slice(productId.length + 1) : surfaceId;
}

const menuRoutes: ProductPageRouteContractSource[] = GOVERNED_PRODUCT_MANIFESTS.filter(
  (manifest) => !OFFICIAL_PRODUCT_IDS.has(manifest.id)
).flatMap((manifest) =>
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

const dynamicRoutes: ProductPageRouteContractSource[] = [
  {
    routeId: 'dwaion.work.conversation-detail',
    pattern: '/dwaion/conversations/:conversationId',
    productId: 'dwaion',
    surfaceId: 'dwaion.work',
    routeContractKey: 'route.dwaion.work.conversation-detail.page',
  },
  {
    routeId: 'notifications.work.notification-detail',
    pattern: '/notifications/center/:notificationId',
    productId: 'notifications',
    surfaceId: 'notifications.work',
    routeContractKey: 'route.notifications.work.notification-detail.page',
  },
  {
    routeId: 'spaces.work.space-detail',
    pattern: '/spaces/:spaceKey',
    productId: 'spaces',
    surfaceId: 'spaces.work',
    routeContractKey: 'route.spaces.work.space-detail.page',
  },
  {
    routeId: 'spaces.work.space-detail-tab',
    pattern: '/spaces/:spaceKey/:tab',
    productId: 'spaces',
    surfaceId: 'spaces.work',
    routeContractKey: 'route.spaces.work.space-detail-tab.page',
  },
];

/**
 * Frontend-owned DRAFT routes for W2/W3. They remain fail-closed in 110/111 until the backend
 * publishes matching product flags, contexts, and exact route decisions.
 */
export const DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE = defineProductRouteContractSource(
  [...menuRoutes, ...dynamicRoutes],
  GOVERNED_PRODUCT_MANIFESTS
);
