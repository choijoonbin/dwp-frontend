import { PermissionRouteGuard } from '@dwp-frontend/shared-utils';

import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard/content';

import AIWorkspaceModule from './aiworkspace';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`AI Workspace - ${CONFIG.appName}`}</title>

      <PermissionRouteGuard resource="menu.ai-workspace" permission="VIEW" redirectTo="/403">
        <DashboardContent maxWidth={false} layoutMode="fixed" sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <AIWorkspaceModule />
        </DashboardContent>
      </PermissionRouteGuard>
    </>
  );
}
