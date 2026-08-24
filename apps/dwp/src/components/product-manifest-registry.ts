import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';

import type { ProductSurfaceManifest } from './product-manifest';

/** Application composition root for governed manifests; product features never import siblings. */
export const GOVERNED_PRODUCT_MANIFESTS: readonly ProductSurfaceManifest[] = [
  APPROVAL_PRODUCT_MANIFEST,
  COMMUNICATIONS_PRODUCT_MANIFEST,
  SERVICES_PRODUCT_MANIFEST,
];

export function governedProductManifest(productId: string): ProductSurfaceManifest | undefined {
  return GOVERNED_PRODUCT_MANIFESTS.find((manifest) => manifest.id === productId);
}
