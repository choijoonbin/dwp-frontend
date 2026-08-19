import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAppResourceEntitled, useAuth, usePermissions } from '@dwp-frontend/shared-utils';

import { dwaionWorkspaceRoute } from './dwaion-contract';
import { DwaionLauncher } from './dwaion-launcher';
import { resolveDwaionSurfaceContext } from './dwaion-page-context';

const hiddenRoutes = ['/sign-in', '/activate', '/403', '/dwaion', '/ask'];

export function DwaionGlobalHost() {
  const auth = useAuth();
  const { permissions, isLoaded } = usePermissions();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const surface = useMemo(() => resolveDwaionSurfaceContext(pathname), [pathname]);
  const entitled = isAppResourceEntitled('APP.ASK', permissions);
  const canOpenServices = isAppResourceEntitled('APP.EMPLOYEE_SERVICES', permissions);
  const canOpenPeople =
    isAppResourceEntitled('APP.HCM', permissions) ||
    isAppResourceEntitled('APP.PEOPLE_DIRECTORY', permissions);
  const isHomeEditMode = pathname === '/' && new URLSearchParams(search).get('edit') === 'home';

  if (
    auth.isLoading ||
    !auth.isAuthenticated ||
    !isLoaded ||
    !entitled ||
    isHomeEditMode ||
    hiddenRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return null;
  }

  return (
    <DwaionLauncher
      firstName={auth.user?.displayName?.trim().split(/\s+/)[0]}
      pageContext={surface.pageContext}
      suggestionKeys={surface.suggestionKeys}
      onOpenWorkspace={(query, conversationId) =>
        navigate(dwaionWorkspaceRoute(query, conversationId))
      }
      onOpenGuide={canOpenServices ? () => navigate('/services/discover') : undefined}
      onOpenContacts={canOpenPeople ? () => navigate('/hr/directory') : undefined}
      onOpenStatus={() => navigate('/apps')}
    />
  );
}
