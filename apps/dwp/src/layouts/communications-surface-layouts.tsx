import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import {
  COMMUNICATIONS_MANAGEMENT_NAVIGATION,
  COMMUNICATIONS_WORK_NAVIGATION,
} from '../features/communications/communications-navigation';
import { ProductManagementLayout } from './product-management-layout';
import { ProductWorkLayout } from './product-work-layout';

export function CommunicationsWorkLayout({ surface }: { surface: ProductSurfaceLayoutRuntime }) {
  return (
    <ProductWorkLayout
      areaKey="communications"
      navigation={COMMUNICATIONS_WORK_NAVIGATION}
      translationNamespace="communications"
      surface={surface}
    />
  );
}

export function CommunicationsManagementLayout({
  surface,
}: {
  surface: ProductSurfaceLayoutRuntime;
}) {
  return (
    <ProductManagementLayout
      areaKey="communications"
      navigation={COMMUNICATIONS_MANAGEMENT_NAVIGATION}
      translationNamespace="communications"
      surface={surface}
    />
  );
}
