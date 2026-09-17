import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BookOpen,
  Braces,
  ChevronRight,
  Link2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getNotificationAdminOverview,
  getNotificationDeliveryOperations,
  getNotificationTypeContracts,
  NOTIFICATION_API_CAPABILITIES,
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
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { NotificationAdminOverviewTrend } from './notification-admin-overview-trend';
import { NotificationAdminMetricGrid } from './notification-admin-metric-grid';
import { notificationQueryKeys } from './integration-contract';
import { localizeNotificationOperationalFindings } from './notification-operations-model';
import { NotificationOperationsWorkbench } from './notification-operations-workbench';
import { NotificationResponsiveCatalog } from './notification-responsive-catalog';
import { useOnlineStatus } from './use-notification-runtime';
import type { ReactNode } from 'react';

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

function findingTone(severity: NotificationOperationalFinding['severity']) {
  if (severity === 'CRITICAL') return 'error.main';
  if (severity === 'WARNING') return 'warning.main';
  return 'info.main';
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
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        minWidth: 0,
        overflow: 'hidden',
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        '@media (forced-colors: active)': { borderColor: 'CanvasText', boxShadow: 'none' },
      }}
    >
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography component="h2" variant="subtitle1">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Box sx={{ p: { xs: 1.5, md: 2 } }}>{children}</Box>
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
    <Box sx={{ mx: { xs: -1.5, md: -2 }, my: { xs: -1.5, md: -2 } }}>
      {findings.map((finding) => (
        <ButtonBase
          key={finding.findingId}
          onClick={() => onOpenFinding?.(finding)}
          disabled={!onOpenFinding && !finding.href}
          component={finding.href && !onOpenFinding ? 'a' : 'button'}
          href={finding.href && !onOpenFinding ? finding.href : undefined}
          sx={{
            width: 1,
            minHeight: 68,
            px: { xs: 1.5, md: 2 },
            py: 1.25,
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gap: 1.25,
            alignItems: 'start',
            textAlign: 'left',
            borderBottom: 1,
            borderColor: 'divider',
            '&:last-of-type': { borderBottom: 0 },
            '&::before': {
              position: 'absolute',
              inset: '0 auto 0 0',
              width: 3,
              bgcolor: findingTone(finding.severity),
              content: '""',
            },
            '&:hover': { bgcolor: 'action.hover' },
            '&.Mui-focusVisible, &:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -3,
              zIndex: 1,
            },
            '@media (forced-colors: active)': {
              borderColor: 'CanvasText',
              '&::before': { bgcolor: 'CanvasText' },
            },
          }}
        >
          <Box aria-hidden sx={{ mt: 0.25, color: findingTone(finding.severity) }}>
            <AlertTriangle size={18} />
          </Box>
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {finding.detail}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {formatDate(finding.detectedAt, { dateStyle: 'medium', timeStyle: 'short' })}
              {finding.ownerLabel ? ` · ${finding.ownerLabel}` : ''}
            </Typography>
          </Box>
          {(onOpenFinding || finding.href) && (
            <ChevronRight size={18} aria-hidden style={{ marginTop: 3 }} />
          )}
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
  const navigate = useNavigate();
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
  const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  const findings = localizeNotificationOperationalFindings(data.findings, t).sort(
    (left, right) => severityRank[left.severity] - severityRank[right.severity]
  );
  const metricLabels: Record<string, string> = {
    'active-contracts': t('admin.overview.metrics.activeContracts'),
    'notifications-24h': t('admin.overview.metrics.notifications24Hours'),
    'queued-deliveries': t('admin.overview.metrics.queuedDeliveries'),
    'failed-deliveries': t('admin.overview.metrics.failedDeliveries'),
  };
  return (
    <Stack gap={1.5}>
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
      {data.partial && (
        <Alert severity="warning">
          {t('states.partial', { count: data.unavailableSources.length })}
        </Alert>
      )}
      <NotificationAdminMetricGrid
        metrics={data.metrics}
        labels={metricLabels}
        ariaLabel={t('admin.overview.metricsLabel')}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.1fr) minmax(340px, .9fr)' },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <AdminSection
          title={t('admin.findings.title')}
          description={t('admin.findings.description')}
        >
          <FindingQueue
            findings={findings}
            onOpenFinding={
              onOpenFinding ??
              ((finding) =>
                navigate(
                  `/notifications/admin/operations?finding=${encodeURIComponent(finding.findingId)}`
                ))
            }
          />
        </AdminSection>
        <AdminSection
          title={t('admin.overview.trendTitle')}
          description={t('admin.overview.trendDescription')}
        >
          <NotificationAdminOverviewTrend points={data.trend} />
          <Box
            component="details"
            sx={{
              mt: 1.5,
              borderTop: 1,
              borderBottom: 1,
              borderColor: 'divider',
              '&[open] > summary': { borderBottom: 1, borderColor: 'divider' },
              '&[open] .notification-exact-data-chevron': { transform: 'rotate(90deg)' },
              '@media (prefers-reduced-motion: reduce)': {
                '& .notification-exact-data-chevron': { transition: 'none !important' },
              },
            }}
          >
            <Box
              component="summary"
              sx={{
                minHeight: 42,
                px: 1,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                color: 'text.secondary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box
                component="span"
                className="notification-exact-data-chevron"
                aria-hidden="true"
                sx={{
                  display: 'inline-flex',
                  mr: 0.75,
                  transition: (theme) =>
                    theme.transitions.create('transform', {
                      duration: theme.transitions.duration.shorter,
                    }),
                }}
              >
                <ChevronRight size={16} />
              </Box>
              <Typography component="span" variant="caption" color="inherit">
                {t('admin.overview.exactData')}
              </Typography>
            </Box>
            <Box
              tabIndex={0}
              aria-label={t('admin.overview.trendTableScrollLabel')}
              sx={{ overflowX: 'auto' }}
            >
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
          </Box>
        </AdminSection>
      </Box>
    </Stack>
  );
}

function ContractDetail({ contract }: { contract: NotificationTypeContract }) {
  const { t } = useTranslation('notifications');
  const schemaRange = `v${contract.minSchemaVersion ?? contract.schemaVersion}-v${
    contract.maxSchemaVersion ?? contract.schemaVersion
  }`;
  const fields = [
    [t('admin.contracts.fields.owner'), contract.ownerLabel],
    [t('admin.contracts.fields.sourceEvent'), contract.sourceEventType],
    [t('admin.contracts.fields.priority'), t(`priority.${contract.priority}`)],
    [t('admin.contracts.fields.schemaVersion'), schemaRange],
    [t('admin.contracts.fields.classification'), contract.dataClassification],
    [
      t('admin.contracts.fields.audience'),
      t(`admin.contracts.audience.${contract.audienceMode}`, {
        defaultValue: contract.audienceMode,
      }),
    ],
    [
      t('admin.contracts.fields.interruption'),
      t(`admin.contracts.interruption.${contract.interruptionLevel}`, {
        defaultValue: contract.interruptionLevel,
      }),
    ],
    [
      t('admin.contracts.fields.mandatory'),
      t(`admin.contracts.${contract.mandatory ? 'yes' : 'no'}`),
    ],
    [
      t('admin.contracts.fields.userControl'),
      t(`admin.contracts.${contract.userConfigurable ? 'configurable' : 'managed'}`),
    ],
    [
      t('admin.contracts.fields.previewPolicy'),
      t(`admin.contracts.previewPolicy.${contract.previewPolicy}`, {
        defaultValue: contract.previewPolicy,
      }),
    ],
    [
      t('admin.contracts.fields.dedupe'),
      t(`admin.contracts.dedupe.${contract.dedupeStrategy}`, {
        defaultValue: contract.dedupeStrategy,
      }),
    ],
    [t('admin.contracts.fields.endEvent'), contract.endEventType || t('admin.contracts.none')],
    [
      t('admin.contracts.fields.retention'),
      t(`admin.contracts.retention.${contract.retentionPolicy}`, {
        defaultValue: contract.retentionPolicy,
      }),
    ],
    [t('admin.contracts.fields.entityVersion'), `v${contract.version}`],
    [t('admin.contracts.fields.volume'), formatNumber(contract.volume24Hours)],
    [
      t('admin.contracts.fields.updated'),
      formatDate(contract.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
    ],
  ];
  return (
    <Box
      component="aside"
      aria-label={t('admin.contracts.detailLabel')}
      data-testid="notification-contract-detail"
      sx={{ p: { xs: 1.5, md: 2 } }}
    >
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
      <Typography component="h3" variant="h6" sx={{ mt: 1.25, overflowWrap: 'anywhere' }}>
        {contract.displayName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {contract.description}
      </Typography>
      <Typography
        component="code"
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.75, overflowWrap: 'anywhere' }}
      >
        {contract.typeKey}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          columnGap: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {fields.map(([label, value]) => (
          <Box
            key={label}
            sx={{
              minWidth: 0,
              py: 0.85,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              sx={{ m: 0, mt: 0.25, fontWeight: 'subtitle2.fontWeight', overflowWrap: 'anywhere' }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box component="section" sx={{ mt: 2.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <Box>
            <Stack direction="row" gap={0.75} alignItems="center">
              <ShieldCheck size={17} aria-hidden />
              <Typography component="h4" variant="subtitle2">
                {t('admin.contracts.channels')}
              </Typography>
            </Stack>
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
              {contract.channels.map((channel) => (
                <Chip
                  key={channel}
                  size="small"
                  variant="outlined"
                  label={t(`channels.${channel}`)}
                />
              ))}
            </Stack>
          </Box>
          <Box>
            <Stack direction="row" gap={0.75} alignItems="center">
              <Braces size={17} aria-hidden />
              <Typography component="h4" variant="subtitle2">
                {t('admin.contracts.variables')}
              </Typography>
            </Stack>
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
              {(contract.requiredVariables ?? []).length > 0 ? (
                (contract.requiredVariables ?? []).map((variable) => (
                  <Chip key={variable} size="small" variant="outlined" label={`{{${variable}}}`} />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('admin.contracts.noVariables')}
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box component="section" sx={{ mt: 2.5, borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
        <Stack direction="row" gap={0.75} alignItems="center">
          <Link2 size={17} aria-hidden />
          <Typography component="h4" variant="subtitle2">
            {t('admin.contracts.deepLink')}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
          {contract.deepLinkTemplate || t('admin.contracts.none')}
        </Typography>
        {contract.runbookUrl && (
          <ButtonBase
            component="a"
            href={contract.runbookUrl}
            sx={{ mt: 1.5, minHeight: 36, px: 1.25, gap: 0.75, color: 'primary.main' }}
          >
            <BookOpen size={17} aria-hidden />
            <Typography variant="button">{t('admin.contracts.openRunbook')}</Typography>
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
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
          detail={selected && <ContractDetail contract={selected} />}
        />
      )}
    </Stack>
  );
}

export function NotificationDeliveryOperationsPage() {
  const { t } = useTranslation('notifications');
  const { hasPermission } = usePermissions();
  const online = useOnlineStatus();
  const canViewCentralAudit = hasPermission('ADMIN.AUDIT_VIEW', 'VIEW');
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
    <NotificationOperationsWorkbench
      data={data}
      online={online}
      refreshing={query.isFetching}
      canViewCentralAudit={canViewCentralAudit}
      onRefresh={() => void query.refetch()}
    />
  );
}
