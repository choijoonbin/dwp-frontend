import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  executeProviderOperation,
  getProviderOperatorProfile,
  listProviderEntitlements,
  listProviderRegions,
  listProviderTenants,
  previewProviderOnboarding,
  useToast,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid, GuidedEmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  OnboardingPlanRequest,
  ProviderOperation,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

import { ProviderOnboardingDialog } from './provider-onboarding-dialog';
import { ProviderOperationDialog } from './provider-operation-dialog';
import {
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

export function ProviderTenants() {
  const { t } = useTranslation('provider');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [state, setState] = useState('ALL');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [operation, setOperation] = useState<ProviderOperation | null>(null);
  const [busy, setBusy] = useState(false);

  const tenants = useQuery({
    queryKey: ['provider', 'tenants', deferredQuery, state],
    queryFn: () =>
      listProviderTenants({
        query: deferredQuery,
        state: state === 'ALL' ? undefined : state,
        page: 0,
        size: 100,
      }),
  });
  const entitlements = useQuery({
    queryKey: ['provider', 'entitlements'],
    queryFn: listProviderEntitlements,
  });
  const regions = useQuery({
    queryKey: ['provider', 'regions'],
    queryFn: listProviderRegions,
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const canWrite = operator.data?.permissions.includes('TENANT_WRITE') ?? false;

  const columns = useMemo<GridColDef<ProviderTenant>[]>(
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
        valueGetter: (_value, row) =>
          row.services.some((service) => service.lifecycleState === 'FAILED')
            ? 'FAILED'
            : row.services.some((service) => service.lifecycleState === 'DEGRADED')
              ? 'DEGRADED'
              : row.services.some((service) => service.lifecycleState === 'PROVISIONING')
                ? 'PROVISIONING'
                : 'READY',
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['provider'] });
  const preview = async (request: OnboardingPlanRequest) => {
    setBusy(true);
    try {
      const next = await previewProviderOnboarding(request);
      setOnboardingOpen(false);
      setOperation(next);
      toast.success(t('onboarding.previewed'));
      await invalidate();
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };
  const execute = async (target: ProviderOperation) => {
    setBusy(true);
    try {
      const next = await executeProviderOperation(target);
      setOperation(next);
      toast.success(t('operations.executed'));
      await invalidate();
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };

  if (
    tenants.isLoading ||
    entitlements.isLoading ||
    regions.isLoading ||
    (operator.isLoading && !operator.data)
  )
    return <ProviderLoading />;
  if (
    tenants.isError ||
    entitlements.isError ||
    regions.isError ||
    (operator.isError && !operator.data)
  )
    return (
      <ProviderError
        error={tenants.error ?? entitlements.error ?? regions.error ?? operator.error}
        onRetry={() =>
          void Promise.all([
            tenants.refetch(),
            entitlements.refetch(),
            regions.refetch(),
            operator.refetch(),
          ])
        }
        retrying={
          tenants.isFetching || entitlements.isFetching || regions.isFetching || operator.isFetching
        }
      />
    );

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
        {[
          {
            label: t('tenants.metrics.organizations'),
            value: new Set((tenants.data?.content ?? []).map((tenant) => tenant.organizationId))
              .size,
            icon: Building2,
          },
          {
            label: t('tenants.metrics.active'),
            value: (tenants.data?.content ?? []).filter(
              (tenant) => tenant.lifecycleState === 'ACTIVE'
            ).length,
            icon: Server,
          },
          {
            label: t('tenants.metrics.healthy'),
            value: (tenants.data?.content ?? []).filter((tenant) =>
              tenant.services.every((service) => service.lifecycleState === 'READY')
            ).length,
            icon: ShieldCheck,
          },
          {
            label: t('tenants.metrics.attention'),
            value: (tenants.data?.content ?? []).filter((tenant) =>
              tenant.services.some((service) =>
                ['DEGRADED', 'FAILED'].includes(service.lifecycleState)
              )
            ).length,
            icon: TriangleAlert,
          },
        ].map(({ label, value, icon: Icon }, index) => (
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
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <ProviderSectionHeading title={t('tenants.title')} description={t('tenants.description')} />
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={1}
      >
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          label={t('tenants.search')}
          sx={{ minWidth: { md: 320 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
            },
          }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={state}
          onChange={(_event, value: string | null) => value && setState(value)}
          aria-label={t('fields.lifecycle')}
        >
          {['ALL', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'RETIRED'].map((value) => (
            <ToggleButton key={value} value={value}>
              {t(`states.${value}`, { defaultValue: value })}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t('actions.refresh')}>
          <IconButton aria-label={t('actions.refresh')} onClick={() => void tenants.refetch()}>
            <RefreshCw size={18} />
          </IconButton>
        </Tooltip>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<Plus size={17} />}
            onClick={() => setOnboardingOpen(true)}
          >
            {t('tenants.actions.onboard')}
          </Button>
        )}
      </Stack>

      {(tenants.data?.content ?? []).length > 0 ? (
        <EnterpriseDataGrid
          ariaLabel={t('tenants.title')}
          rows={tenants.data?.content ?? []}
          columns={columns}
          getRowId={(row) => row.tenantId}
          onRowClick={({ row }) => navigate(`/provider/tenants/${row.tenantId}`)}
          loading={tenants.isFetching}
          hideFooter
          maxVisibleRows={12}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      ) : (
        <GuidedEmptyState
          kind={query.trim() || state !== 'ALL' ? 'no-results' : 'first-use'}
          title={
            query.trim() || state !== 'ALL'
              ? t('tenants.empty.noResultsTitle')
              : t('tenants.empty.firstUseTitle')
          }
          description={
            query.trim() || state !== 'ALL'
              ? t('tenants.empty.noResultsDescription')
              : t('tenants.empty.firstUseDescription')
          }
          actionLabel={
            query.trim() || state !== 'ALL'
              ? t('tenants.empty.reset')
              : canWrite
                ? t('tenants.actions.onboard')
                : undefined
          }
          onAction={
            query.trim() || state !== 'ALL'
              ? () => {
                  setQuery('');
                  setState('ALL');
                }
              : canWrite
                ? () => setOnboardingOpen(true)
                : undefined
          }
          size="standard"
        />
      )}

      {onboardingOpen && (
        <ProviderOnboardingDialog
          entitlements={entitlements.data ?? []}
          regions={regions.data ?? []}
          busy={busy}
          onClose={() => setOnboardingOpen(false)}
          onPreview={preview}
        />
      )}
      {operation && (
        <ProviderOperationDialog
          operation={operation}
          busy={busy}
          onClose={() => setOperation(null)}
          onExecute={execute}
        />
      )}
    </Stack>
  );
}
