import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@dwp-frontend/shared-utils';

import { ProductAdminSurface } from '../components/product-admin-surface';
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
import {
  SPACE_DEFAULT_PATH,
  findSpaceNavigationItem,
  findSpaceView,
} from '../features/spaces/space-navigation';

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
  const { hasPermission, isLoaded } = usePermissions();
  const view = findSpaceView(pathname);
  const navigationItem = findSpaceNavigationItem(pathname);

  if (!isLoaded) return null;
  if (
    navigationItem?.requiredResourceKey &&
    !hasPermission(navigationItem.requiredResourceKey, navigationItem.requiredPermissionCode)
  ) {
    return <Navigate to="/403" replace />;
  }
  if (view === 'home') return <SpaceHomePage />;
  if (view === 'my-spaces') return <SpaceDirectoryPage scope="MY" />;
  if (view === 'discover') return <SpaceDirectoryPage scope="DISCOVER" />;
  if (view === 'requests') return <SpaceRequestsPage />;
  if (view === 'admin-overview')
    return (
      <SpaceAdministration view="overview">
        <SpaceAdminOverview />
      </SpaceAdministration>
    );
  if (view === 'admin-directory')
    return (
      <SpaceAdministration view="directory">
        <SpaceAdminDirectory />
      </SpaceAdministration>
    );
  if (view === 'admin-requests')
    return (
      <SpaceAdministration view="requests">
        <SpaceAdminRequests />
      </SpaceAdministration>
    );
  if (view === 'admin-templates')
    return (
      <SpaceAdministration view="templates">
        <SpaceAdminTemplates />
      </SpaceAdministration>
    );
  if (view === 'admin-content-reviews')
    return (
      <SpaceAdministration view="contentReviews">
        <SpaceAdminContentReviews />
      </SpaceAdministration>
    );
  if (view === 'admin-lifecycle')
    return (
      <SpaceAdministration view="lifecycle">
        <SpaceAdminLifecycle />
      </SpaceAdministration>
    );
  if (view === 'admin-operations')
    return (
      <SpaceAdministration view="operations">
        <SpaceAdminOperations />
      </SpaceAdministration>
    );

  const match = pathname.match(/^\/spaces\/([^/]+)(?:\/(.*))?$/);
  if (match && !['home', 'my', 'discover', 'requests', 'admin'].includes(match[1])) {
    return <SpaceDetailPage spaceKey={decodeURIComponent(match[1])} tab={match[2] || 'overview'} />;
  }
  return <Navigate to={SPACE_DEFAULT_PATH} replace />;
}
