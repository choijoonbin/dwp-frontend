import { lazy, Suspense } from 'react';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { Navigate, useParams, type RouteObject } from 'react-router-dom';

import {
  isAccountSettingsSectionAvailable,
  isSettingsSection,
  resolveProviderAccountRouteDecision,
} from '../features/account/settings-navigation';
import { authenticationFallback, RouteFallback, routeFallback } from './route-support';

const AccountLayout = lazy(() =>
  import('../layouts/account-layout').then((module) => ({ default: module.AccountLayout }))
);
const ProfilePage = lazy(() => import('../pages/account/profile'));
const SettingsPage = lazy(() => import('../pages/account/settings'));
const SecurityPage = lazy(() => import('../pages/account/security'));

function ProviderAccountRouteGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const providerAccount = isProviderIdentity(auth.user);
  const supportContext = useProviderSupportContext(providerAccount);
  const decision = resolveProviderAccountRouteDecision({
    providerAccount,
    supportLoading: supportContext.isLoading,
    supportError: supportContext.isError,
    hasActiveSupport: Boolean(supportContext.data),
  });
  if (decision === 'loading') return <RouteFallback />;
  if (decision === 'redirect-support') return <Navigate to="/provider/support" replace />;
  return children;
}

function AccountSettingsSectionGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { section } = useParams();
  const providerAccount = isProviderIdentity(auth.user);
  if (
    providerAccount &&
    isSettingsSection(section) &&
    !isAccountSettingsSectionAvailable(section, true)
  ) {
    return <Navigate to="/account/settings/appearance" replace />;
  }
  return children;
}

export const accountRoutes: RouteObject[] = [
  {
    path: 'account',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <ProviderAccountRouteGuard>
          <Suspense fallback={routeFallback}>
            <AccountLayout />
          </Suspense>
        </ProviderAccountRouteGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="settings/appearance" replace /> },
      {
        path: 'profile',
        element: (
          <Suspense fallback={routeFallback}>
            <ProfilePage />
          </Suspense>
        ),
      },
      { path: 'settings', element: <Navigate to="appearance" replace /> },
      {
        path: 'settings/:section',
        element: (
          <AccountSettingsSectionGuard>
            <Suspense fallback={routeFallback}>
              <SettingsPage />
            </Suspense>
          </AccountSettingsSectionGuard>
        ),
      },
      {
        path: 'security',
        element: (
          <Suspense fallback={routeFallback}>
            <SecurityPage />
          </Suspense>
        ),
      },
    ],
  },
];
