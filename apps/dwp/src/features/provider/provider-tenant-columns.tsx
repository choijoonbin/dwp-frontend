import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { ProviderStatusChip } from './provider-ui';
import { providerTenantServiceHealth } from './provider-tenant-estate-model';

import type { GridColDef } from '@mui/x-data-grid';
import type { ProviderTenant } from '@dwp-frontend/shared-utils';

export function useProviderTenantColumns(): GridColDef<ProviderTenant>[] {
  const { t } = useTranslation('provider');

  return useMemo<GridColDef<ProviderTenant>[]>(
    () => [
      {
        field: 'displayName',
        headerName: t('tenants.columns.tenant'),
        flex: 1.5,
        minWidth: 220,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 0.5 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.tenantKey} / {row.environmentKey}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'organizationName',
        headerName: t('tenants.columns.organization'),
        flex: 1,
        minWidth: 170,
      },
      {
        field: 'serviceTier',
        headerName: t('tenants.columns.tier'),
        width: 130,
        valueFormatter: (value: string) => t(`tiers.${value}`, { defaultValue: value }),
      },
      { field: 'dataRegion', headerName: t('tenants.columns.region'), width: 145 },
      {
        field: 'isolationModel',
        headerName: t('tenants.columns.isolation'),
        width: 120,
        valueFormatter: (value: string) => t(`isolation.${value}`, { defaultValue: value }),
      },
      {
        field: 'serviceHealth',
        headerName: t('tenants.columns.health'),
        width: 125,
        valueGetter: (_value, row) => providerTenantServiceHealth(row),
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
      {
        field: 'subscription',
        headerName: t('tenants.columns.subscription'),
        minWidth: 165,
        flex: 0.75,
        valueGetter: (_value, row) => row.subscription?.planName ?? t('tenants.noSubscription'),
      },
      {
        field: 'onboardingState',
        headerName: t('tenants.columns.onboarding'),
        width: 150,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
      {
        field: 'lifecycleState',
        headerName: t('tenants.columns.state'),
        width: 120,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
    ],
    [t]
  );
}
