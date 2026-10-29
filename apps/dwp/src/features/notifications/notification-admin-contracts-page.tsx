import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Search } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  getNotificationTypeContracts,
  NOTIFICATION_API_CAPABILITIES,
  type NotificationContractState,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { ActionButton, EmptyState, FormField, LoadingState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NotificationAdminCapabilityUnavailable } from './notification-admin-capability-unavailable';
import { NotificationAdminContractDetail } from './notification-admin-contract-detail';
import { NotificationErrorState } from './notification-error-support';
import { notificationQueryKeys } from './integration-contract';
import { NotificationResponsiveCatalog } from './notification-responsive-catalog';

function contractHealthColor(value: string): 'success' | 'warning' | 'error' | 'default' {
  if (['HEALTHY', 'ACTIVE', 'CLOSED'].includes(value)) return 'success';
  if (['ATTENTION', 'DEGRADED', 'HALF_OPEN', 'IN_REVIEW'].includes(value)) return 'warning';
  if (['CRITICAL', 'BROKEN', 'OUTAGE', 'OPEN', 'QUARANTINED'].includes(value)) return 'error';
  return 'default';
}

export function NotificationTypeCatalogPage() {
  const { t } = useTranslation('notifications');
  const [searchParams] = useSearchParams();
  const requestedContractId = searchParams.get('contractId')?.trim() ?? '';
  const requestedQuery = (searchParams.get('query')?.trim() ?? '').slice(0, 120);
  const requestedAppKey = (searchParams.get('appKey')?.trim() ?? '').slice(0, 100);
  const [queryText, setQueryText] = useState(requestedQuery);
  const [appKey, setAppKey] = useState(requestedAppKey);
  const [state, setState] = useState<NotificationContractState | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [knownApps, setKnownApps] = useState<Map<string, string>>(new Map());
  const query = useInfiniteQuery({
    queryKey: notificationQueryKeys.adminTypes({ query: queryText.trim(), appKey, state }),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      getNotificationTypeContracts(
        {
          cursor: pageParam,
          limit: 40,
          query: queryText,
          appKey: appKey || undefined,
          state: state === 'ALL' ? undefined : state,
        },
        signal
      ),
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    staleTime: 30_000,
    retry: 1,
    enabled: NOTIFICATION_API_CAPABILITIES.tenantAdmin,
  });
  const contracts = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data?.pages]
  );
  useEffect(() => {
    setQueryText(requestedQuery);
    setAppKey(requestedAppKey);
  }, [requestedAppKey, requestedQuery]);
  useEffect(() => {
    if (!requestedContractId) return;
    if (contracts.some((contract) => contract.contractId === requestedContractId)) {
      setSelectedId(requestedContractId);
      setMobileDetailOpen(true);
    }
  }, [contracts, requestedContractId]);
  useEffect(() => {
    if (contracts.length === 0) return;
    setKnownApps((current) => {
      const next = new Map(current);
      for (const contract of contracts) next.set(contract.appKey, contract.appName);
      return next.size === current.size &&
        [...next].every(([key, value]) => current.get(key) === value)
        ? current
        : next;
    });
  }, [contracts]);
  const appOptions = useMemo(
    () => [...knownApps.entries()].sort((left, right) => left[1].localeCompare(right[1])),
    [knownApps]
  );
  if (!NOTIFICATION_API_CAPABILITIES.tenantAdmin) {
    return <NotificationAdminCapabilityUnavailable />;
  }
  const selected =
    contracts.find((contract) => contract.contractId === selectedId) ??
    contracts.find((contract) => contract.contractId === requestedContractId) ??
    contracts[0] ??
    null;

  return (
    <Stack gap={1.5} data-testid="notification-contract-catalog">
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25}>
        <FormField
          fullWidth={false}
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          placeholder={t('admin.contracts.searchPlaceholder')}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: { xs: '100%', sm: 'auto' },
            minWidth: 0,
            flex: { xs: '0 0 auto', sm: '1 1 320px' },
          }}
        />
        <FormField
          fullWidth={false}
          select
          label={t('admin.contracts.appFilter')}
          value={appKey}
          onChange={(event) => setAppKey(event.target.value)}
          sx={{ width: { xs: '100%', sm: 220 }, flex: '0 0 auto' }}
        >
          <MenuItem value="">{t('admin.contracts.allApps')}</MenuItem>
          {appOptions.map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </FormField>
        <FormField
          fullWidth={false}
          select
          label={t('admin.contracts.stateFilter')}
          value={state}
          onChange={(event) => setState(event.target.value as NotificationContractState | 'ALL')}
          sx={{ width: { xs: '100%', sm: 220 }, flex: '0 0 auto' }}
        >
          <MenuItem value="ALL">{t('admin.contracts.allStates')}</MenuItem>
          {(['DRAFT', 'IN_REVIEW', 'ACTIVE', 'DEPRECATED', 'RETIRED', 'QUARANTINED'] as const).map(
            (value) => (
              <MenuItem key={value} value={value}>
                {t(`admin.contractState.${value}`)}
              </MenuItem>
            )
          )}
        </FormField>
      </Stack>

      {query.isLoading ? (
        <LoadingState
          label={t('states.loadingContracts')}
          variant="skeleton"
          skeletonRows={8}
          size="page"
        />
      ) : query.isError ? (
        <NotificationErrorState
          error={query.error}
          title={t('states.contractsErrorTitle')}
          description={t('states.contractsErrorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      ) : contracts.length === 0 ? (
        <EmptyState
          title={t('admin.contracts.emptyTitle')}
          description={t('admin.contracts.emptyDescription')}
          size="page"
        />
      ) : (
        <NotificationResponsiveCatalog
          testId="notification-contract-results"
          detailOpen={mobileDetailOpen}
          onBack={() => setMobileDetailOpen(false)}
          backLabel={t('admin.backToCatalog')}
          listLabel={t('admin.contracts.catalogLabel')}
          detailLabel={t('admin.contracts.detailLabel')}
          desktopColumns="minmax(0, 1.15fr) minmax(0, 1fr)"
          listMaxHeight={700}
          list={
            <>
              <Box
                sx={{
                  display: { xs: 'none', lg: 'grid' },
                  gridTemplateColumns: 'minmax(0, 1fr) 90px 90px',
                  gap: 1,
                  px: 1.75,
                  py: 1,
                  bgcolor: 'action.hover',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                {['sourceEvent', 'schemaVersion', 'priority'].map((field) => (
                  <Typography key={field} variant="caption" color="text.secondary">
                    {t(`admin.contracts.fields.${field}`)}
                  </Typography>
                ))}
              </Box>
              {contracts.map((contract) => (
                <ButtonBase
                  key={contract.contractId}
                  data-testid={`notification-contract-row-${contract.contractId}`}
                  onClick={() => {
                    setSelectedId(contract.contractId);
                    setMobileDetailOpen(true);
                  }}
                  aria-pressed={contract.contractId === selected?.contractId}
                  sx={{
                    width: 1,
                    px: 1.75,
                    py: 1.25,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr) auto',
                      lg: 'minmax(0, 1fr) 90px 90px',
                    },
                    gap: 1,
                    textAlign: 'left',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor:
                      contract.contractId === selected?.contractId ? 'action.selected' : undefined,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box minWidth={0}>
                    <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                      {contract.displayName}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', overflowWrap: 'anywhere' }}
                    >
                      {contract.appName} · {contract.typeKey}
                    </Typography>
                    <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={contractHealthColor(contract.state)}
                        label={t(`admin.contractState.${contract.state}`)}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        color={contractHealthColor(contract.contractHealth)}
                        label={t(`admin.contractHealth.${contract.contractHealth}`)}
                      />
                    </Stack>
                  </Box>
                  <Typography
                    component="code"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', lg: 'block' }, overflowWrap: 'anywhere' }}
                  >
                    {`v${contract.minSchemaVersion ?? contract.schemaVersion}-v${contract.maxSchemaVersion ?? contract.schemaVersion}`}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: { xs: 'none', lg: 'block' },
                      color: contract.priority === 'URGENT' ? 'error.main' : 'text.secondary',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {t(`priority.${contract.priority}`)}
                  </Typography>
                  <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
                    <ChevronRight size={18} aria-hidden />
                  </Box>
                </ButtonBase>
              ))}
              {query.hasNextPage && (
                <Box sx={{ p: 1.5, display: 'grid', placeItems: 'center' }}>
                  <ActionButton
                    intent="secondary"
                    loading={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                  >
                    {t('actions.loadMore')}
                  </ActionButton>
                </Box>
              )}
            </>
          }
          detail={selected && <NotificationAdminContractDetail contract={selected} />}
        />
      )}
    </Stack>
  );
}
