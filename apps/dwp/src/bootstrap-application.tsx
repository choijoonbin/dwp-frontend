import '@dwp-frontend/design-system/styles/global.css';

import { StrictMode, useMemo, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { I18nProvider } from '@dwp-frontend/shared-i18n';
import { AuthProvider, useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { resolveTenantLogoUrl } from '@dwp-frontend/shared-utils/api/tenant-branding-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { DwpDateTimeProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-time-provider';
import { DwpThemeProvider } from '@dwp-frontend/design-system/appearance';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Outlet, RouterProvider, createBrowserRouter, type RouteObject } from 'react-router-dom';

import App from './app';
import { tenantBrandingQueryOptions } from './features/shell/tenant-branding-query';
import { ErrorBoundary } from './routes/components/error-boundary';
import { PersonalPreferenceProvider } from './providers/personal-preference-provider';

const defaultTenantAppearance = {
  productName: 'Digital Workplace',
  accentColor: '#2457D6',
  navigationPattern: 'sidebar' as const,
};

function ProductThemeProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const brandingQuery = useQuery({
    ...tenantBrandingQueryOptions,
    enabled: auth.isAuthenticated,
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

function ProductDateTimeProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  return (
    <DwpDateTimeProvider locale={i18n.resolvedLanguage ?? i18n.language}>
      {children}
    </DwpDateTimeProvider>
  );
}

function registerObservability() {
  const schedule =
    window.requestIdleCallback ??
    ((callback: IdleRequestCallback) => window.setTimeout(callback, 1));
  schedule(
    () =>
      void import('./observability/web-vitals').then(({ registerWebVitals }) =>
        registerWebVitals()
      ),
    { timeout: 2_000 }
  );
}

async function prepareAuthenticatedShell(queryClient: QueryClient) {
  try {
    const branding = await queryClient.ensureQueryData(tenantBrandingQueryOptions);
    const logoUrl = resolveTenantLogoUrl(branding);
    if (logoUrl) {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'high';
      image.src = logoUrl;
      await Promise.race([
        image.decode().catch(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
      ]);
    }
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) throw error;
  }
}

export function bootstrapApplication(routes: RouteObject[], applicationId = 'shell') {
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
      element: (
        <App>
          <Outlet />
        </App>
      ),
      errorElement: <ErrorBoundary />,
      children: routes,
    },
  ]);
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('DWP application root element is missing.');

  document.documentElement.dataset.applicationId = applicationId;
  registerObservability();

  const hotData = import.meta.hot?.data as { reactRoot?: Root } | undefined;
  const reactRoot = hotData?.reactRoot ?? createRoot(rootElement);
  if (hotData) hotData.reactRoot = reactRoot;

  reactRoot.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AuthProvider prepareAuthenticatedSession={() => prepareAuthenticatedShell(queryClient)}>
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
}
