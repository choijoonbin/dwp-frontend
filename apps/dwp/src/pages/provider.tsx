import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BadgeDollarSign,
  Building2,
  ClipboardList,
  Gauge,
  HeartPulse,
  LifeBuoy,
  ListChecks,
} from 'lucide-react';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  ProviderAudit,
  ProviderCommercial,
  ProviderHealth,
  ProviderOperations,
  ProviderOverview,
  ProviderSupport,
  ProviderTenantDetail,
  ProviderTenants,
} from '../features/provider/provider-control-plane';

const views = {
  overview: { icon: Gauge, content: ProviderOverview },
  tenants: { icon: Building2, content: ProviderTenants },
  operations: { icon: ListChecks, content: ProviderOperations },
  health: { icon: HeartPulse, content: ProviderHealth },
  support: { icon: LifeBuoy, content: ProviderSupport },
  commercial: { icon: BadgeDollarSign, content: ProviderCommercial },
  audit: { icon: ClipboardList, content: ProviderAudit },
} as const;

export default function ProviderPage() {
  const { t } = useTranslation('provider');
  const { view, tenantId } = useParams();
  if (tenantId) {
    return (
      <PageCanvas>
        <ProviderTenantDetail tenantId={tenantId} />
      </PageCanvas>
    );
  }
  if (!view || !(view in views)) return <Navigate to="/404" replace />;
  const selected = views[view as keyof typeof views];
  const Icon = selected.icon;
  const Content = selected.content;
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
        <Content />
      </Stack>
    </PageCanvas>
  );
}
