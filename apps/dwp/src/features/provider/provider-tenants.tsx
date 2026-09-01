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
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import {
  executeProviderOperation,
  getProviderEstateOverview,
  getProviderOperatorProfile,
  getProviderTenant,
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

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { alpha } from '@mui/material/styles';

import type { GridRowSelectionModel } from '@mui/x-data-grid';
import type {
  OnboardingPlanRequest,
  ProviderOperation,
  ProviderTenant,
} from '@dwp-frontend/shared-utils';

import { ProviderOnboardingDialog } from './provider-onboarding-dialog';
import { ProviderOperationDialog } from './provider-operation-dialog';
import { useProviderTenantColumns } from './provider-tenant-columns';
import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';
import {
  PROVIDER_TENANT_ISOLATION_MODELS,
  PROVIDER_TENANT_LIFECYCLE_STATES,
  PROVIDER_TENANT_PAGE_SIZES,
  PROVIDER_TENANT_SERVICE_TIERS,
  providerEstateState,
  providerTenantPagination,
  providerTenantServiceHealth,
} from './provider-tenant-estate-model';
import { providerOperationalSnapshotState } from './provider-operational-freshness';

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
  const paginationModel = providerTenantPagination(
    searchParams.get('page'),
    searchParams.get('size')
  );
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
  const updateTenantFilters = useCallback(
    (values: Record<string, string | null>) => updateFilters({ ...values, page: null }),
    [updateFilters]
  );
  const tenants = useQuery({
    queryKey: [
      'provider',
      'tenants',
      deferredQuery,
      state,
      region,
      serviceTier,
      isolationModel,
      paginationModel.page,
      paginationModel.pageSize,
    ],
    queryFn: () =>
      listProviderTenants({
        query: deferredQuery,
        state: state === 'ALL' ? undefined : state,
        region: region === 'ALL' ? undefined : region,
        serviceTier: serviceTier === 'ALL' ? undefined : serviceTier,
        isolationModel: isolationModel === 'ALL' ? undefined : isolationModel,
        page: paginationModel.page,
        size: paginationModel.pageSize,
      }),
    placeholderData: (previous) => previous,
    refetchInterval: 60_000,
  });
  const estate = useQuery({
    queryKey: ['provider', 'estate-overview'],
    queryFn: getProviderEstateOverview,
    refetchInterval: 60_000,
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
  const comparisonTenants = useQueries({
    queries: comparisonIds.map((tenantId) => ({
      queryKey: ['provider', 'tenant', tenantId],
      queryFn: () => getProviderTenant(tenantId),
      staleTime: 60_000,
    })),
  });
  const canWrite = operator.data?.permissions.includes('TENANT_WRITE') ?? false;
  const onboardingCatalogReady = entitlements.isSuccess && regions.isSuccess;
  const onboardingCatalogUnavailable = entitlements.isError || regions.isError;
  const canOnboard = canWrite && onboardingCatalogReady;

  const columns = useProviderTenantColumns();

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

  if (tenants.isLoading || estate.isLoading || (operator.isLoading && !operator.data))
    return <ProviderLoading />;
  if (tenants.isError || estate.isError || (operator.isError && !operator.data))
    return (
      <ProviderError
        error={tenants.error ?? estate.error ?? operator.error}
        onRetry={() => void Promise.all([tenants.refetch(), estate.refetch(), operator.refetch()])}
        retrying={tenants.isFetching || estate.isFetching || operator.isFetching}
      />
    );

  const estateValue = estate.data;
  const visibleTenants = tenants.data?.content ?? [];
  const selectedTenants = comparisonIds
    .map(
      (tenantId, index) =>
        visibleTenants.find((tenant) => tenant.tenantId === tenantId) ??
        comparisonTenants[index]?.data
    )
    .filter((tenant): tenant is ProviderTenant => Boolean(tenant));
  const comparisonUnavailable = comparisonTenants.some((query) => query.isError);
  const comparisonLoading = comparisonTenants.some((query) => query.isLoading && !query.data);
  const comparisonDescription = comparisonLoading
    ? t('tenants.compare.loading')
    : comparisonUnavailable && selectedTenants.length === 0
      ? t('tenants.compare.allUnavailable')
      : comparisonUnavailable
        ? t('tenants.compare.partial', {
            available: selectedTenants.length,
            total: comparisonIds.length,
          })
        : comparisonIds.length < 2
          ? t('tenants.compare.selectMore')
          : t('tenants.compare.description', { count: selectedTenants.length });
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
    updateTenantFilters({
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
  const estateState = providerEstateState(estateValue);
  const estateTone =
    estateState === 'CRITICAL' ? 'error' : estateState === 'ATTENTION' ? 'warning' : 'success';
  const loadedAt = Math.max(tenants.dataUpdatedAt, estate.dataUpdatedAt);
  const liveState = providerOperationalSnapshotState({
    fetching: tenants.isFetching || estate.isFetching,
    partial: onboardingCatalogUnavailable,
    sourceObservedAt: 0,
  });
  const liveLabel =
    liveState === 'stale'
      ? t('tenants.live.loadedWithoutSourceTime')
      : t(`tenants.live.${liveState}`);
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
    <Stack data-testid="provider-tenants-canvas" gap={2.5} sx={{ width: 1, minWidth: 0 }}>
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
            state={liveState}
            label={liveLabel}
            detail={t('tenants.context.lastLoaded', {
              value: formatProviderDate(new Date(loadedAt).toISOString()),
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
              disabled={!onboardingCatalogReady}
              onClick={() => setOnboardingOpen(true)}
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
            >
              {t('tenants.actions.onboard')}
            </Button>
          )}
        </Stack>
      </Paper>
      {canWrite && onboardingCatalogUnavailable && (
        <Alert
          severity="warning"
          action={
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => void Promise.all([entitlements.refetch(), regions.refetch()])}
            >
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('tenants.onboardingCatalogUnavailable')}
        </Alert>
      )}
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
          value={formatNumber(estateValue?.organizations ?? 0)}
          detail={t('tenants.signals.organizationDetail', {
            tenants: estateValue?.tenants ?? 0,
          })}
          icon={<Building2 size={18} />}
          tone="info"
        />
        <SignalMetric
          label={t('tenants.metrics.active')}
          value={formatNumber(estateValue?.activeTenants ?? 0)}
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
          value={formatNumber(estateValue?.provisioningTenants ?? 0)}
          detail={t('tenants.signals.provisioningDetail')}
          icon={<Layers3 size={18} />}
          tone={estateValue?.provisioningTenants ? 'info' : 'neutral'}
        />
        <SignalMetric
          label={t('tenants.metrics.attention')}
          value={formatNumber(
            (estateValue?.failedTenants ?? 0) + (estateValue?.suspendedTenants ?? 0)
          )}
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
              onChange={(event) => updateTenantFilters({ q: event.target.value || null })}
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
                  value && updateTenantFilters({ state: value === 'ALL' ? null : value })
                }
                aria-label={t('fields.lifecycle')}
                sx={{ minWidth: 'max-content' }}
              >
                {PROVIDER_TENANT_LIFECYCLE_STATES.map((value) => (
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
                updateTenantFilters({ region: value === 'ALL' ? null : String(value) })
              }
              sx={{ minWidth: { sm: 180 } }}
            />
            <SelectField
              size="small"
              label={t('tenants.filters.tier')}
              value={serviceTier}
              options={PROVIDER_TENANT_SERVICE_TIERS.map((value) => ({
                value,
                label:
                  value === 'ALL'
                    ? t('tenants.filters.allTiers')
                    : t(`tiers.${value}`, { defaultValue: value }),
              }))}
              onValueChange={(value) =>
                updateTenantFilters({ tier: value === 'ALL' ? null : String(value) })
              }
              sx={{ minWidth: { sm: 160 } }}
            />
            <SelectField
              size="small"
              label={t('tenants.filters.isolation')}
              value={isolationModel}
              options={PROVIDER_TENANT_ISOLATION_MODELS.map((value) => ({
                value,
                label:
                  value === 'ALL'
                    ? t('tenants.filters.allIsolation')
                    : t(`isolation.${value}`, { defaultValue: value }),
              }))}
              onValueChange={(value) =>
                updateTenantFilters({
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

          {comparisonIds.length > 0 && (
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
                      {comparisonDescription}
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
              {comparisonUnavailable && (
                <Alert severity="warning" square>
                  {t('tenants.compare.unavailable')}
                </Alert>
              )}
              {comparisonLoading && (
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={1}
                  role="status"
                  sx={{ px: 1.5, py: 2 }}
                >
                  <CircularProgress size={18} aria-hidden="true" />
                  <Typography variant="body2">{t('tenants.compare.loading')}</Typography>
                </Stack>
              )}
              {selectedTenants.length > 0 && (
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
                              t(`tiers.${tenant.serviceTier}`, {
                                defaultValue: tenant.serviceTier,
                              }),
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
                            <Stack
                              key={label}
                              direction="row"
                              justifyContent="space-between"
                              gap={1}
                            >
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
                            <ProviderStatusChip state={providerTenantServiceHealth(tenant)} />
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
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
              mode="server"
              rowCount={tenants.data?.totalElements ?? 0}
              paginationModel={paginationModel}
              onPaginationModelChange={(next) =>
                updateFilters({
                  page: next.page > 0 ? String(next.page + 1) : null,
                  size: next.pageSize === 25 ? null : String(next.pageSize),
                })
              }
              pageSizeOptions={[...PROVIDER_TENANT_PAGE_SIZES]}
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
                  : canOnboard
                    ? t('tenants.actions.onboard')
                    : undefined
              }
              onAction={
                hasFilters ? resetFilters : canOnboard ? () => setOnboardingOpen(true) : undefined
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
