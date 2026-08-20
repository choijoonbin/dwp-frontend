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
  return supportContext.data ? children : <Navigate to="/provider" replace />;
}

export function AppRouteGuard({
  resourceKey,
  requiredAnySupportScopes = [],
  children,
}: {
  resourceKey: string;
  requiredAnySupportScopes?: readonly string[];
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { permissions, isLoaded } = usePermissions();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  if (!isLoaded || (providerRole && supportContext.isLoading)) return <RouteFallback />;
  if (providerRole) {
    const supportSession = supportContext.data;
    if (!supportSession) return <Navigate to="/provider" replace />;
    return requiredAnySupportScopes.some((scope) => supportSession.scopes.includes(scope)) ? (
      children
    ) : (
      <Navigate to="/403" replace />
    );
  }
  return isAppResourceEntitled(resourceKey, permissions) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}

export function ProductRouteGuard({
  resourceKey,
  permissionCode = 'VIEW',
  requiredAnySupportScopes = [],
  children,
}: {
  resourceKey: string;
  permissionCode?: string;
  requiredAnySupportScopes?: readonly string[];
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const providerRole = hasProviderControlPlaneRole(auth.user?.roles ?? []);
  const supportContext = useProviderSupportContext(providerRole);
  if (!isLoaded || (providerRole && supportContext.isLoading)) return <RouteFallback />;
  if (providerRole) {
    const supportSession = supportContext.data;
    if (!supportSession) return <Navigate to="/provider" replace />;
    return requiredAnySupportScopes.some((scope) => supportSession.scopes.includes(scope)) ? (
      children
    ) : (
      <Navigate to="/403" replace />
    );
  }
  return hasPermission(resourceKey, permissionCode) || hasPermission(resourceKey, 'MANAGE') ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}

export function ProductAnyRouteGuard({
  authorities,
  children,
}: {
  authorities: readonly { resourceKey: string; permissionCode: string }[];
  children: React.ReactNode;
}) {
  const { hasPermission, isLoaded } = usePermissions();
  if (!isLoaded) return <RouteFallback />;
  return authorities.some(
    ({ resourceKey, permissionCode }) =>
      hasPermission(resourceKey, permissionCode) || hasPermission(resourceKey, 'MANAGE')
  ) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}
