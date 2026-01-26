import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { AuthGuard } from '@dwp-frontend/shared-utils';
import { Outlet, Navigate, useParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';

import { AuthLayout } from 'src/layouts/auth';
import { DashboardLayout } from 'src/layouts/dashboard';

// ----------------------------------------------------------------------

export const DashboardPage = lazy(() => import('../pages/dashboard'));
export const MailPage = lazy(() => import('../pages/mail'));
export const ChatPage = lazy(() => import('../pages/chat'));
export const ApprovalPage = lazy(() => import('../pages/approval'));
export const AIWorkspacePage = lazy(() => import('../pages/ai-workspace'));
export const AdminPage = lazy(() => import('../pages/admin'));
export const SignInPage = lazy(() => import('../pages/sign-in'));
export const SSOCallbackPage = lazy(() => import('../pages/sso-callback'));
export const ForgotPasswordPage = lazy(() => import('../pages/forgot-password'));
export const Page403 = lazy(() => import('../pages/page-403'));
export const Page404 = lazy(() => import('../pages/page-not-found'));

const AppAdminRedirect = () => {
  const params = useParams();
  const splat = params['*'] ?? '';
  const target = splat ? `/admin/${splat}` : '/admin';

  return <Navigate to={target} replace />;
};

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
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'mail', element: <MailPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'approval', element: <ApprovalPage /> },
      { path: 'ai-workspace', element: <AIWorkspacePage /> },
      { path: 'admin/aiworkspace', element: <Navigate to="/ai-workspace" replace /> },
      { path: 'app/admin/aiworkspace', element: <Navigate to="/ai-workspace" replace /> },
      { path: 'app/admin/*', element: <AppAdminRedirect /> },
      { path: 'admin/*', element: <AdminPage /> },
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
