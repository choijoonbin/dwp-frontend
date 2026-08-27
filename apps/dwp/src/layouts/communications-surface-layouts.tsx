import type { ProductSurfaceLayoutRuntime } from '../components/product-surface-controls';
import type { ProductSurfaceManifest } from '../components/product-manifest';
import {
  COMMUNICATIONS_MANAGEMENT_NAVIGATION,
  COMMUNICATIONS_WORK_NAVIGATION,
} from '../features/communications/communications-navigation';
import { ProductManagementLayout } from './product-management-layout';
import { ProductWorkLayout } from './product-work-layout';

type CommunicationsSurfaceLayoutProps = {
  manifest: ProductSurfaceManifest;
  surface: ProductSurfaceLayoutRuntime;
};

export function CommunicationsWorkLayout({ manifest, surface }: CommunicationsSurfaceLayoutProps) {
  return (
    <ProductWorkLayout
      areaKey="communications"
      manifest={manifest}
      navigation={COMMUNICATIONS_WORK_NAVIGATION}
      translationNamespace="communications"
      surface={surface}
    />
  );
}

export function CommunicationsManagementLayout({
  manifest,
  surface,
}: CommunicationsSurfaceLayoutProps) {
  return (
    <ProductManagementLayout
      areaKey="communications"
      manifest={manifest}
      navigation={COMMUNICATIONS_MANAGEMENT_NAVIGATION}
      translationNamespace="communications"
      surface={surface}
    />
  );
}
