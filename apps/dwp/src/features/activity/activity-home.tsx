import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ArrowRight, Bot, CheckCircle2, CircleAlert, ShieldX } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
  SectionHeader,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActivityConnectorStatus } from '../../components/activity/activity-connector-status';
import { ActivitySourceStatus } from '../../components/activity/activity-source-status';
import { useShellAuxiliaryAvoidance } from '../../components/shell-auxiliary-avoidance/use-shell-auxiliary-avoidance';
import { activityCompositeRefreshState, activityRefreshState } from './activity-model';
import { usableActivityQueryData } from './activity-query-state';
import { useActivityData } from './use-activity-data';

import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';

function eventIcon(event: WorkspaceActivityEvent) {
  return event.state === 'policy-blocked'
    ? ShieldX
    : event.state === 'needs-input'
      ? CircleAlert
      : event.actor === 'agent'
        ? Bot
        : Activity;
}

function eventBorderColor(event: WorkspaceActivityEvent) {
  return event.state === 'policy-blocked' || event.state === 'failed'
    ? 'error.main'
    : event.state === 'needs-input'
      ? 'warning.main'
      : event.state === 'completed'
        ? 'success.main'
        : 'primary.main';
}

function sourceLabel(source: string) {
  return source === 'DWAI_ON' ? 'DWAI·ON' : source === 'WORKSPACE' ? 'DWP Workspace' : source;
}

