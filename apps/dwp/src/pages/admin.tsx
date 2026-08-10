import { Boxes, Database, Network, ScrollText, Settings2, UsersRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';

import { AuditLog } from '../features/admin/audit-log';
import { AccessManager } from '../features/admin/access-manager';
import { DirectoryManager } from '../features/admin/directory-manager';
import { RegistryManager } from '../features/admin/registry-manager';
import { ReferenceDataManager } from '../features/admin/reference-data-manager';

type AdminView = 'access' | 'directory' | 'reference-data' | 'registry' | 'audit';

export default function AdminPage() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view: AdminView = ['access', 'directory', 'reference-data', 'registry', 'audit'].includes(
    requestedView ?? ''
  )
    ? (requestedView as AdminView)
    : 'access';

  const changeView = (_event: React.SyntheticEvent, value: AdminView) => {
    setSearchParams(value === 'access' ? {} : { view: value });
  };

  return (
    <PageCanvas>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={2}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 38,
              height: 38,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'text.primary',
              color: 'background.paper',
              borderRadius: 1,
            }}
          >
            <Settings2 size={20} strokeWidth={1.8} />
          </Box>
          <Box>
            <Typography component="h1" variant="h4">
              Administration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {auth.user?.tenantCode || 'Tenant'} control plane
            </Typography>
          </Box>
        </Box>
        <Chip label="Tenant scoped" color="info" variant="outlined" />
      </Stack>

      <Tabs
        value={view}
        onChange={changeView}
        aria-label="Administration views"
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mt: 3, mb: 2, minHeight: 44 }}
      >
        <Tab
          value="access"
          icon={<UsersRound size={17} strokeWidth={1.8} />}
          iconPosition="start"
          label="Access"
          sx={{ minWidth: 0, px: { xs: 1.25, sm: 2 } }}
        />
        <Tab
          value="directory"
          icon={<Network size={17} strokeWidth={1.8} />}
          iconPosition="start"
          label="Directory"
          sx={{ minWidth: 0, px: { xs: 1.25, sm: 2 } }}
        />
        <Tab
          value="reference-data"
          icon={<Database size={17} strokeWidth={1.8} />}
          iconPosition="start"
          aria-label="Reference data"
          label={
            <>
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Reference data
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                Data
              </Box>
            </>
          }
          sx={{ minWidth: 0, px: { xs: 1.25, sm: 2 } }}
        />
        <Tab
          value="registry"
          icon={<Boxes size={17} strokeWidth={1.8} />}
          iconPosition="start"
          label="Registry"
          sx={{ minWidth: 0, px: { xs: 1.25, sm: 2 } }}
        />
        <Tab
          value="audit"
          icon={<ScrollText size={17} strokeWidth={1.8} />}
          iconPosition="start"
          label="Audit"
          sx={{ minWidth: 0, px: { xs: 1.25, sm: 2 } }}
        />
      </Tabs>

      {view === 'access' && <AccessManager />}
      {view === 'directory' && <DirectoryManager />}
      {view === 'reference-data' && <ReferenceDataManager />}
      {view === 'registry' && <RegistryManager />}
      {view === 'audit' && <AuditLog />}
    </PageCanvas>
  );
}
