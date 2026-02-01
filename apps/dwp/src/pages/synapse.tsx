import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard/content';

import { SynapseModule } from '../components/synapse-module';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Synapse - ${CONFIG.appName}`}</title>
      <DashboardContent
        maxWidth={false}
        layoutMode="scrollable"
        sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <SynapseModule />
      </DashboardContent>
    </>
  );
}
