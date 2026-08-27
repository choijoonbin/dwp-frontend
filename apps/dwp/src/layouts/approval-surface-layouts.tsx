import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import type { ProductSurfaceManifest } from '../components/product-manifest';
import {
  APPROVAL_MANAGEMENT_NAVIGATION,
  APPROVAL_WORK_NAVIGATION,
} from '../features/approvals/approval-navigation';
import { ProductManagementLayout } from './product-management-layout';
import { ProductWorkLayout } from './product-work-layout';

type ApprovalSurfaceLayoutProps = {
  manifest: ProductSurfaceManifest;
  surface: ProductSurfaceLayoutRuntime;
};

export function ApprovalWorkLayout({ manifest, surface }: ApprovalSurfaceLayoutProps) {
  return (
    <ProductWorkLayout
      areaKey="approvals"
      manifest={manifest}
      navigation={APPROVAL_WORK_NAVIGATION}
      translationNamespace="approvals"
      surface={surface}
    />
  );
}

export function ApprovalManagementLayout({ manifest, surface }: ApprovalSurfaceLayoutProps) {
  return (
    <ProductManagementLayout
      areaKey="approvals"
      manifest={manifest}
      navigation={APPROVAL_MANAGEMENT_NAVIGATION}
      translationNamespace="approvals"
      surface={surface}
    />
  );
}
