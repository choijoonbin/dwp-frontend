import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ArrowRight, Bot, CheckCircle2, CircleAlert, ShieldX } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ActionButton,
  EmptyState,
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

import { useShellAuxiliaryAvoidance } from '../../components/shell-auxiliary-avoidance/use-shell-auxiliary-avoidance';
import { useActivityData } from './use-activity-data';
import { activityRefreshState } from './activity-model';
import { ActivitySourceStatus } from '../../components/activity/activity-source-status';
import { ActivityConnectorStatus } from '../../components/activity/activity-connector-status';

export function ActivityHome() {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const recentActivityRef = useRef<HTMLElement | null>(null);
  useShellAuxiliaryAvoidance({ boundaryRef: recentActivityRef });
  const {
    feed: query,
    summary,
    sources,
    now,
    refresh,
  } = useActivityData({
    limit: 6,
    includeUsage: false,
  });
  const current = summary.isError ? undefined : summary.data;
  const metrics = {
    total: current?.total ?? '—',
    running: current?.running ?? '—',
    input: current?.needsInput ?? '—',
    blocked: current?.policyBlocked ?? '—',
  };
  const refreshState = activityRefreshState(query, now);
  const recent = (query.data?.events ?? []).slice(0, 6);
  const header = (
    <Box
      sx={{
        '@media (forced-colors: active)': { '& .MuiTypography-overline': { color: 'CanvasText' } },
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
              query.dataUpdatedAt
                ? t('activityFoundation.lastRefresh', {
                    at: formatDate(query.dataUpdatedAt, { hour: '2-digit', minute: '2-digit' }),
                  })
                : undefined
            }
            refreshLabel={t('activityPage.retry')}
            refreshing={query.isFetching}
            onRefresh={() => void refresh()}
          />
        }
      />
    </Box>
  );

  if (query.isLoading)
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('activityHome.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  if (query.isError || !query.data)
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('activityHome.errorTitle')}
          description={t('activityHome.errorDescription')}
          retryLabel={t('activityPage.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      </PageCanvas>
    );

  return (
    <PageCanvas>
      {header}
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
      <ActivitySourceStatus sources={query.data.sourceStates} partial={query.data.partial} />
      <ActivityConnectorStatus
        report={sources.isError ? undefined : sources.data}
        loading={sources.isLoading}
        failed={sources.isError}
      />
      <Box
        sx={{
          mt: 4,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box
          ref={recentActivityRef}
          component="section"
          aria-labelledby="activity-home-recent"
          sx={{ minWidth: 0 }}
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
          <Box sx={{ mt: 2 }}>
            {recent.length ? (
              recent.map((event, index) => {
                const EventIcon =
                  event.state === 'policy-blocked'
                    ? ShieldX
                    : event.state === 'needs-input'
                      ? CircleAlert
                      : event.actor === 'agent'
                        ? Bot
                        : Activity;
                return (
                  <Box
                    key={event.id}
                    sx={{
                      mt: index ? 1.25 : 0,
                      px: 2,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                      borderLeft: 3,
                      borderLeftColor:
                        event.state === 'policy-blocked' || event.state === 'failed'
                          ? 'error.main'
                          : event.state === 'needs-input'
                            ? 'warning.main'
                            : event.state === 'completed'
                              ? 'success.main'
                              : 'primary.main',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <Stack
                      data-shell-auxiliary-avoidance="inline-end"
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      gap={1.5}
                      sx={{ py: 1.6 }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.25}
                        alignItems="flex-start"
                        sx={{ minWidth: 0 }}
                      >
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
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="p"
                            sx={{ mt: 0.3 }}
                          >
                            {event.summary || event.objectLabel}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(`activityPage.states.${event.state}`)}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(event.occurredAt, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                        <ActionButton
                          component={Link}
                          to={`/activity/timeline?event=${encodeURIComponent(event.id)}`}
                          intent="quiet"
                          size="small"
                        >
                          {t('activityHome.open')}
                        </ActionButton>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })
            ) : (
              <EmptyState
                title={t('activityHome.emptyTitle')}
                description={t('activityHome.emptyDescription')}
                size="compact"
              />
            )}
          </Box>
        </Box>

        <Box
          component="aside"
          aria-labelledby="activity-home-attention"
          sx={{
            p: 2.5,
            minWidth: 0,
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
          {!current ? (
            summary.isLoading ? (
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
                </Box>
              </Stack>
            )
          ) : current.needsInput + current.policyBlocked === 0 ? (
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 2.5 }}>
              <CheckCircle2 size={19} color="currentColor" aria-hidden="true" />
              <Box>
                <Typography variant="subtitle2">
                  {t('activityHome.attention.clearTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p">
                  {t('activityHome.attention.clearDescription')}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={1.25} sx={{ mt: 2.5 }}>
              <Typography
                variant="h3"
                component="p"
                sx={{ color: 'warning.dark', fontVariantNumeric: 'tabular-nums' }}
              >
                {current.needsInput + current.policyBlocked}
              </Typography>
              <ActionButton
                component={Link}
                to="/activity/timeline?state=needs-input"
                intent="secondary"
                startIcon={<CircleAlert size={17} aria-hidden="true" />}
                fullWidth
              >
                {t('activityHome.attention.input', { count: metrics.input })}
              </ActionButton>
              <ActionButton
                component={Link}
                to="/activity/timeline?state=policy-blocked"
                intent="secondary"
                startIcon={<ShieldX size={17} aria-hidden="true" />}
                fullWidth
              >
                {t('activityHome.attention.blocked', { count: metrics.blocked })}
              </ActionButton>
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
            {t('activityHome.attention.notice')}
          </Typography>
        </Box>
      </Box>
    </PageCanvas>
  );
}
