import '@vitejs/plugin-react-swc/preamble';

import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CssBaseline from '@mui/material/CssBaseline';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@dwp-frontend/shared-i18n';

import { WorkplaceDeviceOperations } from '../../apps/dwp/src/features/rooms/workplace-navigation-device-operations';
import { WorkplaceDeviceSurface } from '../../apps/dwp/src/features/rooms/workplace-navigation-device-surfaces';
import { WorkplaceWayfinding } from '../../apps/dwp/src/features/rooms/workplace-navigation-wayfinding';

const query = new URLSearchParams(window.location.search);
const view = query.get('view') ?? 'wayfinding';
const locale = query.get('locale') === 'en' ? 'en' : 'ko';
const siteId = query.get('siteId') ?? '19000000-0000-4000-8000-000000000001';
const originPoiId = query.get('originPoiId') ?? '19000000-0000-4000-8000-000000000003';
const destinationPoiId = query.get('destinationPoiId') ?? '19000000-0000-4000-8000-000000000004';
const deviceId = query.get('deviceId') ?? '19000000-0000-4000-8000-000000000005';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

document.documentElement.lang = locale;
window.localStorage.setItem('dwp.locale', locale);
document.body.style.margin = '0';

const content =
  view === 'devices' ? (
    <WorkplaceDeviceOperations locale={locale} canManage elevated />
  ) : view === 'room-panel' || view === 'status-board' ? (
    <WorkplaceDeviceSurface
      deviceId={deviceId}
      deviceCredential="screen-19-e2e-device-credential"
      locale={locale}
      onWalkUpBook={() => undefined}
      onCheckIn={() => undefined}
      onEarlyEnd={() => undefined}
    />
  ) : (
    <WorkplaceWayfinding
      siteId={siteId}
      initialOriginPoiId={originPoiId}
      initialDestinationPoiId={destinationPoiId}
      defaultDestinationResourceId="19000000-0000-4000-8000-000000000004"
      locale={locale}
      canUpdate
      elevated
    />
  );

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={null}>
    <QueryClientProvider client={queryClient}>
      <I18nProvider namespaces={['common', 'rooms']}>
        <CssBaseline />
        {content}
      </I18nProvider>
    </QueryClientProvider>
  </Suspense>
);
