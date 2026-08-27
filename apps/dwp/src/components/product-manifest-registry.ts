import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { CALENDAR_PRODUCT_MANIFEST } from '../features/calendar/calendar-product-manifest';
import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import { DWAION_SURFACE_MANIFEST } from '../features/dwaion/dwaion-product-manifest';
import { HCM_PRODUCT_MANIFEST } from '../features/hcm/hcm-product-manifest';
import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { MEETINGS_PRODUCT_MANIFEST } from '../features/meetings/meetings-product-manifest';
import { MESSAGING_PRODUCT_MANIFEST } from '../features/messaging/messaging-product-manifest';
import { NOTIFICATION_PRODUCT_MANIFEST } from '../features/notifications/notification-product-manifest';
import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';
import { SPACE_PRODUCT_MANIFEST } from '../features/spaces/space-product-manifest';

import type { ProductSurfaceManifest } from './product-manifest';

/** Application composition root for governed manifests; product features never import siblings. */
export const GOVERNED_PRODUCT_MANIFESTS: readonly ProductSurfaceManifest[] = [
  APPROVAL_PRODUCT_MANIFEST,
  CALENDAR_PRODUCT_MANIFEST,
  COMMUNICATIONS_PRODUCT_MANIFEST,
  DWAION_SURFACE_MANIFEST,
  HCM_PRODUCT_MANIFEST,
  MAIL_PRODUCT_MANIFEST,
  MEETINGS_PRODUCT_MANIFEST,
  MESSAGING_PRODUCT_MANIFEST,
  NOTIFICATION_PRODUCT_MANIFEST,
  SERVICES_PRODUCT_MANIFEST,
  SPACE_PRODUCT_MANIFEST,
  WORKPLACE_PRODUCT_MANIFEST,
];

export function governedProductManifest(productId: string): ProductSurfaceManifest | undefined {
  return GOVERNED_PRODUCT_MANIFESTS.find((manifest) => manifest.id === productId);
}
