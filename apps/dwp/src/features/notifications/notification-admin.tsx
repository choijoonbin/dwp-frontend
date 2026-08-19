import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  FileCode2,
  RadioTower,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getNotificationAdminOverview,
  getNotificationDeliveryOperations,
  getNotificationTypeContracts,
  NOTIFICATION_API_CAPABILITIES,
  type NotificationAdminMetric,
  type NotificationContractState,
  type NotificationOperationalFinding,
  type NotificationTypeContract,
} from '@dwp-frontend/shared-utils/api/notification-api';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FormField,
  LiveStatus,
  LoadingState,
  OperationalKpiStrip,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';
import { NotificationPageHeading } from './notification-ui';
import { useOnlineStatus } from './use-notification-runtime';

import type { ReactNode } from 'react';

type NotificationAdminView = 'overview' | 'contracts' | 'operations';

function metricTone(
  metric: NotificationAdminMetric
): 'neutral' | 'info' | 'success' | 'warning' | 'critical' {
  if (metric.state === 'CRITICAL') return 'critical';
  if (metric.state === 'ATTENTION') return 'warning';
  if (metric.state === 'HEALTHY') return 'success';
  return 'neutral';
}

function NotificationAdminCapabilityUnavailable() {
  const { t } = useTranslation('notifications');
  return (
    <EmptyState
      icon={<ShieldCheck size={28} />}
      title={t('admin.capabilityUnavailable.title')}
      description={t('admin.capabilityUnavailable.description')}
      size="page"
    />
  );
}

function findingColor(
  severity: NotificationOperationalFinding['severity']
): 'default' | 'warning' | 'error' {
  if (severity === 'CRITICAL') return 'error';
  if (severity === 'WARNING') return 'warning';
  return 'default';
}

function healthColor(value: string): 'success' | 'warning' | 'error' | 'default' {
  if (['HEALTHY', 'ACTIVE', 'CLOSED'].includes(value)) return 'success';
  if (['ATTENTION', 'DEGRADED', 'HALF_OPEN', 'IN_REVIEW'].includes(value)) return 'warning';
  if (['CRITICAL', 'BROKEN', 'OUTAGE', 'OPEN', 'QUARANTINED'].includes(value)) return 'error';
  return 'default';
}

function AdminSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
        <Box minWidth={0}>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {description}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      <Box sx={{ mt: 1.5 }}>{children}</Box>
    </Box>
  );
}

function FindingQueue({
  findings,
  onOpenFinding,
}: {
  findings: NotificationOperationalFinding[];
  onOpenFinding?: (finding: NotificationOperationalFinding) => void;
}) {
  const { t } = useTranslation('notifications');
  if (findings.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck size={28} />}
        title={t('admin.findings.emptyTitle')}
        description={t('admin.findings.emptyDescription')}
        size="compact"
      />
    );
  }
  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      {findings.map((finding) => (
        <ButtonBase
          key={finding.findingId}
          onClick={() => onOpenFinding?.(finding)}
          disabled={!onOpenFinding && !finding.href}
          component={finding.href && !onOpenFinding ? 'a' : 'button'}
          href={finding.href && !onOpenFinding ? finding.href : undefined}
          sx={{
            width: 1,
            minHeight: 70,
            px: 1.5,
            py: 1.25,
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gap: 1.25,
            alignItems: 'start',
            textAlign: 'left',
            borderBottom: 1,
            borderColor: 'divider',
            '&:last-of-type': { borderBottom: 0 },
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <AlertTriangle size={18} />
          <Box minWidth={0}>
            <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle2">{finding.title}</Typography>
              <Chip
                size="small"
                variant="outlined"
                color={findingColor(finding.severity)}
                label={t(`admin.severity.${finding.severity}`)}
              />
              {finding.count > 1 && <Chip size="small" variant="outlined" label={finding.count} />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {finding.detail}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(finding.detectedAt, { dateStyle: 'medium', timeStyle: 'short' })}
              {finding.ownerLabel ? ` · ${finding.ownerLabel}` : ''}
            </Typography>
          </Box>
          {(onOpenFinding || finding.href) && <ChevronRight size={18} />}
        </ButtonBase>
      ))}
    </Box>
  );
}

