import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { ApprovalInboxQueueNavigation } from '../features/approvals/approval-inbox-queue-navigation';
import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import type { ProductAreaNavigationItemChildrenContext } from './product-area-layout';

export function renderApprovalNavigationItemChildren({
  item,
  selected,
  onNavigate,
}: ProductAreaNavigationItemChildrenContext) {
  if (item.view !== 'inbox' || !selected) return null;
  return <ApprovalInboxQueueNavigation onNavigate={onNavigate} />;
}

export function ApprovalLayout({ surface }: { surface?: ProductSurfaceLayoutRuntime }) {
  return (
    <ProductAreaLayout
      areaKey="approvals"
      manifest={APPROVAL_PRODUCT_MANIFEST}
      navigation={APPROVAL_NAVIGATION}
      translationNamespace="approvals"
      surface={surface}
      renderNavigationItemChildren={renderApprovalNavigationItemChildren}
    />
  );
}
