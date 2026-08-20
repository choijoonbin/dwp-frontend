import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ArrowRight, Bot, CircleAlert, ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getWorkspaceActivity } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function ActivityHome() {
  const { t } = useTranslation('work');
  const query = useQuery({
    queryKey: ['workspace', 'activity'],
    queryFn: getWorkspaceActivity,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const metrics = useMemo(() => {
    const events = query.data?.events ?? [];
    return {
      total: events.length,
      running: events.filter((event) => event.state === 'running').length,
      input: events.filter((event) => event.state === 'needs-input').length,
      blocked: events.filter((event) => event.state === 'policy-blocked').length,
    };
  }, [query.data?.events]);
  const recent = (query.data?.events ?? []).slice(0, 6);
  const header = (
    <ResourcePageHeader
      eyebrow={t('activityHome.eyebrow')}
      title={t('activityHome.title')}
      description={t('activityHome.description')}
      status={
        <LiveStatus
          state={query.isFetching ? 'syncing' : 'live'}
          label={t('activityHome.live')}
          refreshLabel={t('activityPage.retry')}
          refreshing={query.isFetching}
          onRefresh={() => void query.refetch()}
        />
      }
    />
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
          items={[
            {
              key: 'total',
              value: metrics.total,
              label: t('activityHome.metrics.total'),
              detail: t('activityHome.metrics.totalDetail'),
            },
            {
              key: 'running',
              value: metrics.running,
              label: t('activityHome.metrics.running'),
              detail: t('activityHome.metrics.runningDetail'),
              tone: 'info',
            },
            {
              key: 'input',
              value: metrics.input,
              label: t('activityHome.metrics.input'),
              detail: t('activityHome.metrics.inputDetail'),
              tone: 'warning',
            },
            {
              key: 'blocked',
              value: metrics.blocked,
              label: t('activityHome.metrics.blocked'),
              detail: t('activityHome.metrics.blockedDetail'),
              tone: 'critical',
            },
          ]}
        />
      </Box>
      <Box component="section" aria-labelledby="activity-home-recent" sx={{ mt: 4 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1.5}
        >
          <Box>
            <Typography id="activity-home-recent" component="h2" variant="h6">
              {t('activityHome.recentTitle')}
            </Typography>
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
        <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
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
                <Box key={event.id}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    gap={1.5}
                    sx={{ py: 1.6 }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Box
                        aria-hidden="true"
                        sx={{
                          width: 34,
                          height: 34,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'var(--dwp-product-soft)',
                          color: 'var(--dwp-product-accent)',
                          borderRadius: 1,
                        }}
                      >
                        <EventIcon size={17} />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={800}>
                          {event.title}
                        </Typography>
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
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`activityPage.states.${event.state}`)}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(event.occurredAt, { hour: '2-digit', minute: '2-digit' })}
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
    </PageCanvas>
  );
}