export function NotificationAdminOverviewPage({
  onOpenFinding,
}: {
  onOpenFinding?: (finding: NotificationOperationalFinding) => void;
}) {
  const { t } = useTranslation('notifications');
  const online = useOnlineStatus();
  const query = useQuery({
    queryKey: notificationQueryKeys.adminOverview(),
    queryFn: ({ signal }) => getNotificationAdminOverview(signal),
    staleTime: 20_000,
    refetchInterval: online ? 30_000 : false,
    retry: 1,
    enabled: NOTIFICATION_API_CAPABILITIES.tenantAdmin,
  });

  if (!NOTIFICATION_API_CAPABILITIES.tenantAdmin) {
    return <NotificationAdminCapabilityUnavailable />;
  }

  if (query.isLoading) {
    return (
      <LoadingState
        label={t('states.loadingAdmin')}
        variant="skeleton"
        skeletonRows={8}
        size="page"
      />
    );
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={t('states.adminErrorTitle')}
        description={t('states.adminErrorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        size="page"
      />
    );
  }

  const data = query.data;
  return (
    <Stack gap={3}>
      {data.partial && (
        <Alert severity="warning">
          {t('states.partial', { count: data.unavailableSources.length })}
        </Alert>
      )}
      <OperationalKpiStrip
        ariaLabel={t('admin.overview.metricsLabel')}
        items={data.metrics.map((metric) => ({
          key: metric.key,
          label: metric.label,
          value: `${formatNumber(metric.value)}${metric.unit ?? ''}`,
          trend:
            metric.baseline == null
              ? undefined
              : t('admin.overview.baseline', { value: formatNumber(metric.baseline) }),
          tone: metricTone(metric),
        }))}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.1fr) minmax(360px, .9fr)' },
          gap: 3,
        }}
      >
        <AdminSection
          title={t('admin.overview.trendTitle')}
          description={t('admin.overview.trendDescription')}
        >
          <Box sx={{ overflowX: 'auto', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Table
              size="small"
              aria-label={t('admin.overview.trendTableLabel')}
              sx={{ minWidth: 620 }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>{t('admin.overview.columns.time')}</TableCell>
                  <TableCell align="right">{t('admin.overview.columns.created')}</TableCell>
                  <TableCell align="right">{t('admin.overview.columns.actionable')}</TableCell>
                  <TableCell align="right">{t('admin.overview.columns.failed')}</TableCell>
                  <TableCell align="right">{t('admin.overview.columns.muted')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.trend.map((point) => (
                  <TableRow key={point.bucket}>
                    <TableCell>
                      {formatDate(point.bucket, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                      })}
                    </TableCell>
                    <TableCell align="right">{formatNumber(point.created)}</TableCell>
                    <TableCell align="right">{formatNumber(point.actionable)}</TableCell>
                    <TableCell align="right">
                      <Typography
                        component="span"
                        color={point.failed > 0 ? 'error.main' : 'text.primary'}
                      >
                        {formatNumber(point.failed)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatNumber(point.muted)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </AdminSection>
        <AdminSection
          title={t('admin.findings.title')}
          description={t('admin.findings.description')}
        >
          <FindingQueue findings={data.findings} onOpenFinding={onOpenFinding} />
        </AdminSection>
      </Box>
    </Stack>
  );
}

function ContractDetail({ contract }: { contract: NotificationTypeContract }) {
  const { t } = useTranslation('notifications');
  const fields = [
    [t('admin.contracts.fields.owner'), contract.ownerLabel],
    [t('admin.contracts.fields.sourceEvent'), contract.sourceEventType],
    [t('admin.contracts.fields.priority'), t(`priority.${contract.priority}`)],
    [t('admin.contracts.fields.schemaVersion'), `v${contract.schemaVersion}`],
    [t('admin.contracts.fields.volume'), formatNumber(contract.volume24Hours)],
    [
      t('admin.contracts.fields.updated'),
      formatDate(contract.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
    ],
  ];
  return (
    <Box component="aside" aria-label={t('admin.contracts.detailLabel')} sx={{ p: 2.5 }}>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Chip size="small" variant="outlined" label={contract.appName} />
        <Chip
          size="small"
          variant="outlined"
          color={healthColor(contract.state)}
          label={t(`admin.contractState.${contract.state}`)}
        />
        <Chip
          size="small"
          variant="outlined"
          color={healthColor(contract.contractHealth)}
          label={t(`admin.contractHealth.${contract.contractHealth}`)}
        />
      </Stack>
      <Typography component="h3" variant="h5" sx={{ mt: 1.75, overflowWrap: 'anywhere' }}>
        {contract.displayName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {contract.description}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.75, fontFamily: 'monospace' }}
      >
        {contract.typeKey}
      </Typography>
      <Box component="dl" sx={{ m: 0, mt: 2.5, borderTop: 1, borderColor: 'divider' }}>
        {fields.map(([label, value]) => (
          <Box
            key={label}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, .4fr) minmax(0, 1fr)',
              gap: 1.5,
              py: 1.25,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box component="section" sx={{ mt: 2.5 }}>
        <Typography component="h4" variant="subtitle2">
          {t('admin.contracts.channels')}
        </Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
          {contract.channels.map((channel) => (
            <Chip key={channel} size="small" variant="outlined" label={t(`channels.${channel}`)} />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export function NotificationTypeCatalogPage() {
  const { t } = useTranslation('notifications');
  const [queryText, setQueryText] = useState('');
  const [state, setState] = useState<NotificationContractState | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: notificationQueryKeys.adminTypes({ query: queryText.trim(), state }),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      getNotificationTypeContracts(
        {
          cursor: pageParam,
          limit: 40,
          query: queryText,
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

  if (!NOTIFICATION_API_CAPABILITIES.tenantAdmin) {
    return <NotificationAdminCapabilityUnavailable />;
  }
  const selected =
    contracts.find((contract) => contract.contractId === selectedId) ?? contracts[0] ?? null;

  return (
    <Stack gap={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25}>
        <FormField
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
          sx={{ flex: 1, maxWidth: 520 }}
        />
        <FormField
          select
          label={t('admin.contracts.stateFilter')}
          value={state}
          onChange={(event) => setState(event.target.value as NotificationContractState | 'ALL')}
          sx={{ minWidth: 180 }}
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
        <ErrorState
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(420px, .9fr) minmax(360px, 1.1fr)' },
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <Box
            sx={{
              minWidth: 0,
              borderRight: { lg: 1 },
              borderColor: 'divider',
              maxHeight: 700,
              overflowY: 'auto',
            }}
          >
            {contracts.map((contract) => (
              <ButtonBase
                key={contract.contractId}
                onClick={() => setSelectedId(contract.contractId)}
                aria-current={contract.contractId === selected?.contractId ? 'true' : undefined}
                sx={{
                  width: 1,
                  px: 1.75,
                  py: 1.4,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
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
                  <Typography variant="subtitle2" noWrap>
                    {contract.displayName}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ display: 'block' }}
                  >
                    {contract.appName} · {contract.typeKey}
                  </Typography>
                  <Stack direction="row" gap={0.5} sx={{ mt: 0.75 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={healthColor(contract.state)}
                      label={t(`admin.contractState.${contract.state}`)}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      color={healthColor(contract.contractHealth)}
                      label={t(`admin.contractHealth.${contract.contractHealth}`)}
                    />
                  </Stack>
                </Box>
                <ChevronRight size={18} />
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
          </Box>
          {selected && <ContractDetail contract={selected} />}
        </Box>
      )}
    </Stack>
  );
}

export function NotificationDeliveryOperationsPage({
  onOpenFinding,
}: {
  onOpenFinding?: (finding: NotificationOperationalFinding) => void;
}) {
  const { t } = useTranslation('notifications');
  const online = useOnlineStatus();
  const query = useQuery({
    queryKey: notificationQueryKeys.adminOperations(),
    queryFn: ({ signal }) => getNotificationDeliveryOperations(signal),
    staleTime: 15_000,
    refetchInterval: online ? 20_000 : false,
    retry: 1,
    enabled: NOTIFICATION_API_CAPABILITIES.tenantAdmin,
  });

  if (!NOTIFICATION_API_CAPABILITIES.tenantAdmin) {
    return <NotificationAdminCapabilityUnavailable />;
  }

  if (query.isLoading)
    return (
      <LoadingState
        label={t('states.loadingOperations')}
        variant="skeleton"
        skeletonRows={8}
        size="page"
      />
    );
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={t('states.operationsErrorTitle')}
        description={t('states.operationsErrorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        size="page"
      />
    );
  }
  const data = query.data;
  return (
    <Stack gap={3}>
      <Stack direction="row" justifyContent="flex-end">
        <LiveStatus
          state={
            !online ? 'stale' : data.partial ? 'degraded' : query.isFetching ? 'syncing' : 'live'
          }
          label={
            !online ? t('states.offline') : data.partial ? t('states.degraded') : t('states.live')
          }
          detail={formatDate(data.generatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          refreshLabel={t('actions.refresh')}
          onRefresh={() => void query.refetch()}
          refreshing={query.isFetching}
        />
      </Stack>
      <OperationalKpiStrip
        ariaLabel={t('admin.operations.metricsLabel')}
        items={[
          {
            key: 'retry',
            label: t('admin.operations.retryQueue'),
            value: formatNumber(data.retryQueue),
            tone: data.retryQueue ? 'warning' : 'success',
          },
          {
            key: 'dlq',
            label: t('admin.operations.deadLetter'),
            value: formatNumber(data.deadLetterQueue),
            tone: data.deadLetterQueue ? 'critical' : 'success',
          },
          {
            key: 'unknown',
            label: t('admin.operations.unknown'),
            value: formatNumber(data.unknownOutcomes),
            tone: data.unknownOutcomes ? 'warning' : 'success',
          },
        ]}
      />
      <AdminSection
        title={t('admin.operations.lanesTitle')}
        description={t('admin.operations.lanesDescription')}
      >
        <Box sx={{ overflowX: 'auto', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Table size="small" aria-label={t('admin.operations.lanesTable')} sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.operations.columns.lane')}</TableCell>
                <TableCell align="right">{t('admin.operations.columns.queued')}</TableCell>
                <TableCell align="right">{t('admin.operations.columns.oldest')}</TableCell>
                <TableCell align="right">{t('admin.operations.columns.throughput')}</TableCell>
                <TableCell align="right">{t('admin.operations.columns.failureRate')}</TableCell>
                <TableCell>{t('admin.operations.columns.state')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.lanes.map((lane) => (
                <TableRow key={lane.lane}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {t(`admin.lanes.${lane.lane}`)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{formatNumber(lane.queued)}</TableCell>
                  <TableCell align="right">
                    {t('admin.operations.seconds', { count: lane.oldestAgeSeconds })}
                  </TableCell>
                  <TableCell align="right">{formatNumber(lane.throughputPerMinute)}</TableCell>
                  <TableCell align="right">
                    {formatNumber(lane.failureRatePercent, { maximumFractionDigits: 2 })}%
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={healthColor(lane.state)}
                      label={t(`admin.laneState.${lane.state}`)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </AdminSection>
      <AdminSection
        title={t('admin.operations.providersTitle')}
        description={t('admin.operations.providersDescription')}
      >
        <Box sx={{ overflowX: 'auto', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Table
            size="small"
            aria-label={t('admin.operations.providersTable')}
            sx={{ minWidth: 760 }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.operations.columns.provider')}</TableCell>
                <TableCell>{t('admin.operations.columns.channel')}</TableCell>
                <TableCell>{t('admin.operations.columns.state')}</TableCell>
                <TableCell align="right">{t('admin.operations.columns.successRate')}</TableCell>
                <TableCell align="right">{t('admin.operations.columns.latency')}</TableCell>
                <TableCell>{t('admin.operations.columns.circuit')}</TableCell>
                <TableCell>{t('admin.operations.columns.checked')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.providers.map((provider) => (
                <TableRow key={provider.providerKey}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {provider.displayName}
                    </Typography>
                  </TableCell>
                  <TableCell>{t(`channels.${provider.channel}`)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={healthColor(provider.state)}
                      label={t(`admin.providerState.${provider.state}`)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {formatNumber(provider.successRatePercent, { maximumFractionDigits: 2 })}%
                  </TableCell>
                  <TableCell align="right">
                    {t('admin.operations.milliseconds', {
                      count: formatNumber(provider.p95LatencyMs),
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={healthColor(provider.circuitState)}
                      label={t(`admin.circuitState.${provider.circuitState}`)}
                    />
                  </TableCell>
                  <TableCell>
                    {formatDate(provider.lastCheckedAt, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </AdminSection>
      <AdminSection title={t('admin.findings.title')} description={t('admin.findings.description')}>
        <FindingQueue findings={data.findings} onOpenFinding={onOpenFinding} />
      </AdminSection>
    </Stack>
  );
}

export function NotificationTenantAdmin({
  initialView = 'overview',
  onOpenFinding,
}: {
  initialView?: NotificationAdminView;
  onOpenFinding?: (finding: NotificationOperationalFinding) => void;
}) {
  const { t } = useTranslation('notifications');
  const [view, setView] = useState<NotificationAdminView>(initialView);
  return (
    <PageCanvas mode="workspace">
      <NotificationPageHeading title={t('admin.title')} description={t('admin.description')} />
      <Tabs
        value={view}
        onChange={(_event, next: NotificationAdminView) => setView(next)}
        aria-label={t('admin.navigationLabel')}
        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="overview"
          icon={<Activity size={17} />}
          iconPosition="start"
          label={t('admin.navigation.overview')}
        />
        <Tab
          value="contracts"
          icon={<FileCode2 size={17} />}
          iconPosition="start"
          label={t('admin.navigation.contracts')}
        />
        <Tab
          value="operations"
          icon={<RadioTower size={17} />}
          iconPosition="start"
          label={t('admin.navigation.operations')}
        />
      </Tabs>
      <Box sx={{ mt: 2.5 }}>
        {view === 'overview' && <NotificationAdminOverviewPage onOpenFinding={onOpenFinding} />}
        {view === 'contracts' && <NotificationTypeCatalogPage />}
        {view === 'operations' && (
          <NotificationDeliveryOperationsPage onOpenFinding={onOpenFinding} />
        )}
      </Box>
    </PageCanvas>
  );
}
