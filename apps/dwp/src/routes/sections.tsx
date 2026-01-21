import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { varAlpha } from 'minimal-shared/utils';
import { AuthGuard } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';

import { AuthLayout } from 'src/layouts/auth';
import { DashboardLayout } from 'src/layouts/dashboard';

// ----------------------------------------------------------------------

export const DashboardPage = lazy(() => import('src/pages/dashboard'));
export const MailPage = lazy(() => import('src/pages/mail'));
export const ChatPage = lazy(() => import('src/pages/chat'));
export const ApprovalPage = lazy(() => import('src/pages/approval'));
export const AIWorkspacePage = lazy(() => import('src/pages/ai-workspace'));
export const AdminPage = lazy(() => import('../pages/admin'));
export const SignInPage = lazy(() => import('src/pages/sign-in'));
export const SSOCallbackPage = lazy(() => import('src/pages/sso-callback'));
export const ForgotPasswordPage = lazy(() => import('src/pages/forgot-password'));
export const Page403 = lazy(() => import('src/pages/page-403'));
export const Page404 = lazy(() => import('src/pages/page-not-found'));

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
