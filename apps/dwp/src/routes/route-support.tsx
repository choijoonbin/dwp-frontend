import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { isAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import { ShellBootScreen } from '../components/shell-boot-screen';
import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import {
  exactProductRouteAllowsLegacyAdminGuard,
  useOptionalAllowedExactProductRoute,
} from '../features/shell/allowed-product-surface-context';

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
  const providerRole = isProviderIdentity(auth.user);
  return providerRole ? <Navigate to="/provider" replace /> : children;
}

export function AppRouteGuard({
  resourceKey,
  children,
}: {
  resourceKey: string;
  requiredAnySupportScopes?: readonly string[];
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { permissions, isLoaded } = usePermissions();
  const providerRole = isProviderIdentity(auth.user);
  if (!isLoaded) return <RouteFallback />;
  if (providerRole) return <Navigate to="/provider" replace />;
  return isAppResourceEntitled(resourceKey, permissions) ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}

export function ProductRouteGuard({
  resourceKey,
  permissionCode = 'VIEW',
  localDeny = false,
  children,
}: {
  resourceKey: string;
  permissionCode?: string;
  requiredAnySupportScopes?: readonly string[];
  localDeny?: boolean;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const providerRole = isProviderIdentity(auth.user);
  const exactRouteDecision = useOptionalAllowedExactProductRoute();
  if (providerRole) {
    return localDeny ? (
      <ProductSurfaceAccessState decision={{ state: 'support-scope-denied' }} />
    ) : (
      <Navigate to="/provider" replace />
    );
  }
  if (exactProductRouteAllowsLegacyAdminGuard(exactRouteDecision, [resourceKey])) {
    return children;
  }
  if (!isLoaded) return <RouteFallback />;
  if (hasPermission(resourceKey, permissionCode) || hasPermission(resourceKey, 'MANAGE')) {
    return children;
  }
  return localDeny ? (
    <ProductSurfaceAccessState decision={{ state: 'route-denied' }} />
  ) : (
    <Navigate to="/403" replace />
  );
}

export function ProductAnyRouteGuard({
  authorities,
  localDeny = false,
  children,
}: {
  authorities: readonly { resourceKey: string; permissionCode: string }[];
  localDeny?: boolean;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const providerRole = isProviderIdentity(auth.user);
  const exactRouteDecision = useOptionalAllowedExactProductRoute();
  if (providerRole) {
    return localDeny ? (
      <ProductSurfaceAccessState decision={{ state: 'support-scope-denied' }} />
    ) : (
      <Navigate to="/provider" replace />
    );
  }
  if (
    exactProductRouteAllowsLegacyAdminGuard(
      exactRouteDecision,
      authorities.map(({ resourceKey }) => resourceKey)
    )
  ) {
    return children;
  }
  if (!isLoaded) return <RouteFallback />;
  const allowed = authorities.some(
    ({ resourceKey, permissionCode }) =>
      hasPermission(resourceKey, permissionCode) || hasPermission(resourceKey, 'MANAGE')
  );
  if (allowed) return children;
  return localDeny ? (
    <ProductSurfaceAccessState decision={{ state: 'route-denied' }} />
  ) : (
    <Navigate to="/403" replace />
  );
}
