import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { ProductAreaLayout } from './product-area-layout';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';

export function ApprovalLayout({ surface }: { surface?: ProductSurfaceLayoutRuntime }) {
  return (
    <ProductAreaLayout
      areaKey="approvals"
      navigation={APPROVAL_NAVIGATION}
      translationNamespace="approvals"
      surface={surface}
    />
  );
}
