import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createDwaionQuestionLaunchState,
  createQuestionLaunch,
  dwaionWorkspaceRoute,
  isAppReadEntitled,
  useAuth,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';

import { DwaionLauncher } from './dwaion-launcher';
import { isDwaionGlobalHostAllowed } from './dwaion-global-host-policy';
import { resolveDwaionSurfaceContext } from './dwaion-page-context';

const hiddenRoutes = ['/sign-in', '/activate', '/403', '/dwaion', '/ask'];

export function DwaionGlobalHost() {
  const { t } = useTranslation('home');
  const auth = useAuth();
  const toast = useToast();
  const { permissions, isLoaded } = usePermissions();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const surface = useMemo(() => resolveDwaionSurfaceContext(pathname), [pathname]);
  const entitled = isDwaionGlobalHostAllowed(auth.user?.identityPlane, permissions);
  const canOpenServices = isAppReadEntitled('APP.EMPLOYEE_SERVICES', permissions);
  const canOpenPeople =
    isAppReadEntitled('APP.HCM', permissions) ||
    isAppReadEntitled('APP.PEOPLE_DIRECTORY', permissions);
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
      onOpenWorkspace={async (query, conversationId) => {
        if (conversationId || !query?.trim()) {
          navigate(dwaionWorkspaceRoute(undefined, conversationId));
          return true;
        }
        try {
          const receipt = await createQuestionLaunch(query);
          const state = createDwaionQuestionLaunchState(receipt.launchId);
          if (!state) throw new Error('Question launch receipt is invalid.');
          navigate(dwaionWorkspaceRoute(), { state });
          return true;
        } catch {
          toast.error(t('dwaion.launchUnavailable'));
          return false;
        }
      }}
      onOpenGuide={canOpenServices ? () => navigate('/services/discover') : undefined}
      onOpenContacts={canOpenPeople ? () => navigate('/hr/directory') : undefined}
      onOpenStatus={() => navigate('/apps')}
    />
  );
}
