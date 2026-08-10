import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ListChecks } from 'lucide-react';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ProviderOperations, ProviderTenants } from '../features/provider/provider-control-plane';

export default function ProviderPage() {
  const { t } = useTranslation('provider');
  const { view } = useParams();
  if (view !== 'tenants' && view !== 'operations') return <Navigate to="/404" replace />;
  const Icon = view === 'tenants' ? Building2 : ListChecks;
  return (
    <PageCanvas>
      <Stack gap={3}>
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('page.breadcrumb')}
          </Typography>
          <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ mt: 0.25 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                flex: '0 0 36px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: 'primary.main',
                bgcolor: 'action.selected',
              }}
            >
              <Icon size={19} />
            </Box>
            <Box>
              <Typography component="h1" variant="h4">
                {t(`page.${view}.title`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`page.${view}.description`)}
              </Typography>
            </Box>
          </Stack>
        </Box>
        {view === 'tenants' ? <ProviderTenants /> : <ProviderOperations />}
      </Stack>
    </PageCanvas>
  );
}
