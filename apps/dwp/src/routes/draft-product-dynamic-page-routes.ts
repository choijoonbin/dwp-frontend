import type { ProductPageRouteContractSource } from './product-route-contract-source.ts';

/**
 * DRAFT detail routes which are not represented by a navigation item yet.
 * Product builds replace this module with the exact application projection so a product artifact
 * never carries another product's DRAFT route keys.
 */
export const DYNAMIC_DRAFT_PRODUCT_PAGE_ROUTES: readonly ProductPageRouteContractSource[] = [
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
    routeId: 'meetings.work.room',
    pattern: '/meetings/room/:meetingId',
    productId: 'meetings',
    surfaceId: 'meetings.work',
    routeContractKey: 'route.meetings.work.room.page',
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
