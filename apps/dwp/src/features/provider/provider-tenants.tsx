import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  GitCompareArrows,
  Globe2,
  Layers3,
  MapPin,
  Plus,
  Search,
  Server,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  executeProviderOperation,
  getProviderEstateOverview,
  getProviderOperatorProfile,
  listProviderEntitlements,
  listProviderRegions,
  listProviderTenants,
  previewProviderOnboarding,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  DistributionBar,
  EnterpriseDataGrid,
  ActionButton,
  GuidedEmptyState,
  LiveStatus,
  mergeFilterSearchParams,
  OperationalContextBar,
  SignalMetric,
  SelectField,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { alpha } from '@mui/material/styles';

import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import type {
  OnboardingPlanRequest,
  ProviderOperation,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

import { ProviderOnboardingDialog } from './provider-onboarding-dialog';
import { ProviderOperationDialog } from './provider-operation-dialog';
import { GovernedSavedViewControl } from '../../components/governed-saved-view-control';
import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

const LIFECYCLE_STATES = ['ALL', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'RETIRED'] as const;
const SERVICE_TIERS = ['ALL', 'STANDARD', 'ENTERPRISE', 'REGULATED'] as const;
const ISOLATION_MODELS = ['ALL', 'POOL', 'BRIDGE', 'SILO'] as const;

function tenantServiceHealth(tenant: ProviderTenant): string {
  if (tenant.services.some((service) => service.lifecycleState === 'FAILED')) return 'FAILED';
  if (tenant.services.some((service) => service.lifecycleState === 'DEGRADED')) return 'DEGRADED';
  if (tenant.services.some((service) => service.lifecycleState === 'PROVISIONING')) {
    return 'PROVISIONING';
  }
  return 'READY';
}

export function ProviderTenants() {
  const { t } = useTranslation('provider');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = searchParams.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const state = searchParams.get('state') ?? 'ALL';
  const region = searchParams.get('region') ?? 'ALL';
  const serviceTier = searchParams.get('tier') ?? 'ALL';
  const isolationModel = searchParams.get('isolation') ?? 'ALL';
  const comparisonIds = useMemo(
    () => (searchParams.get('compare') ?? '').split(',').filter(Boolean).slice(0, 3),
    [searchParams]
  );
  const comparisonIdsRef = useRef(comparisonIds);
  useEffect(() => {
    comparisonIdsRef.current = comparisonIds;
  }, [comparisonIds]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [operation, setOperation] = useState<ProviderOperation | null>(null);
  const [busy, setBusy] = useState(false);
  const updateFilters = useCallback(
    (values: Record<string, string | null>) =>
      setSearchParams((current) => mergeFilterSearchParams(current, values), { replace: true }),
    [setSearchParams]
  );
  const currentViewConfiguration = useMemo(
    () => ({
      q: query,
      state,
      region,
      tier: serviceTier,
      isolation: isolationModel,
      compare: comparisonIds.join(','),
    }),
    [comparisonIds, isolationModel, query, region, serviceTier, state]
  );
  const selectedBuiltInViewId =
    !query &&
    region === 'ALL' &&
    serviceTier === 'ALL' &&
    isolationModel === 'ALL' &&
    comparisonIds.length === 0
      ? state === 'ALL'
        ? 'all-estate'
        : state === 'ACTIVE'
          ? 'active-estate'
          : state === 'PROVISIONING'
            ? 'onboarding-estate'
            : null
      : null;
  const builtInViews = useMemo(
    () => [
      {
        id: 'all-estate',
        name: t('tenants.savedViews.all'),
        configuration: {
          q: '',
          state: 'ALL',
          region: 'ALL',
          tier: 'ALL',
          isolation: 'ALL',
          compare: '',
        },
        isDefault: true,
      },
      {
        id: 'active-estate',
        name: t('tenants.savedViews.active'),
        configuration: {
          q: '',
          state: 'ACTIVE',
          region: 'ALL',
          tier: 'ALL',
          isolation: 'ALL',
          compare: '',
        },
      },
      {
        id: 'onboarding-estate',
        name: t('tenants.savedViews.onboarding'),
        configuration: {
          q: '',
          state: 'PROVISIONING',
          region: 'ALL',
          tier: 'ALL',
          isolation: 'ALL',
          compare: '',
        },
      },
    ],
    [t]
  );
  const applySavedView = useCallback(
    (configuration: Record<string, unknown>) => {
      const value = (key: string, fallback: string) =>
        typeof configuration[key] === 'string' ? String(configuration[key]) : fallback;
      updateFilters({
        q: value('q', ''),
        state: value('state', 'ALL') === 'ALL' ? null : value('state', 'ALL'),
        region: value('region', 'ALL') === 'ALL' ? null : value('region', 'ALL'),
        tier: value('tier', 'ALL') === 'ALL' ? null : value('tier', 'ALL'),
        isolation: value('isolation', 'ALL') === 'ALL' ? null : value('isolation', 'ALL'),
        compare: value('compare', '') || null,
      });
    },
    [updateFilters]
  );

  const tenants = useQuery({
    queryKey: ['provider', 'tenants', deferredQuery, state, region, serviceTier, isolationModel],
    queryFn: () =>
      listProviderTenants({
        query: deferredQuery,
        state: state === 'ALL' ? undefined : state,
        region: region === 'ALL' ? undefined : region,
        serviceTier: serviceTier === 'ALL' ? undefined : serviceTier,
        isolationModel: isolationModel === 'ALL' ? undefined : isolationModel,
        page: 0,
        size: 100,
      }),
  });
  const estate = useQuery({
    queryKey: ['provider', 'estate-overview'],
    queryFn: getProviderEstateOverview,
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
        valueGetter: (_value, row) => tenantServiceHealth(row),
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
    estate.isLoading ||
    entitlements.isLoading ||
    regions.isLoading ||
    (operator.isLoading && !operator.data)
  )
    return <ProviderLoading />;
  if (
    tenants.isError ||
    estate.isError ||
    entitlements.isError ||
    regions.isError ||
    (operator.isError && !operator.data)
  )
    return (
      <ProviderError
        error={
          tenants.error ?? estate.error ?? entitlements.error ?? regions.error ?? operator.error
        }
        onRetry={() =>
          void Promise.all([
            tenants.refetch(),
            estate.refetch(),
            entitlements.refetch(),
            regions.refetch(),
            operator.refetch(),
          ])
        }
        retrying={
          tenants.isFetching ||
          estate.isFetching ||
          entitlements.isFetching ||
          regions.isFetching ||
          operator.isFetching
        }
      />
    );

  const estateValue = estate.data;
  const visibleTenants = tenants.data?.content ?? [];
  const selectedTenants = comparisonIds
    .map((tenantId) => visibleTenants.find((tenant) => tenant.tenantId === tenantId))
    .filter((tenant): tenant is ProviderTenant => Boolean(tenant));
  const rowSelectionModel: GridRowSelectionModel = {
    type: 'include',
    ids: new Set(comparisonIds),
  };
  const hasFilters =
    Boolean(query.trim()) ||
    state !== 'ALL' ||
    region !== 'ALL' ||
    serviceTier !== 'ALL' ||
    isolationModel !== 'ALL';
  const resetFilters = () =>
    updateFilters({
      q: null,
      state: null,
      region: null,
      tier: null,
      isolation: null,
      compare: null,
    });
  const updateSelection = (model: GridRowSelectionModel) => {
    const incomingIds = model.type === 'include' ? [...model.ids].map(String) : [];
    const currentIds = comparisonIdsRef.current;
    const fastAddFromStaleGrid =
      incomingIds.some((id) => !currentIds.includes(id)) &&
      currentIds.some((id) => !incomingIds.includes(id));
    const ids = fastAddFromStaleGrid ? [...new Set([...currentIds, ...incomingIds])] : incomingIds;
    if (ids.length > 3) {
      toast.error(t('tenants.compare.limit'));
      return;
    }
    comparisonIdsRef.current = ids;
    updateFilters({ compare: ids.length ? ids.join(',') : null });
  };
  const attentionTenants = visibleTenants.filter((tenant) =>
    tenant.services.some((service) => ['DEGRADED', 'FAILED'].includes(service.lifecycleState))
  );
  const estateState = estateValue?.failedTenants
    ? 'CRITICAL'
    : estateValue?.provisioningTenants || estateValue?.suspendedTenants
      ? 'ATTENTION'
      : 'HEALTHY';
  const estateTone =
    estateState === 'CRITICAL' ? 'error' : estateState === 'ATTENTION' ? 'warning' : 'success';
  const observedAt = Math.max(tenants.dataUpdatedAt, estate.dataUpdatedAt);
  const totalRegionTenants = (estateValue?.regions ?? []).reduce(
    (sum, item) => sum + item.count,
    0
  );
  const totalTierTenants = (estateValue?.serviceTiers ?? []).reduce(
    (sum, item) => sum + item.count,
    0
  );
  const distributionColors = [
    foundationTokens.color.data.cobalt,
    foundationTokens.color.data.teal,
    foundationTokens.color.data.saffron,
    foundationTokens.color.data.coral,
    foundationTokens.color.data.cyan,
  ];

  return (
    <Stack gap={2.5} sx={{ width: 1, maxWidth: 1680, mx: 'auto' }}>
      <OperationalContextBar
        label={t('tenants.context.label')}
        items={[
          {
            label: t('tenants.context.scope'),
            value: t('tenants.context.global'),
            icon: <Globe2 size={16} />,
          },
          {
            label: t('tenants.context.coverage'),
            value: t('tenants.context.coverageValue', {
              organizations: estateValue?.organizations ?? 0,
              tenants: estateValue?.tenants ?? 0,
            }),
            icon: <Building2 size={16} />,
          },
          {
            label: t('tenants.context.placement'),
            value: t('tenants.context.placementValue', {
              regions: estateValue?.regions.length ?? 0,
              tiers: estateValue?.serviceTiers.length ?? 0,
            }),
            icon: <MapPin size={16} />,
          },
        ]}
        status={
          <LiveStatus
            state={tenants.isFetching || estate.isFetching ? 'syncing' : 'live'}
            label={t(
              tenants.isFetching || estate.isFetching ? 'tenants.live.syncing' : 'tenants.live.live'
            )}
            detail={t('tenants.context.lastLoaded', {
              value: formatProviderDate(new Date(observedAt).toISOString()),
            })}
            refreshLabel={t('actions.refresh')}
            refreshing={tenants.isFetching || estate.isFetching}
            onRefresh={() => void invalidate()}
          />
        }
      />

      <Paper
        component="section"
        variant="outlined"
        sx={(theme) => {
          const color = theme.palette[estateTone].main;
          return {
            position: 'relative',
            overflow: 'hidden',
            px: { xs: 2, md: 2.5 },
            py: { xs: 2, md: 2.25 },
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055),
            borderColor: alpha(color, 0.35),
            '&::before': {
              position: 'absolute',
              inset: '0 auto 0 0',
              width: 4,
              bgcolor: color,
              content: '""',
            },
          };
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0}>
            <Box
              aria-hidden="true"
              sx={{
                width: 38,
                height: 38,
                flex: '0 0 38px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: `${estateTone}.main`,
                bgcolor: 'background.paper',
              }}
            >
              {estateState === 'HEALTHY' ? <ShieldCheck size={20} /> : <TriangleAlert size={20} />}
            </Box>
            <Box minWidth={0}>
              <Typography component="h2" variant="h5">
                {t(`tenants.pulse.title.${estateState}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`tenants.pulse.detail.${estateState}`, {
                  failed: estateValue?.failedTenants ?? 0,
                  provisioning: estateValue?.provisioningTenants ?? 0,
                  suspended: estateValue?.suspendedTenants ?? 0,
                })}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={estateValue?.failedTenants ? 'error' : 'success'}
                  label={t('tenants.pulse.failed', { count: estateValue?.failedTenants ?? 0 })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={estateValue?.provisioningTenants ? 'info' : 'default'}
                  label={t('tenants.pulse.provisioning', {
                    count: estateValue?.provisioningTenants ?? 0,
                  })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={estateValue?.suspendedTenants ? 'warning' : 'default'}
                  label={t('tenants.pulse.suspended', {
                    count: estateValue?.suspendedTenants ?? 0,
                  })}
                />
              </Stack>
            </Box>
          </Stack>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<Plus size={17} />}
              onClick={() => setOnboardingOpen(true)}
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
            >
              {t('tenants.actions.onboard')}
            </Button>
          )}
        </Stack>
      </Paper>

      <Box
        component="section"
        aria-label={t('tenants.signals.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <SignalMetric
          label={t('tenants.metrics.organizations')}
          value={(estateValue?.organizations ?? 0).toLocaleString()}
          detail={t('tenants.signals.organizationDetail', {
            tenants: estateValue?.tenants ?? 0,
          })}
          icon={<Building2 size={18} />}
          tone="info"
        />
        <SignalMetric
          label={t('tenants.metrics.active')}
          value={(estateValue?.activeTenants ?? 0).toLocaleString()}
          detail={t('tenants.signals.activeDetail', { total: estateValue?.tenants ?? 0 })}
          icon={<Server size={18} />}
          tone="success"
          progress={
            estateValue?.tenants
              ? ((estateValue.activeTenants ?? 0) / estateValue.tenants) * 100
              : undefined
          }
          progressLabel={t('tenants.signals.activeProgress', {
            active: estateValue?.activeTenants ?? 0,
            total: estateValue?.tenants ?? 0,
          })}
        />
        <SignalMetric
          label={t('tenants.signals.provisioning')}
          value={(estateValue?.provisioningTenants ?? 0).toLocaleString()}
          detail={t('tenants.signals.provisioningDetail')}
          icon={<Layers3 size={18} />}
          tone={estateValue?.provisioningTenants ? 'info' : 'neutral'}
        />
        <SignalMetric
          label={t('tenants.metrics.attention')}
          value={(
            (estateValue?.failedTenants ?? 0) + (estateValue?.suspendedTenants ?? 0)
          ).toLocaleString()}
          detail={t('tenants.signals.attentionDetail', {
            failed: estateValue?.failedTenants ?? 0,
            suspended: estateValue?.suspendedTenants ?? 0,
          })}
          icon={<TriangleAlert size={18} />}
          tone={
            estateValue?.failedTenants
              ? 'error'
              : estateValue?.suspendedTenants
                ? 'warning'
                : 'success'
          }
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 9fr) minmax(300px, 3fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
          <ProviderSectionHeading
            title={t('tenants.title')}
            description={t('tenants.description')}
            action={
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <GovernedSavedViewControl
                  surfaceKey="provider.customer-estate"
                  currentConfiguration={currentViewConfiguration}
                  builtInViews={builtInViews}
                  selectedBuiltInViewId={selectedBuiltInViewId}
                  onApply={applySavedView}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('tenants.results', {
                    visible: visibleTenants.length,
                    total: tenants.data?.totalElements ?? 0,
                  })}
                />
              </Stack>
            }
          />
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            alignItems={{ xs: 'stretch', lg: 'center' }}
            gap={1}
            sx={{ my: 1.75 }}
          >
            <TextField
              size="small"
              value={query}
              onChange={(event) => updateFilters({ q: event.target.value || null })}
              label={t('tenants.search')}
              sx={{ minWidth: { lg: 300 } }}
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
            <Box sx={{ minWidth: 0, overflowX: 'auto' }}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={state}
                onChange={(_event, value: string | null) =>
                  value && updateFilters({ state: value === 'ALL' ? null : value })
                }
                aria-label={t('fields.lifecycle')}
                sx={{ minWidth: 'max-content' }}
              >
                {LIFECYCLE_STATES.map((value) => (
                  <ToggleButton key={value} value={value}>
                    {t(`states.${value}`, { defaultValue: value })}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            gap={1}
            sx={{ mb: 1.75 }}
          >
            <SelectField
              size="small"
              label={t('tenants.filters.region')}
              value={region}
              options={[
                { value: 'ALL', label: t('tenants.filters.allRegions') },
                ...(regions.data ?? []).map((item) => ({
                  value: item.regionKey,
                  label: item.displayName,
                })),
              ]}
              onValueChange={(value) =>
                updateFilters({ region: value === 'ALL' ? null : String(value) })
              }
              sx={{ minWidth: { sm: 180 } }}
            />
            <SelectField
              size="small"
              label={t('tenants.filters.tier')}
              value={serviceTier}
              options={SERVICE_TIERS.map((value) => ({
                value,
                label:
                  value === 'ALL'
                    ? t('tenants.filters.allTiers')
                    : t(`tiers.${value}`, { defaultValue: value }),
              }))}
              onValueChange={(value) =>
                updateFilters({ tier: value === 'ALL' ? null : String(value) })
              }
              sx={{ minWidth: { sm: 160 } }}
            />
            <SelectField
              size="small"
              label={t('tenants.filters.isolation')}
              value={isolationModel}
              options={ISOLATION_MODELS.map((value) => ({
                value,
                label:
                  value === 'ALL'
                    ? t('tenants.filters.allIsolation')
                    : t(`isolation.${value}`, { defaultValue: value }),
              }))}
              onValueChange={(value) =>
                updateFilters({
                  isolation: value === 'ALL' ? null : String(value),
                })
              }
              sx={{ minWidth: { sm: 160 } }}
            />
            {hasFilters && (
              <ActionButton intent="quiet" onClick={resetFilters} sx={{ alignSelf: 'center' }}>
                {t('tenants.empty.reset')}
              </ActionButton>
            )}
          </Stack>

          {selectedTenants.length > 0 && (
            <Box
              component="section"
              aria-label={t('tenants.compare.title')}
              sx={{
                mb: 1.75,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
                overflow: 'hidden',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                gap={1}
                sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
              >
                <Stack direction="row" alignItems="center" gap={1}>
                  <GitCompareArrows size={17} aria-hidden="true" />
                  <Box>
                    <Typography component="h3" variant="subtitle2">
                      {t('tenants.compare.title')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedTenants.length < 2
                        ? t('tenants.compare.selectMore')
                        : t('tenants.compare.description', { count: selectedTenants.length })}
                    </Typography>
                  </Box>
                </Stack>
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => updateFilters({ compare: null })}
                >
                  {t('tenants.compare.clear')}
                </ActionButton>
              </Stack>
              <Box sx={{ overflowX: 'auto' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${selectedTenants.length}, minmax(230px, 1fr))`,
                    minWidth: selectedTenants.length > 1 ? selectedTenants.length * 230 : 0,
                  }}
                >
                  {selectedTenants.map((tenant, index) => (
                    <Box
                      key={tenant.tenantId}
                      sx={{
                        minWidth: 0,
                        p: 1.5,
                        borderLeft: index ? 1 : 0,
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="subtitle2" noWrap title={tenant.displayName}>
                        {tenant.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {tenant.tenantKey} / {tenant.environmentKey}
                      </Typography>
                      <Stack gap={0.85} sx={{ mt: 1.25 }}>
                        {[
                          [t('tenants.columns.region'), tenant.dataRegion],
                          [
                            t('tenants.columns.tier'),
                            t(`tiers.${tenant.serviceTier}`, { defaultValue: tenant.serviceTier }),
                          ],
                          [
                            t('tenants.columns.isolation'),
                            t(`isolation.${tenant.isolationModel}`, {
                              defaultValue: tenant.isolationModel,
                            }),
                          ],
                          [
                            t('tenants.columns.subscription'),
                            tenant.subscription?.planName ?? t('tenants.noSubscription'),
                          ],
                        ].map(([label, value]) => (
                          <Stack key={label} direction="row" justifyContent="space-between" gap={1}>
                            <Typography variant="caption" color="text.secondary">
                              {label}
                            </Typography>
                            <Typography variant="caption" fontWeight={700} textAlign="right">
                              {value}
                            </Typography>
                          </Stack>
                        ))}
                        <Stack direction="row" justifyContent="space-between" gap={1}>
                          <Typography variant="caption" color="text.secondary">
                            {t('tenants.columns.health')}
                          </Typography>
                          <ProviderStatusChip state={tenantServiceHealth(tenant)} />
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          {visibleTenants.length > 0 ? (
            <EnterpriseDataGrid
              ariaLabel={t('tenants.title')}
              rows={visibleTenants}
              columns={columns}
              getRowId={(row) => row.tenantId}
              checkboxSelection
              disableRowSelectionOnClick
              rowSelectionModel={rowSelectionModel}
              onRowSelectionModelChange={updateSelection}
              isRowSelectable={({ id }) =>
                comparisonIds.includes(String(id)) || comparisonIds.length < 3
              }
              onRowClick={({ row }) => navigate(`/provider/tenants/${row.tenantId}`)}
              loading={tenants.isFetching}
              hideFooter
              maxVisibleRows={12}
              sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            />
          ) : (
            <GuidedEmptyState
              kind={hasFilters ? 'no-results' : 'first-use'}
              title={
                hasFilters ? t('tenants.empty.noResultsTitle') : t('tenants.empty.firstUseTitle')
              }
              description={
                hasFilters
                  ? t('tenants.empty.noResultsDescription')
                  : t('tenants.empty.firstUseDescription')
              }
              actionLabel={
                hasFilters
                  ? t('tenants.empty.reset')
                  : canWrite
                    ? t('tenants.actions.onboard')
                    : undefined
              }
              onAction={
                hasFilters ? resetFilters : canWrite ? () => setOnboardingOpen(true) : undefined
              }
              size="standard"
            />
          )}
        </Paper>

        <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
          <ProviderSectionHeading
            title={t('tenants.mix.title')}
            description={t('tenants.mix.description')}
          />
          <Stack gap={2.25} sx={{ mt: 1.75 }}>
            <Box>
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1 }}>
                <MapPin size={16} />
                <Typography variant="subtitle2">{t('tenants.mix.regions')}</Typography>
              </Stack>
              <Stack gap={1.25}>
                {(estateValue?.regions ?? []).map((item, index) => (
                  <Box key={item.key}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2">{item.key}</Typography>
                      <Typography variant="body2" fontWeight={750}>
                        {item.count}
                      </Typography>
                    </Stack>
                    <DistributionBar
                      height={6}
                      label={t('tenants.mix.distributionLabel', {
                        label: item.key,
                        count: item.count,
                        total: totalRegionTenants,
                      })}
                      segments={[
                        {
                          key: item.key,
                          value: item.count,
                          color: distributionColors[index % distributionColors.length],
                        },
                        {
                          key: 'remaining',
                          value: Math.max(0, totalRegionTenants - item.count),
                          color: foundationTokens.color.neutral[100],
                        },
                      ]}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
            <Box>
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1 }}>
                <Layers3 size={16} />
                <Typography variant="subtitle2">{t('tenants.mix.tiers')}</Typography>
              </Stack>
              <Stack gap={1.25}>
                {(estateValue?.serviceTiers ?? []).map((item, index) => (
                  <Box key={item.key}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2">
                        {t(`tiers.${item.key}`, { defaultValue: item.key })}
                      </Typography>
                      <Typography variant="body2" fontWeight={750}>
                        {item.count}
                      </Typography>
                    </Stack>
                    <DistributionBar
                      height={6}
                      label={t('tenants.mix.distributionLabel', {
                        label: t(`tiers.${item.key}`, { defaultValue: item.key }),
                        count: item.count,
                        total: totalTierTenants,
                      })}
                      segments={[
                        {
                          key: item.key,
                          value: item.count,
                          color: distributionColors[(index + 1) % distributionColors.length],
                        },
                        {
                          key: 'remaining',
                          value: Math.max(0, totalTierTenants - item.count),
                          color: foundationTokens.color.neutral[100],
                        },
                      ]}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('tenants.mix.visibleAttention', { count: attentionTenants.length })}
            </Typography>
          </Stack>
        </Paper>
      </Box>

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
