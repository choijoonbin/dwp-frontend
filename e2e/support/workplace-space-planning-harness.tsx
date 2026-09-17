import '@vitejs/plugin-react-swc/preamble';
import '@dwp-frontend/design-system/styles/global.css';

import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '@dwp-frontend/shared-i18n';
import { AuthProvider } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { ProductSurfaceAuthorityProvider } from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import { DwpThemeProvider } from '@dwp-frontend/design-system/appearance';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import CssBaseline from '@mui/material/CssBaseline';

import { WorkplaceSpacePlanning } from '../../apps/dwp/src/features/rooms/workplace-space-planning';

const locale = new URLSearchParams(window.location.search).get('locale') === 'ko' ? 'ko' : 'en';
window.localStorage.setItem('dwp.locale', locale);
document.documentElement.lang = locale;
document.body.style.margin = '0';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={<div role="status">Loading…</div>}>
    <QueryClientProvider client={queryClient}>
      <I18nProvider namespaces={['common', 'rooms']}>
        <DwpThemeProvider
          tenant={{
            productName: 'Digital Workplace',
            accentColor: foundationTokens.color.product.primary,
            navigationPattern: 'sidebar',
          }}
        >
          <CssBaseline />
          <AuthProvider>
            <ProductSurfaceAuthorityProvider>
              <BrowserRouter>
                <WorkplaceSpacePlanning />
              </BrowserRouter>
            </ProductSurfaceAuthorityProvider>
          </AuthProvider>
        </DwpThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </Suspense>
);
