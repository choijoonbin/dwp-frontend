import '@dwp-frontend/design-system/styles/global.css';

import { useEffect, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router';
import { I18nProvider, getCurrentLanguage } from '@dwp-frontend/shared-i18n';
import { AuthProvider, setLanguageHeaderProvider } from '@dwp-frontend/shared-utils';

import { ThemeProvider } from 'src/theme/theme-provider';

import App from './app';
import { routesSection } from './routes/sections';
import { ErrorBoundary } from './routes/components';

// ----------------------------------------------------------------------

/** API 요청 시 Accept-Language 헤더 주입 */
const InitI18nAxios = () => {
  useEffect(() => {
    setLanguageHeaderProvider(() => getCurrentLanguage());
    return () => setLanguageHeaderProvider(null);
  }, []);
  return null;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <InitI18nAxios />
            <RouterProvider router={router} />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
