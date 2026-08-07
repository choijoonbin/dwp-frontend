import '@dwp-frontend/design-system/styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@dwp-frontend/shared-i18n';
import { AuthProvider } from '@dwp-frontend/shared-utils';
import { DwpThemeProvider } from '@dwp-frontend/design-system';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';

import App from './app';
import { routesSection } from './routes/sections';
import { ErrorBoundary } from './routes/components/error-boundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const tenantAppearance = {
  productName: 'Digital Workplace',
  accentColor: '#2457D6',
  navigationPattern: 'sidebar' as const,
};

const router = createBrowserRouter([
  {
    element: (
      <App>
        <Outlet />
      </App>
    ),
    errorElement: <ErrorBoundary />,
    children: routesSection,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DwpThemeProvider tenant={tenantAppearance}>
        <I18nProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </I18nProvider>
      </DwpThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
