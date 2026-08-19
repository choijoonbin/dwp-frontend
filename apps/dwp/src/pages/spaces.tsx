import { Navigate, useLocation } from 'react-router-dom';

import { SpaceDetailPage } from '../features/spaces/space-detail-page';
import { SpaceDirectoryPage } from '../features/spaces/space-directory-page';
import { SpaceHomePage } from '../features/spaces/space-home-page';
import { SpaceRequestsPage } from '../features/spaces/space-requests-page';
import { SPACE_DEFAULT_PATH, findSpaceView } from '../features/spaces/space-navigation';

export default function SpacesPage() {
  const { pathname } = useLocation();
  const view = findSpaceView(pathname);
  if (view === 'home') return <SpaceHomePage />;
  if (view === 'my-spaces') return <SpaceDirectoryPage scope="MY" />;
  if (view === 'discover') return <SpaceDirectoryPage scope="DISCOVER" />;
  if (view === 'requests') return <SpaceRequestsPage />;

  const match = pathname.match(/^\/spaces\/([^/]+)(?:\/(.*))?$/);
  if (match && !['home', 'my', 'discover', 'requests'].includes(match[1])) {
    return <SpaceDetailPage spaceKey={decodeURIComponent(match[1])} tab={match[2] || 'overview'} />;
  }
  return <Navigate to={SPACE_DEFAULT_PATH} replace />;
}
