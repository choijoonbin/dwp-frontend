import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { varAlpha } from '@dwp-frontend/design-system';
import { AuthGuard } from '@dwp-frontend/shared-utils';
import { Outlet, Navigate, useParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';

import Page403 from 'src/pages/page-403';
import { CONFIG } from 'src/config-global';
import { AuthLayout } from 'src/layouts/auth';
import Page404 from 'src/pages/page-not-found';
import { DashboardLayout } from 'src/layouts/dashboard';

// ----------------------------------------------------------------------

export const DashboardPage = lazy(() => import('../pages/dashboard'));
export const MailPage = lazy(() => import('../pages/mail'));
export const ChatPage = lazy(() => import('../pages/chat'));
export const ApprovalPage = lazy(() => import('../pages/approval'));
export const AIWorkspacePage = lazy(() => import('../pages/ai-workspace'));
export const AdminPage = lazy(() => import('../pages/admin'));
export const SynapsePage = lazy(() => import('../pages/synapse'));
export const SignInPage = lazy(() => import('../pages/sign-in'));
export const SSOCallbackPage = lazy(() => import('../pages/sso-callback'));
export const OidcCallbackPage = lazy(() => import('../pages/auth/oidc-callback'));
export const ForgotPasswordPage = lazy(() => import('../pages/forgot-password'));

const AppAdminRedirect = () => {
  const params = useParams();
  const splat = params['*'] ?? '';
  const target = splat ? `/admin/${splat}` : '/admin';

  return <Navigate to={target} replace />;
};

/** 루트(/) 접속 시 CONFIG.defaultAfterLoginPath로 리다이렉트. '/'이면 대시보드 표시(무한 리다이렉트 방지). */
const DefaultLanding = () => {
  const path = CONFIG.defaultAfterLoginPath?.trim() || '/';
  if (path === '/') return <DashboardPage />;
  return <Navigate to={path} replace />;
};

/**
 * dashboard, mail, admin 등 명시 라우트에 매칭되지 않은 경로 → Synapse 앱으로 디스패치.
 * 메뉴 트리 로딩 전에도 /synapse/*, /menu.*, /cases 등 Synapse 경로는 정상 표시.
 */
const PathnameDispatcher = () => <SynapsePage />;

const renderFallback = () => (
  <Box
    sx={{
      display: 'flex',
      flex: '1 1 auto',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <LinearProgress
      sx={{
        width: 1,
        maxWidth: 320,
        bgcolor: (theme) => varAlpha(theme.vars.palette.text.primaryChannel, 0.16),
        [`& .${linearProgressClasses.bar}`]: { bgcolor: 'text.primary' },
      }}
    />
  </Box>
);

export const routesSection: RouteObject[] = [
  {
    element: (
      <AuthGuard>
        <DashboardLayout>
          <Suspense fallback={renderFallback()}>
            <Outlet />
          </Suspense>
        </DashboardLayout>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DefaultLanding /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'mail', element: <MailPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'approval', element: <ApprovalPage /> },
      { path: 'ai-workspace', element: <AIWorkspacePage /> },
      { path: 'admin/aiworkspace', element: <Navigate to="/ai-workspace" replace /> },
      { path: 'app/admin/aiworkspace', element: <Navigate to="/ai-workspace" replace /> },
      { path: 'app/admin/*', element: <AppAdminRedirect /> },
      { path: 'admin/*', element: <AdminPage /> },
      { path: '*', element: <PathnameDispatcher /> },
    ],
  },
  {
    path: 'sign-in',
    element: (
      <AuthLayout>
        <SignInPage />
      </AuthLayout>
    ),
  },
  {
    path: 'sso-callback',
    element: <SSOCallbackPage />,
  },
  {
    path: 'auth/oidc/callback',
    element: <OidcCallbackPage />,
  },
  {
    path: 'forgot-password',
    element: (
      <AuthLayout>
        <ForgotPasswordPage />
      </AuthLayout>
    ),
  },
  {
    path: '403',
    element: <Page403 />,
  },
  {
    path: '404',
    element: <Page404 />,
  },
  { path: '*', element: <Page404 /> },
];
