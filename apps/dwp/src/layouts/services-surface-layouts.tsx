import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import {
  SERVICES_MANAGEMENT_NAVIGATION,
  SERVICES_WORK_NAVIGATION,
} from '../features/services/services-navigation';
import { ProductManagementLayout } from './product-management-layout';
import { ProductWorkLayout } from './product-work-layout';

export function ServicesWorkLayout({ surface }: { surface: ProductSurfaceLayoutRuntime }) {
  return (
    <ProductWorkLayout
      areaKey="services"
      navigation={SERVICES_WORK_NAVIGATION}
      translationNamespace="services"
      surface={surface}
    />
  );
}

export function ServicesManagementLayout({ surface }: { surface: ProductSurfaceLayoutRuntime }) {
  return (
    <ProductManagementLayout
      areaKey="services"
      navigation={SERVICES_MANAGEMENT_NAVIGATION}
      translationNamespace="services"
      surface={surface}
    />
  );
}
