import type { ProductActionRouteContractKey } from '../../components/use-product-action-mutation';

export const ROOM_BOOKING_ACTION_CONTRACTS = {
  create: 'route.workplace.work.room-bookings-post.action',
  update: 'route.workplace.work.room-booking-by-event-id-put.action',
  cancel: 'route.workplace.work.room-booking-cancel-post.action',
  respond: 'route.workplace.work.room-booking-response-post.action',
} as const satisfies Record<
  'create' | 'update' | 'cancel' | 'respond',
  ProductActionRouteContractKey
>;
