import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import {
  APPROVAL_MANAGEMENT_NAVIGATION,
  APPROVAL_WORK_NAVIGATION,
} from '../features/approvals/approval-navigation';
import { ProductManagementLayout } from './product-management-layout';
import { ProductWorkLayout } from './product-work-layout';

export function ApprovalWorkLayout({ surface }: { surface: ProductSurfaceLayoutRuntime }) {
  return (
    <ProductWorkLayout
      areaKey="approvals"
      navigation={APPROVAL_WORK_NAVIGATION}
      translationNamespace="approvals"
      surface={surface}
    />
  );
}

export function ApprovalManagementLayout({ surface }: { surface: ProductSurfaceLayoutRuntime }) {
  return (
    <ProductManagementLayout
      areaKey="approvals"
      navigation={APPROVAL_MANAGEMENT_NAVIGATION}
      translationNamespace="approvals"
      surface={surface}
    />
  );
}
