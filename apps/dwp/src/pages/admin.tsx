import { PermissionRouteGuard } from '@dwp-frontend/shared-utils';

import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard/content';

import { AdminModule } from '../components/admin-module';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Admin - ${CONFIG.appName}`}</title>

      <PermissionRouteGuard resource="menu.admin" permission="VIEW" redirectTo="/403">
        <DashboardContent maxWidth={false} layoutMode="fixed" sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <AdminModule />
        </DashboardContent>
      </PermissionRouteGuard>
    </>
  );
}
