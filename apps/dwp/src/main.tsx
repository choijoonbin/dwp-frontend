import '@dwp-frontend/design-system/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@dwp-frontend/shared-utils';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router';

import { ThemeProvider } from 'src/theme/theme-provider';

import App from './app';
import { routesSection } from './routes/sections';
import { ErrorBoundary } from './routes/components';

// ----------------------------------------------------------------------

const router = createBrowserRouter([
  {
    Component: () => (
      <App>
        <Outlet />
      </App>
    ),
    errorElement: <ErrorBoundary />,
    children: routesSection,
  },
]);

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
