import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getNotificationAdminOverview,
  NOTIFICATION_API_CAPABILITIES,
  type NotificationOperationalFinding,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { EmptyState, InlineFeedback, LiveStatus, LoadingState } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { NotificationAdminCapabilityUnavailable } from './notification-admin-capability-unavailable';
import { NotificationAdminMetricGrid } from './notification-admin-metric-grid';
import { NotificationAdminOverviewTrend } from './notification-admin-overview-trend';
import { NotificationErrorState } from './notification-error-support';
import { notificationQueryKeys } from './integration-contract';
import { localizeNotificationOperationalFindings } from './notification-operations-model';
import { useOnlineStatus } from './use-notification-runtime';

import type { ReactNode } from 'react';

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
      <NotificationErrorState
        error={query.error}
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
        <InlineFeedback severity="warning">
          {t('states.partial', { count: data.unavailableSources.length })}
        </InlineFeedback>
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