function ActivityHomeEventCard({
  event,
  attention = false,
}: {
  event: WorkspaceActivityEvent;
  attention?: boolean;
}) {
  const { t } = useTranslation('work');
  const EventIcon = eventIcon(event);
  const observedAt = event.stateChangedAt ?? event.occurredAt;
  const formattedTime = formatDate(observedAt, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <Box
      sx={{
        px: { xs: 1.25, sm: 2 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        borderLeft: 3,
        borderLeftColor: eventBorderColor(event),
        overflowWrap: 'anywhere',
      }}
    >
      <Stack
        data-shell-auxiliary-avoidance="inline-end"
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1.5}
        sx={{ py: 1.6 }}
      >
        <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 34,
              height: 34,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'var(--dwp-product-soft)',
              color: 'var(--dwp-product-accent)',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            }}
          >
            <EventIcon size={17} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {event.title}
            </Typography>
            {event.dataProvenance === 'SAMPLE' && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t('activityFoundation.sample.title')}
                sx={{ mt: 0.5, color: 'text.primary' }}
              />
            )}
            {!attention && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.3 }}>
                {event.summary || event.objectLabel}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip size="small" variant="outlined" label={t(`activityPage.states.${event.state}`)} />
          <Typography variant="caption" color="text.secondary">
            {sourceLabel(event.source)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {attention
              ? t(
                  event.stateChangedAt
                    ? 'activityHome.attention.stateChangedAt'
                    : 'activityHome.attention.latestAt',
                  { at: formattedTime }
                )
              : formattedTime}
          </Typography>
          <ActionButton
            component={Link}
            to={`/activity/timeline?event=${encodeURIComponent(event.id)}`}
            intent={attention ? 'secondary' : 'quiet'}
            size="small"
            aria-label={t('activityHome.attention.openItem', { title: event.title })}
          >
            {t('activityHome.open')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

export function ActivityHome() {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const recentActivityRef = useRef<HTMLElement | null>(null);
  useShellAuxiliaryAvoidance({ boundaryRef: recentActivityRef });
  const {
    feed: query,
    summary,
    sources,
    rootDenied,
    now,
    refresh,
  } = useActivityData({ limit: 6, includeUsage: false });
  const feedData = rootDenied ? undefined : usableActivityQueryData(query);
  const current = rootDenied ? undefined : usableActivityQueryData(summary);
  const sourceReport = rootDenied ? undefined : usableActivityQueryData(sources);
  const attentionItems = (current?.attentionItems ?? []).slice(0, 5);
  const recent = (feedData?.events ?? []).slice(0, 6);
  const summarySourcesComplete =
    current?.sourceStates.every(
      (source) => source.status === 'AVAILABLE' || source.status === 'FORBIDDEN'
    ) ?? false;
  const summaryIncomplete = Boolean(current && (current.partial || !summarySourcesComplete));
  const metrics = {
    total: current?.total ?? '—',
    running: current?.running ?? '—',
    input: current?.needsInput ?? '—',
    blocked: current?.policyBlocked ?? '—',
  };
  const sourceRefreshState = activityRefreshState(
    {
      isFetching: sources.isFetching,
      isError: sources.isError,
      dataUpdatedAt: sources.dataUpdatedAt,
      data: sources.data ? { generatedAt: sources.data.observedAt } : undefined,
    },
    now,
    6 * 60_000
  );
  const refreshState = activityCompositeRefreshState([
    activityRefreshState(query, now),
    activityRefreshState(summary, now),
    sourceRefreshState,
  ]);
  const lastSuccessfulRefreshes = [
    query.dataUpdatedAt,
    summary.dataUpdatedAt,
    sources.dataUpdatedAt,
  ].filter((value) => value > 0);
  const lastSuccessfulRefreshAt = lastSuccessfulRefreshes.length
    ? Math.min(...lastSuccessfulRefreshes)
    : 0;

  return (
    <PageCanvas>
      <Box
        sx={{
          '@media (forced-colors: active)': {
            '& .MuiTypography-overline': { color: 'CanvasText' },
          },
        }}
      >
        <ResourcePageHeader
          eyebrow={t('activityHome.eyebrow')}
          title={t('activityHome.title')}
          description={t('activityHome.description')}
          status={
            <LiveStatus
              state={refreshState}
              label={t(`activityFoundation.freshness.${refreshState}`)}
              detail={
                lastSuccessfulRefreshAt
                  ? t('activityFoundation.lastRefresh', {
                      at: formatDate(lastSuccessfulRefreshAt, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })
                  : undefined
              }
              refreshLabel={t('activityPage.retry')}
              refreshing={query.isFetching || summary.isFetching || sources.isFetching}
              onRefresh={() => void refresh()}
            />
          }
        />
      </Box>

      <Box
        component="section"
        aria-labelledby="activity-home-attention"
        sx={{
          mt: 3,
          p: { xs: 1.5, sm: 2.5 },
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        }}
      >
        <SectionHeader
          id="activity-home-attention"
          icon={CircleAlert}
          title={t('activityHome.attention.title')}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
          {t('activityHome.attention.description')}
        </Typography>
        {summary.isError && current && (
          <InlineFeedback
            severity="warning"
            title={t('activityFoundation.cachedSummary.title')}
            sx={{ mt: 1.5 }}
          >
            {t('activityFoundation.cachedSummary.description')}
            <Box sx={{ mt: 1 }}>
              <ActionButton
                intent="secondary"
                size="small"
                onClick={() => void summary.refetch()}
                disabled={summary.isFetching}
              >
                {t('activityPage.retry')}
              </ActionButton>
            </Box>
          </InlineFeedback>
        )}
        {!current || summaryIncomplete ? (
          !current && summary.isLoading ? (
            <LoadingState label={t('activityHome.attention.loading')} size="compact" />
          ) : (
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 2.5 }}>
              <CircleAlert size={19} aria-hidden="true" />
              <Box>
                <Typography variant="subtitle2">
                  {t('activityHome.attention.unavailableTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p">
                  {t('activityHome.attention.unavailableDescription')}
                </Typography>
                <ActionButton
                  intent="secondary"
                  size="small"
                  onClick={() => void (rootDenied ? refresh() : summary.refetch())}
                  disabled={summary.isFetching || (rootDenied && query.isFetching)}
                  sx={{ mt: 1 }}
                >
                  {t('activityPage.retry')}
                </ActionButton>
              </Box>
            </Stack>
          )
        ) : current.needsInput + current.policyBlocked === 0 ? (
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 2.5 }}>
            <CheckCircle2 size={19} aria-hidden="true" />
            <Box>
              <Typography variant="subtitle2">{t('activityHome.attention.clearTitle')}</Typography>
              <Typography variant="caption" color="text.secondary" component="p">
                {t('activityHome.attention.clearDescription')}
              </Typography>
            </Box>
          </Stack>
        ) : attentionItems.length ? (
          <Box
            component="ul"
            aria-label={t('activityHome.attention.listLabel')}
            sx={{ display: 'grid', gap: 1.25, p: 0, mt: 2, mb: 0, listStyle: 'none' }}
          >
            {attentionItems.map((event) => (
              <Box component="li" key={event.id} sx={{ minWidth: 0 }}>
                <ActivityHomeEventCard event={event} attention />
              </Box>
            ))}
          </Box>
        ) : (
          <Stack spacing={1.25} sx={{ mt: 2.5, maxWidth: 440 }}>
            <Typography variant="body2" color="text.secondary">
              {t('activityHome.attention.legacyFallback')}
            </Typography>
            <ActionButton
              component={Link}
              to="/activity/timeline?state=needs-input"
              intent="secondary"
              startIcon={<CircleAlert size={17} aria-hidden="true" />}
            >
              {t('activityHome.attention.input', { count: metrics.input })}
            </ActionButton>
            <ActionButton
              component={Link}
              to="/activity/timeline?state=policy-blocked"
              intent="secondary"
              startIcon={<ShieldX size={17} aria-hidden="true" />}
            >
              {t('activityHome.attention.blocked', { count: metrics.blocked })}
            </ActionButton>
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
          {t('activityHome.attention.notice')}
        </Typography>
      </Box>

      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('activityHome.summaryLabel')}
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            '& > div:nth-of-type(2)': { bgcolor: 'var(--dwp-product-soft)' },
          }}
          items={[
            {
              key: 'total',
              value: metrics.total,
              label: t('activityHome.metrics.total'),
              detail: t('activityHome.metrics.totalDetail'),
              onSelect: () => navigate('/activity/timeline'),
            },
            {
              key: 'running',
              value: metrics.running,
              label: t('activityHome.metrics.running'),
              detail: t('activityHome.metrics.runningDetail'),
              tone: 'info',
              onSelect: () => navigate('/activity/timeline?state=running'),
            },
            {
              key: 'input',
              value: metrics.input,
              label: t('activityHome.metrics.input'),
              detail: t('activityHome.metrics.inputDetail'),
              tone: 'warning',
              onSelect: () => navigate('/activity/timeline?state=needs-input'),
            },
            {
              key: 'blocked',
              value: metrics.blocked,
              label: t('activityHome.metrics.blocked'),
              detail: t('activityHome.metrics.blockedDetail'),
              tone: 'critical',
              onSelect: () => navigate('/activity/timeline?state=policy-blocked'),
            },
          ]}
        />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {t('activityFoundation.coverageNotice')}{' '}
          {t(`activityFoundation.freshness.${activityRefreshState(summary, now)}`)}
        </Typography>
      </Box>

      <ActivitySourceStatus
        sources={feedData?.sourceStates ?? current?.sourceStates}
        partial={feedData?.partial ?? current?.partial}
        onRetry={() => void (feedData ? query.refetch() : summary.refetch())}
        retrying={feedData ? query.isFetching : summary.isFetching}
      />

      <Box
        ref={recentActivityRef}
        component="section"
        aria-labelledby="activity-home-recent"
        sx={{ mt: 4, minWidth: 0 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1.5}
        >
          <Box>
            <SectionHeader
              id="activity-home-recent"
              icon={Activity}
              title={t('activityHome.recentTitle')}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {t('activityHome.recentDescription')}
            </Typography>
          </Box>
          <ActionButton
            component={Link}
            to="/activity/timeline"
            intent="secondary"
            endIcon={<ArrowRight size={16} />}
          >
            {t('activityHome.openTimeline')}
          </ActionButton>
        </Stack>
        <Box sx={{ display: 'grid', gap: 1.25, mt: 2 }}>
          {query.isError && feedData && (
            <InlineFeedback severity="warning" title={t('activityFoundation.cachedFeed.title')}>
              {t('activityFoundation.cachedFeed.description')}
              <Box sx={{ mt: 1 }}>
                <ActionButton
                  intent="secondary"
                  size="small"
                  onClick={() => void query.refetch()}
                  disabled={query.isFetching}
                >
                  {t('activityPage.retry')}
                </ActionButton>
              </Box>
            </InlineFeedback>
          )}
          {query.isLoading && !feedData ? (
            <LoadingState label={t('activityHome.loading')} variant="skeleton" size="page" />
          ) : (query.isError || rootDenied) && !feedData ? (
            <LocalErrorState
              title={t('activityHome.errorTitle')}
              description={t('activityHome.errorDescription')}
              retryLabel={t('activityPage.retry')}
              onRetry={() => void (rootDenied ? refresh() : query.refetch())}
              retrying={query.isFetching || (rootDenied && summary.isFetching)}
              size="compact"
            />
          ) : recent.length ? (
            recent.map((event) => <ActivityHomeEventCard key={event.id} event={event} />)
          ) : (
            <EmptyState
              title={t('activityHome.emptyTitle')}
              description={t('activityHome.emptyDescription')}
              size="compact"
            />
          )}
        </Box>
      </Box>

      <ActivityConnectorStatus
        report={sourceReport}
        loading={sources.isLoading}
        failed={sources.isError || rootDenied}
        onRetry={() => void (rootDenied ? refresh() : sources.refetch())}
        retrying={sources.isFetching}
      />
    </PageCanvas>
  );
}
