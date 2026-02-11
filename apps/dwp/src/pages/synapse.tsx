import Box from '@mui/material/Box';

import { usePathname } from 'src/routes/hooks';

import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard/content';

import { SynapseModule } from '../components/synapse-module';

// ----------------------------------------------------------------------

const WORKBENCH_PATH = '/synapse/workbench';

export default function Page() {
  const pathname = usePathname();
  const isWorkbench = pathname === WORKBENCH_PATH;

  return (
    <>
      <title>{`Synapse - ${CONFIG.appName}`}</title>
      {isWorkbench ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <SynapseModule />
        </Box>
      ) : (
        <DashboardContent
          maxWidth={false}
          layoutMode="scrollable"
          sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <SynapseModule />
        </DashboardContent>
      )}
    </>
  );
}
