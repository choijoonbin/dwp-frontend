import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { isAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { hasProviderControlPlaneRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';

import { ShellBootScreen } from '../components/shell-boot-screen';

export function RouteFallback() {
  const { t } = useTranslation('common');
  return (
    <Box sx={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={28} aria-label={t('labels.loadingPage')} />
    </Box>
  );
}

export const routeFallback = <RouteFallback />;
export const authenticationFallback = <ShellBootScreen />;

export function WorkspaceRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  if (providerRole && supportContext.isLoading) return <RouteFallback />;
  if (!providerRole) return children;
  return supportContext.data ? (
    <Navigate to="/admin" replace />
  ) : (
    <Navigate to="/provider" replace />
  );
}

export function AppRouteGuard({
  resourceKey,
  children,
}: {
  resourceKey: string;
  children: React.ReactNode;
}) {
  const { permissions } = usePermissions();
  return isAppResourceEntitled(resourceKey, permissions) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}
