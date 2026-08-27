import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';

export function ApprovalLayout({ surface }: { surface?: ProductSurfaceLayoutRuntime }) {
  return (
    <ProductAreaLayout
      areaKey="approvals"
      manifest={APPROVAL_PRODUCT_MANIFEST}
      navigation={APPROVAL_NAVIGATION}
      translationNamespace="approvals"
      surface={surface}
    />
  );
}
