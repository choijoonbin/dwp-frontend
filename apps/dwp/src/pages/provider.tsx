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
import { useQuery } from '@tanstack/react-query';
import { getProviderOperatorProfile } from '@dwp-frontend/shared-utils';

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
import { ProviderError, ProviderLoading } from '../features/provider/provider-ui';

const views = {
  overview: { icon: Gauge, content: ProviderOverview, permission: 'ESTATE_READ' },
  tenants: { icon: Building2, content: ProviderTenants, permission: 'ESTATE_READ' },
  operations: { icon: ListChecks, content: ProviderOperations, permission: 'ESTATE_READ' },
  health: { icon: HeartPulse, content: ProviderHealth, permission: 'HEALTH_READ' },
  support: { icon: LifeBuoy, content: ProviderSupport, permission: 'ESTATE_READ' },
  commercial: {
    icon: BadgeDollarSign,
    content: ProviderCommercial,
    permission: 'COMMERCIAL_READ',
  },
  audit: { icon: ClipboardList, content: ProviderAudit, permission: 'AUDIT_READ' },
} as const;

export default function ProviderPage() {
  const { t } = useTranslation('provider');
  const { view, tenantId } = useParams();
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  if (operator.isLoading) return <ProviderLoading />;
  if (operator.isError) return <ProviderError error={operator.error} />;
  if (tenantId) {
    if (!operator.data?.permissions.includes('ESTATE_READ')) {
      return <Navigate to="/403" replace />;
    }
    return (
      <PageCanvas>
        <ProviderTenantDetail tenantId={tenantId} />
      </PageCanvas>
    );
  }
  if (!view || !(view in views)) return <Navigate to="/404" replace />;
  const selected = views[view as keyof typeof views];
  if (!operator.data?.permissions.includes(selected.permission)) {
    return <Navigate to="/403" replace />;
  }
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
