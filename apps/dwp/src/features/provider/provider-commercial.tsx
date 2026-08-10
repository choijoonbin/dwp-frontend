import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeDollarSign, Building2, CalendarClock, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getProviderCommercialOverview } from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { GridColDef } from '@mui/x-data-grid';
import type { ProviderSubscriptionPortfolio } from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
} from './provider-ui';

export function ProviderCommercial() {
  const { t } = useTranslation('provider');
  const commercial = useQuery({
    queryKey: ['provider', 'commercial'],
    queryFn: getProviderCommercialOverview,
  });
  const columns = useMemo<GridColDef<ProviderSubscriptionPortfolio>[]>(
    () => [
      {
        field: 'organizationName',
        headerName: t('commercial.columns.customer'),
        minWidth: 220,
        flex: 1.2,
        renderCell: ({ row }) => (
          <Box minWidth={0}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {row.organizationName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.organizationKey}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'planName',
        headerName: t('commercial.columns.plan'),
        minWidth: 180,
        flex: 0.8,
        renderCell: ({ row }) => (
          <Box>
            <Typography variant="body2">{row.planName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t(`tiers.${row.serviceTier}`, { defaultValue: row.serviceTier })}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'contractReference',
        headerName: t('commercial.columns.contract'),
        minWidth: 150,
        flex: 0.65,
        valueFormatter: (value?: string | null) => value ?? t('commercial.noReference'),
      },
      {
        field: 'tenants',
        headerName: t('commercial.columns.tenants'),
        width: 105,
      },
      {
        field: 'activeEntitlements',
        headerName: t('commercial.columns.entitlements'),
        width: 120,
      },
      {
        field: 'endsAt',
        headerName: t('commercial.columns.renewal'),
        width: 175,
        valueFormatter: (value?: string | null) =>
          value ? formatProviderDate(value) : t('commercial.noEndDate'),
      },
      {
        field: 'lifecycleState',
        headerName: t('commercial.columns.state'),
        width: 115,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
    ],
    [t]
  );

  if (commercial.isLoading) return <ProviderLoading />;
  if (commercial.isError) return <ProviderError error={commercial.error} />;
  if (!commercial.data) return null;

  const metrics = [
    {
      label: t('commercial.metrics.active'),
      value: commercial.data.activeSubscriptions,
      icon: BadgeDollarSign,
    },
    {
      label: t('commercial.metrics.trials'),
      value: commercial.data.trialSubscriptions,
      icon: CalendarClock,
    },
    {
      label: t('commercial.metrics.expiring'),
      value: commercial.data.expiringSubscriptions,
      icon: CalendarClock,
    },
    {
      label: t('commercial.metrics.uncontracted'),
      value: commercial.data.uncontractedOrganizations,
      icon: Building2,
    },
  ];

  return (
    <Stack gap={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(({ label, value, icon: Icon }, index) => (
          <Box
            key={label}
            sx={{
              p: 1.75,
              borderLeft: { xs: index % 2 ? 1 : 0, lg: index ? 1 : 0 },
              borderTop: { xs: index > 1 ? 1 : 0, lg: 0 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
              <Icon size={16} />
              <Typography variant="caption">{label}</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {value.toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('commercial.plans.title')}
          description={t('commercial.plans.description')}
          action={
            <Tooltip title={t('actions.refresh')}>
              <IconButton
                aria-label={t('actions.refresh')}
                onClick={() => void commercial.refetch()}
              >
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
          }
        />
        <Box
          sx={{
            mt: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          {commercial.data.plans.map((plan, index) => (
            <Box
              key={`${plan.planKey}:${plan.planVersion}`}
              sx={{
                p: 2,
                minWidth: 0,
                borderLeft: { md: index ? 1 : 0 },
                borderTop: { xs: index ? 1 : 0, md: 0 },
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight={750} noWrap>
                    {plan.planName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('commercial.plans.version', {
                      key: plan.planKey,
                      version: plan.planVersion,
                    })}
                  </Typography>
                </Box>
                <Chip size="small" variant="outlined" label={t(`tiers.${plan.serviceTier}`)} />
              </Stack>
              <Stack direction="row" gap={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="h5">{plan.organizations}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('commercial.plans.customers')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5">{plan.tenants}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('commercial.plans.tenants')}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('commercial.subscriptions.title')}
          description={t('commercial.subscriptions.description')}
          action={
            <Chip size="small" variant="outlined" label={commercial.data.subscriptions.length} />
          }
        />
        <Box sx={{ mt: 1.5 }}>
          <EnterpriseDataGrid
            ariaLabel={t('commercial.subscriptions.title')}
            rows={commercial.data.subscriptions}
            columns={columns}
            getRowId={(row) => row.subscriptionId}
            loading={commercial.isFetching}
            hideFooter
            maxVisibleRows={10}
          />
        </Box>
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('commercial.adoption.title')}
          description={t('commercial.adoption.description')}
        />
        <Stack
          divider={<Divider flexItem />}
          sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}
        >
          {commercial.data.entitlements.map((entitlement) => {
            const adoption = entitlement.eligibleTenants
              ? (entitlement.assignedTenants / entitlement.eligibleTenants) * 100
              : 0;
            return (
              <Box key={entitlement.entitlementId} sx={{ py: 1.35 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={750} noWrap>
                      {entitlement.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {entitlement.entitlementKey} / {entitlement.entitlementType}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={750}>
                    {entitlement.assignedTenants}/{entitlement.eligibleTenants}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={adoption}
                  sx={{ mt: 0.75, height: 4, borderRadius: 0 }}
                />
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
}
