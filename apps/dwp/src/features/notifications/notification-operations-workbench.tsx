import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  ActionButton,
  EmptyState,
  LiveStatus,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';
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

import {
  notificationOperationalFindingRoute,
  selectNotificationOperationalFinding,
} from './notification-operations-model';
import { NotificationResponsiveCatalog } from './notification-responsive-catalog';

import type {
  NotificationDeliveryOperations,
  NotificationOperationalFinding,
} from '@dwp-frontend/shared-utils/api/notification-api';

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

function MobileMetrics({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 1.25,
        m: 0,
        mt: 1.25,
        '& dt': { color: 'text.secondary' },
        '& dd': { m: 0, mt: 0.25, fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' },
      }}
    >
      {items.map((item) => (
        <Box component="div" key={item.label} minWidth={0}>
          <Typography component="dt" variant="caption">
            {item.label}
          </Typography>
          <Typography component="dd" variant="body2">
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function FindingList({
  findings,
  selectedId,
  onSelect,
}: {
  findings: NotificationOperationalFinding[];
  selectedId: string | null;
  onSelect: (finding: NotificationOperationalFinding) => void;
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
    <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
      {findings.map((finding) => {
        const selected = finding.findingId === selectedId;
        return (
          <Box component="li" key={finding.findingId}>
            <ButtonBase
              aria-pressed={selected}
              data-testid={`notification-operation-finding-${finding.findingId}`}
              onClick={() => onSelect(finding)}
              sx={{
                width: 1,
                minHeight: 92,
                px: 1.5,
                py: 1.25,
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                gap: 1.25,
                alignItems: 'start',
                textAlign: 'left',
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: selected ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <AlertTriangle size={18} aria-hidden="true" />
              <Box minWidth={0}>
                <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle2">{finding.title}</Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={findingColor(finding.severity)}
                    label={t(`admin.severity.${finding.severity}`)}
                  />
                  {finding.count > 1 && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('admin.operations.findingCount', { count: finding.count })}
                    />
                  )}
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
                >
                  {finding.detail}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(finding.detectedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                </Typography>
              </Box>
              <ChevronRight size={18} aria-hidden="true" />
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}

function FindingDetail({
  finding,
  generatedAt,
  canViewCentralAudit,
  onRefresh,
}: {
  finding: NotificationOperationalFinding | null;
  generatedAt: string;
  canViewCentralAudit: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  if (!finding) {
    return (
      <EmptyState
        icon={<ClipboardCheck size={28} />}
        title={t('admin.operations.investigation.emptyTitle')}
        description={t('admin.operations.investigation.emptyDescription')}
        size="compact"
      />
    );
  }
  const governedRoute = notificationOperationalFindingRoute(finding);
  return (
    <Box
      component="aside"
      data-testid="notification-operation-investigation"
      sx={{ p: { xs: 1.5, md: 2.25 } }}
    >
      <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
        <Chip
          size="small"
          color={findingColor(finding.severity)}
          label={t(`admin.severity.${finding.severity}`)}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t(`admin.operations.category.${finding.category}`)}
        />
      </Stack>
      <Typography component="h3" variant="h5" sx={{ mt: 1.5, overflowWrap: 'anywhere' }}>
        {finding.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
        {finding.detail}
      </Typography>

      <Box
        component="dl"
        sx={{
          mt: 2.25,
          py: 0.5,
          borderBlock: 1,
          borderColor: 'divider',
          '& > div': {
            py: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(112px, .42fr) minmax(0, 1fr)',
            gap: 1,
            borderBottom: 1,
            borderColor: 'divider',
          },
          '& > div:last-of-type': { borderBottom: 0 },
          '& dt': { color: 'text.secondary' },
          '& dd': { m: 0, fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' },
        }}
      >
        <Box component="div">
          <Typography component="dt" variant="body2">
            {t('admin.operations.investigation.findingId')}
          </Typography>
          <Typography component="dd" variant="body2">
            {finding.findingId}
          </Typography>
        </Box>
        <Box component="div">
          <Typography component="dt" variant="body2">
            {t('admin.operations.investigation.affected')}
          </Typography>
          <Typography component="dd" variant="body2">
            {formatNumber(finding.count)}
          </Typography>
        </Box>
        <Box component="div">
          <Typography component="dt" variant="body2">
            {t('admin.operations.investigation.owner')}
          </Typography>
          <Typography component="dd" variant="body2">
            {finding.ownerLabel || t('admin.operations.investigation.ownerUnassigned')}
          </Typography>
        </Box>
        <Box component="div">
          <Typography component="dt" variant="body2">
            {t('admin.operations.investigation.detectedAt')}
          </Typography>
          <Typography component="dd" variant="body2">
            {formatDate(finding.detectedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          </Typography>
        </Box>
        <Box component="div">
          <Typography component="dt" variant="body2">
            {t('admin.operations.investigation.snapshotAt')}
          </Typography>
          <Typography component="dd" variant="body2">
            {formatDate(generatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography component="h4" variant="subtitle2">
          {t('admin.operations.investigation.nextTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {finding.category === 'DELIVERY'
            ? t('admin.operations.investigation.deliveryGuidance')
            : t('admin.operations.investigation.governanceGuidance')}
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 2 }}>
        <ActionButton intent="secondary" startIcon={<RefreshCw size={17} />} onClick={onRefresh}>
          {t('admin.operations.investigation.recheck')}
        </ActionButton>
        {governedRoute && (
          <ActionButton
            intent="primary"
            endIcon={<ArrowUpRight size={17} />}
            onClick={() => navigate(governedRoute)}
          >
            {t('admin.operations.investigation.openGovernedSurface')}
          </ActionButton>
        )}
        {canViewCentralAudit && (
          <ActionButton
            intent={governedRoute ? 'quiet' : 'primary'}
            startIcon={<ScrollText size={17} />}
            onClick={() =>
              navigate(
                `/admin/governance/audit-events?mode=events&query=${encodeURIComponent(
                  `notification.${finding.findingId}`
                )}`
              )
            }
          >
            {t('admin.operations.investigation.openEvidence')}
          </ActionButton>
        )}
      </Stack>

      {finding.category === 'DELIVERY' && (
        <Box
          role="note"
          sx={{
            mt: 2,
            p: 1.25,
            borderLeft: 3,
            borderColor: 'warning.main',
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="body2">
            {t('admin.operations.investigation.replayUnavailable')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function OperationsTables({ data }: { data: NotificationDeliveryOperations }) {
  const { t } = useTranslation('notifications');
  return (
    <Stack gap={3}>
      <Box component="section">
        <Typography component="h2" variant="h6">
          {t('admin.operations.lanesTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {t('admin.operations.lanesDescription')}
        </Typography>
        <Stack gap={1} sx={{ mt: 1.5, display: { xs: 'flex', md: 'none' } }}>
          {data.lanes.map((lane) => (
            <Box
              component="article"
              key={lane.lane}
              data-testid={`notification-lane-mobile-${lane.lane}`}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 'shape.borderRadius',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography variant="subtitle2">{t(`admin.lanes.${lane.lane}`)}</Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={healthColor(lane.state)}
                  label={t(`admin.laneState.${lane.state}`)}
                />
              </Stack>
              <MobileMetrics
                items={[
                  {
                    label: t('admin.operations.columns.queued'),
                    value: formatNumber(lane.queued),
                  },
                  {
                    label: t('admin.operations.columns.oldest'),
                    value: t('admin.operations.seconds', { count: lane.oldestAgeSeconds }),
                  },
                  {
                    label: t('admin.operations.columns.throughput'),
                    value: formatNumber(lane.throughputPerMinute),
                  },
                  {
                    label: t('admin.operations.columns.failureRate'),
                    value: `${formatNumber(lane.failureRatePercent, { maximumFractionDigits: 2 })}%`,
                  },
                ]}
              />
            </Box>
          ))}
        </Stack>
        <Box
          sx={{
            mt: 1.5,
            overflowX: 'auto',
            borderBlock: 1,
            borderColor: 'divider',
            display: { xs: 'none', md: 'block' },
          }}
        >
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
                    <Typography variant="body2" fontWeight="fontWeightBold">
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
      </Box>

      <Box component="section">
        <Typography component="h2" variant="h6">
          {t('admin.operations.providersTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {t('admin.operations.providersDescription')}
        </Typography>
        <Stack gap={1} sx={{ mt: 1.5, display: { xs: 'flex', md: 'none' } }}>
          {data.providers.map((provider) => (
            <Box
              component="article"
              key={provider.providerKey}
              data-testid={`notification-provider-mobile-${provider.providerKey}`}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 'shape.borderRadius',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                    {provider.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`channels.${provider.channel}`)}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={healthColor(provider.state)}
                  label={t(`admin.providerState.${provider.state}`)}
                />
              </Stack>
              <MobileMetrics
                items={[
                  {
                    label: t('admin.operations.columns.successRate'),
                    value: `${formatNumber(provider.successRatePercent, {
                      maximumFractionDigits: 2,
                    })}%`,
                  },
                  {
                    label: t('admin.operations.columns.latency'),
                    value: t('admin.operations.milliseconds', {
                      count: formatNumber(provider.p95LatencyMs),
                    }),
                  },
                  {
                    label: t('admin.operations.columns.circuit'),
                    value: t(`admin.circuitState.${provider.circuitState}`),
                  },
                  {
                    label: t('admin.operations.columns.checked'),
                    value: formatDate(provider.lastCheckedAt, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  },
                ]}
              />
            </Box>
          ))}
        </Stack>
        <Box
          sx={{
            mt: 1.5,
            overflowX: 'auto',
            borderBlock: 1,
            borderColor: 'divider',
            display: { xs: 'none', md: 'block' },
          }}
        >
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
                    <Typography variant="body2" fontWeight="fontWeightBold">
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
      </Box>
    </Stack>
  );
}

export function NotificationOperationsWorkbench({
  data,
  online,
  refreshing,
  canViewCentralAudit,
  onRefresh,
}: {
  data: NotificationDeliveryOperations;
  online: boolean;
  refreshing: boolean;
  canViewCentralAudit: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('notifications');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFindingId = searchParams.get('finding');
  const selected = useMemo(
    () => selectNotificationOperationalFinding(data.findings, requestedFindingId),
    [data.findings, requestedFindingId]
  );
  const selectFinding = (finding: NotificationOperationalFinding) => {
    const next = new URLSearchParams(searchParams);
    next.set('finding', finding.findingId);
    setSearchParams(next);
  };
  const closeFinding = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('finding');
    setSearchParams(next, { replace: true });
  };

  return (
    <Stack gap={3} data-testid="notification-operations-workbench">
      <Stack direction="row" justifyContent="flex-end">
        <LiveStatus
          state={!online ? 'stale' : data.partial ? 'degraded' : refreshing ? 'syncing' : 'live'}
          label={
            !online ? t('states.offline') : data.partial ? t('states.degraded') : t('states.live')
          }
          detail={formatDate(data.generatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          refreshLabel={t('actions.refresh')}
          onRefresh={onRefresh}
          refreshing={refreshing}
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

      <Box component="section">
        <Typography component="h2" variant="h6">
          {t('admin.operations.investigation.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, mb: 1.5 }}>
          {t('admin.operations.investigation.description')}
        </Typography>
        <NotificationResponsiveCatalog
          testId="notification-operation-investigation-catalog"
          listLabel={t('admin.operations.investigation.listLabel')}
          detailLabel={t('admin.operations.investigation.detailLabel')}
          backLabel={t('admin.operations.investigation.back')}
          desktopColumns="minmax(320px, .8fr) minmax(0, 1.2fr)"
          listMaxHeight={560}
          detailOpen={Boolean(requestedFindingId && selected)}
          onBack={closeFinding}
          list={
            <FindingList
              findings={data.findings}
              selectedId={selected?.findingId ?? null}
              onSelect={selectFinding}
            />
          }
          detail={
            <FindingDetail
              finding={selected}
              generatedAt={data.generatedAt}
              canViewCentralAudit={canViewCentralAudit}
              onRefresh={onRefresh}
            />
          }
        />
      </Box>

      <OperationsTables data={data} />
    </Stack>
  );
}
