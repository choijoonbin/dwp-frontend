import { lazy, Suspense } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BadgeDollarSign,
  Building2,
  Braces,
  ClipboardList,
  Database,
  Flag,
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

import { ProviderError, ProviderLoading } from '../features/provider/provider-ui';

const ProviderOverview = lazy(() =>
  import('../features/provider/provider-overview').then((module) => ({
    default: module.ProviderOverview,
  }))
);
const ProviderTenants = lazy(() =>
  import('../features/provider/provider-tenants').then((module) => ({
    default: module.ProviderTenants,
  }))
);
const ProviderOperations = lazy(() =>
  import('../features/provider/provider-operations').then((module) => ({
    default: module.ProviderOperations,
  }))
);
const ProviderHealth = lazy(() =>
  import('../features/provider/provider-health').then((module) => ({
    default: module.ProviderHealth,
  }))
);
const ProviderFeatureRollouts = lazy(() =>
  import('../features/provider/provider-feature-rollouts').then((module) => ({
    default: module.ProviderFeatureRollouts,
  }))
);
const ProviderSupport = lazy(() =>
  import('../features/provider/provider-support').then((module) => ({
    default: module.ProviderSupport,
  }))
);
const ProviderCommercial = lazy(() =>
  import('../features/provider/provider-commercial').then((module) => ({
    default: module.ProviderCommercial,
  }))
);
const ProviderCodeContracts = lazy(() =>
  import('../features/provider/provider-code-contracts').then((module) => ({
    default: module.ProviderCodeContracts,
  }))
);
const ProviderDataGovernance = lazy(() =>
  import('../features/provider/provider-data-governance').then((module) => ({
    default: module.ProviderDataGovernance,
  }))
);
const ProviderAudit = lazy(() =>
  import('../features/provider/provider-audit').then((module) => ({
    default: module.ProviderAudit,
  }))
);
const ProviderTenantDetail = lazy(() =>
  import('../features/provider/provider-tenant-detail').then((module) => ({
    default: module.ProviderTenantDetail,
  }))
);

const views = {
  overview: { icon: Gauge, content: ProviderOverview, permission: 'ESTATE_READ' },
  tenants: { icon: Building2, content: ProviderTenants, permission: 'ESTATE_READ' },
  operations: { icon: ListChecks, content: ProviderOperations, permission: 'ESTATE_READ' },
  health: { icon: HeartPulse, content: ProviderHealth, permission: 'HEALTH_READ' },
  'feature-rollouts': {
    icon: Flag,
    content: ProviderFeatureRollouts,
    permission: 'FEATURE_ROLLOUT_READ',
  },
  support: { icon: LifeBuoy, content: ProviderSupport, permission: 'ESTATE_READ' },
  commercial: {
    icon: BadgeDollarSign,
    content: ProviderCommercial,
    permission: 'COMMERCIAL_READ',
  },
  'code-contracts': {
    icon: Braces,
    content: ProviderCodeContracts,
    permission: 'CATALOG_READ',
  },
  'data-governance': {
    icon: Database,
    content: ProviderDataGovernance,
    permission: 'DATA_GOVERNANCE_READ',
  },
  audit: { icon: ClipboardList, content: ProviderAudit, permission: 'AUDIT_READ' },
} as const;

export default function ProviderPage() {
  const { t } = useTranslation('provider');
  const { view, tenantId } = useParams();
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
    staleTime: 30_000,
  });
  if (operator.isLoading && !operator.data) return <ProviderLoading />;
  if (operator.isError && !operator.data) {
    return (
      <ProviderError
        error={operator.error}
        onRetry={() => void operator.refetch()}
        retrying={operator.isFetching}
      />
    );
  }
  if (tenantId) {
    if (!operator.data?.permissions.includes('ESTATE_READ')) {
      return <Navigate to="/403" replace />;
    }
    return (
      <PageCanvas>
        <Suspense fallback={<ProviderLoading />}>
          <ProviderTenantDetail tenantId={tenantId} />
        </Suspense>
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
        <Suspense fallback={<ProviderLoading />}>
          <Content />
        </Suspense>
      </Stack>
    </PageCanvas>
  );
}
