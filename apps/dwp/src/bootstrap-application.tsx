import '@dwp-frontend/design-system/styles/global.css';

import { lazy, StrictMode, Suspense, useMemo, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { I18nProvider } from '@dwp-frontend/shared-i18n';
import { AuthProvider, useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { ProductSurfaceAuthorityProvider } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import { resolveTenantLogoUrl } from '@dwp-frontend/shared-utils/api/tenant-branding-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { DwpDateTimeProvider } from '@dwp-frontend/design-system/enterprise/date-time/date-time-provider';
import { DwpThemeProvider } from '@dwp-frontend/design-system/appearance';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Outlet, RouterProvider, createBrowserRouter, type RouteObject } from 'react-router-dom';

import App from './app';
import type { ProductApplicationRuntime } from './components/product-application-runtime';
import { isProviderControlPlaneCacheQuery } from './components/provider-support-cache-policy';
import { createPlaneCachePurger } from './components/query-cache-plane-boundary';
import { tenantBrandingQueryOptions } from './features/shell/tenant-branding-query';
import { ErrorBoundary } from './routes/components/error-boundary';
import { PersonalPreferenceProvider } from './providers/personal-preference-provider';
import { ShellBootScreen } from './components/shell-boot-screen';
import { readProductSurfaceTelemetryConsent } from './observability/product-surface-telemetry-context';

const ProductSurfaceTelemetryProvider = lazy(
  () => import('./observability/product-surface-telemetry-provider')
);
const ProviderSupportAuthorityBoundary = lazy(() =>
  import('./components/provider-support-authority-boundary').then((module) => ({
    default: module.ProviderSupportAuthorityBoundary,
  }))
);

const defaultTenantAppearance = {
  productName: 'Digital Workplace',
  accentColor: '#2457D6',
  navigationPattern: 'sidebar' as const,
};

const purgeProviderSupportTenantCache = createPlaneCachePurger(isProviderControlPlaneCacheQuery);

function ProductThemeProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const providerAccount = isProviderIdentity(auth.user);
  const brandingQuery = useQuery({
    ...tenantBrandingQueryOptions,
    enabled: auth.isAuthenticated && !providerAccount,
  });
  const tenantAppearance = useMemo(
    () => ({
      ...defaultTenantAppearance,
      accentColor:
        (!providerAccount && brandingQuery.data?.accentColor) ||
        defaultTenantAppearance.accentColor,
    }),
    [brandingQuery.data?.accentColor, providerAccount]
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

function ApplicationAuthorityBoundary({
  runtime,
  children,
}: PropsWithChildren<{ runtime: ProductApplicationRuntime }>) {
  const auth = useAuth();
  if (isProviderIdentity(auth.user)) {
    return (
      <Suspense fallback={<ShellBootScreen />}>
        <ProviderSupportAuthorityBoundary purgeTenantCache={purgeProviderSupportTenantCache}>
          {children}
        </ProviderSupportAuthorityBoundary>
      </Suspense>
    );
  }
  return (
    <ProductSurfaceAuthorityProvider legacySensitiveQueryPrefixes={runtime.sensitiveQueryPrefixes}>
      {children}
    </ProductSurfaceAuthorityProvider>
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

async function prepareAuthenticatedShell(
  queryClient: QueryClient,
  user: Parameters<typeof isProviderIdentity>[0]
) {
  if (isProviderIdentity(user)) return;
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

export function bootstrapApplication(routes: RouteObject[], runtime: ProductApplicationRuntime) {
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
        <PersonalPreferenceProvider>
          <App runtime={runtime}>
            <Outlet />
          </App>
        </PersonalPreferenceProvider>
      ),
      errorElement: <ErrorBoundary />,
      children: routes,
    },
  ]);
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('DWP application root element is missing.');

  document.documentElement.dataset.applicationId = runtime.applicationId;
  registerObservability();

  const hotData = import.meta.hot?.data as { reactRoot?: Root } | undefined;
  const reactRoot = hotData?.reactRoot ?? createRoot(rootElement);
  if (hotData) hotData.reactRoot = reactRoot;
  const productionTelemetryEnabled =
    import.meta.env.VITE_PRODUCT_SURFACE_TELEMETRY_COLLECTION === 'true';
  const telemetryConsentGranted = readProductSurfaceTelemetryConsent(window.localStorage);
  const routedApplication = <RouterProvider router={router} />;
  const telemetryApplication =
    productionTelemetryEnabled && telemetryConsentGranted ? (
      <Suspense fallback={<ShellBootScreen />}>
        <ProductSurfaceTelemetryProvider productionCollectionEnabled privacyConsentGranted>
          {routedApplication}
        </ProductSurfaceTelemetryProvider>
      </Suspense>
    ) : (
      routedApplication
    );

  reactRoot.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nProvider
          namespaces={runtime.i18nNamespaces.length > 0 ? runtime.i18nNamespaces : undefined}
        >
          <AuthProvider
            prepareAuthenticatedSession={(user) => prepareAuthenticatedShell(queryClient, user)}
          >
            <ProductThemeProvider>
              <ProductDateTimeProvider>
                <ApplicationAuthorityBoundary runtime={runtime}>
                  {telemetryApplication}
                </ApplicationAuthorityBoundary>
              </ProductDateTimeProvider>
            </ProductThemeProvider>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}
