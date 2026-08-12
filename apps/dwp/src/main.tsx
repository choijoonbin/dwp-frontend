import '@dwp-frontend/design-system/styles/global.css';

import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { I18nProvider } from '@dwp-frontend/shared-i18n';
import { AuthProvider, useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { getTenantBranding } from '@dwp-frontend/shared-utils/api/tenant-branding-api';
import { DwpDateTimeProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-time-provider';
import { DwpThemeProvider } from '@dwp-frontend/design-system/appearance';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';

import App from './app';
import { routesSection } from './routes/sections';
import { ErrorBoundary } from './routes/components/error-boundary';
import { PersonalPreferenceProvider } from './features/account/personal-preference-provider';

import type { PropsWithChildren } from 'react';
import type { Root } from 'react-dom/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const defaultTenantAppearance = {
  productName: 'Digital Workplace',
  accentColor: '#2457D6',
  navigationPattern: 'sidebar' as const,
};

function ProductThemeProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const brandingQuery = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: getTenantBranding,
    enabled: auth.isAuthenticated,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const tenantAppearance = useMemo(
    () => ({
      ...defaultTenantAppearance,
      accentColor: brandingQuery.data?.accentColor || defaultTenantAppearance.accentColor,
    }),
    [brandingQuery.data?.accentColor]
  );

  return <DwpThemeProvider tenant={tenantAppearance}>{children}</DwpThemeProvider>;
}

const scheduleObservability =
  window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 1));
scheduleObservability(
  () =>
    void import('./observability/web-vitals').then(({ registerWebVitals }) => registerWebVitals()),
  { timeout: 2_000 }
);

function ProductDateTimeProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  return (
    <DwpDateTimeProvider locale={i18n.resolvedLanguage ?? i18n.language}>
      {children}
    </DwpDateTimeProvider>
  );
}

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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('DWP application root element is missing.');
}

const hotData = import.meta.hot?.data as { reactRoot?: Root } | undefined;
const reactRoot = hotData?.reactRoot ?? createRoot(rootElement);
if (hotData) {
  hotData.reactRoot = reactRoot;
}

reactRoot.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <ProductThemeProvider>
            <ProductDateTimeProvider>
              <PersonalPreferenceProvider>
                <RouterProvider router={router} />
              </PersonalPreferenceProvider>
            </ProductDateTimeProvider>
          </ProductThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>
);
