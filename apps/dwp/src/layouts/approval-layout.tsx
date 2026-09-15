import { lazy, Suspense } from 'react';

import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import type { ProductAreaNavigationItemChildrenContext } from './product-area-layout';

const ApprovalInboxQueueNavigation = lazy(() =>
  import('../features/approvals/approval-inbox-queue-navigation').then((module) => ({
    default: module.ApprovalInboxQueueNavigation,
  }))
);

export function renderApprovalNavigationItemChildren({
  item,
  selected,
  onNavigate,
  onNavigateToTarget,
}: ProductAreaNavigationItemChildrenContext) {
  if (item.view !== 'inbox' || !selected) return null;
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ minHeight: 156 }} />}>
      <ApprovalInboxQueueNavigation
        onNavigate={onNavigate}
        onNavigateToTarget={onNavigateToTarget}
      />
    </Suspense>
  );
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
