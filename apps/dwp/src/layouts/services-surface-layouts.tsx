import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import type { ProductSurfaceManifest } from '../components/product-manifest';
import {
  SERVICES_MANAGEMENT_NAVIGATION,
  SERVICES_WORK_NAVIGATION,
} from '../features/services/services-navigation';
import { ProductManagementLayout } from './product-management-layout';
import { ProductWorkLayout } from './product-work-layout';

type ServicesSurfaceLayoutProps = {
  manifest: ProductSurfaceManifest;
  surface: ProductSurfaceLayoutRuntime;
};

export function ServicesWorkLayout({ manifest, surface }: ServicesSurfaceLayoutProps) {
  return (
    <ProductWorkLayout
      areaKey="services"
      manifest={manifest}
      navigation={SERVICES_WORK_NAVIGATION}
      translationNamespace="services"
      surface={surface}
    />
  );
}

export function ServicesManagementLayout({ manifest, surface }: ServicesSurfaceLayoutProps) {
  return (
    <ProductManagementLayout
      areaKey="services"
      manifest={manifest}
      navigation={SERVICES_MANAGEMENT_NAVIGATION}
      translationNamespace="services"
      surface={surface}
    />
  );
}
