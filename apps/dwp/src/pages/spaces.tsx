import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ProductAdminSurface } from '../components/product-admin-surface';
import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import {
  SpaceAdminContentReviews,
  SpaceAdminDirectory,
  SpaceAdminLifecycle,
  SpaceAdminOverview,
  SpaceAdminRequests,
  SpaceAdminTemplates,
} from '../features/spaces/space-admin-page';
import { SpaceAdminOperations } from '../features/spaces/space-operations-page';
import { SpaceDetailPage } from '../features/spaces/space-detail-page';
import { SpaceDirectoryPage } from '../features/spaces/space-directory-page';
import { SpaceHomePage } from '../features/spaces/space-home-page';
import { SpaceRequestsPage } from '../features/spaces/space-requests-page';
import { findSpaceNavigationItem, findSpaceView } from '../features/spaces/space-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

import type { ReactNode } from 'react';

function SpaceAdministration({ view, children }: { view: string; children: ReactNode }) {
  const { t } = useTranslation('spaces');
  return (
    <ProductAdminSurface
      eyebrow={t('administration.eyebrow')}
      title={t(`administration.${view}.title`)}
      description={t(`administration.${view}.description`)}
    >
      {children}
    </ProductAdminSurface>
  );
}

export default function SpacesPage() {
  const { pathname } = useLocation();
  const view = findSpaceView(pathname);
  const navigationItem = findSpaceNavigationItem(pathname);

  let content: ReactNode;
  if (view === 'home') content = <SpaceHomePage />;
  else if (view === 'my-spaces') content = <SpaceDirectoryPage scope="MY" />;
  else if (view === 'discover') content = <SpaceDirectoryPage scope="DISCOVER" />;
  else if (view === 'requests') content = <SpaceRequestsPage />;
  else if (view === 'admin-overview')
    content = (
      <SpaceAdministration view="overview">
        <SpaceAdminOverview />
      </SpaceAdministration>
    );
  else if (view === 'admin-directory')
    content = (
      <SpaceAdministration view="directory">
        <SpaceAdminDirectory />
      </SpaceAdministration>
    );
  else if (view === 'admin-requests')
    content = (
      <SpaceAdministration view="requests">
        <SpaceAdminRequests />
      </SpaceAdministration>
    );
  else if (view === 'admin-templates')
    content = (
      <SpaceAdministration view="templates">
        <SpaceAdminTemplates />
      </SpaceAdministration>
    );
  else if (view === 'admin-content-reviews')
    content = (
      <SpaceAdministration view="contentReviews">
        <SpaceAdminContentReviews />
      </SpaceAdministration>
    );
  else if (view === 'admin-lifecycle')
    content = (
      <SpaceAdministration view="lifecycle">
        <SpaceAdminLifecycle />
      </SpaceAdministration>
    );
  else if (view === 'admin-operations')
    content = (
      <SpaceAdministration view="operations">
        <SpaceAdminOperations />
      </SpaceAdministration>
    );
  else {
    const match = pathname.match(/^\/spaces\/([^/]+)(?:\/(.*))?$/);
    if (!match || ['home', 'my', 'discover', 'requests', 'admin'].includes(match[1])) {
      return <ProductSurfaceLocalNotFound />;
    }
    content = (
      <SpaceDetailPage spaceKey={decodeURIComponent(match[1])} tab={match[2] || 'overview'} />
    );
  }

  return (
    <ProductAreaNavigationItemAccessGuard item={navigationItem ?? {}}>
      {content}
    </ProductAreaNavigationItemAccessGuard>
  );
}
