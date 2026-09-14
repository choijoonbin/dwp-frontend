import { lazy, Suspense } from 'react';

import { ROOMS_NAVIGATION } from '../features/rooms/rooms-navigation';
import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { ProductAreaLayout } from './product-area-layout';

import type { ProductAreaNavigationItemChildrenContext } from './product-area-layout';

const WorkplaceNavigationSubviews = lazy(() =>
  import('../features/rooms/workplace-navigation-subviews').then((module) => ({
    default: module.WorkplaceNavigationSubviews,
  }))
);

function renderWorkplaceNavigationSubviews(context: ProductAreaNavigationItemChildrenContext) {
  if (
    !['home', 'admin-overview', 'admin-operations', 'admin-governance'].includes(context.item.view)
  )
    return null;
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ minHeight: 108 }} />}>
      <WorkplaceNavigationSubviews {...context} />
    </Suspense>
  );
}

export function RoomsLayout() {
  return (
    <ProductAreaLayout
      areaKey="rooms"
      manifest={WORKPLACE_PRODUCT_MANIFEST}
      navigation={ROOMS_NAVIGATION}
      translationNamespace="rooms"
      renderNavigationItemChildren={renderWorkplaceNavigationSubviews}
      navigationChildrenPresentation="inline"
      mobileSurfaceNavigation="drawer"
    />
  );
}
