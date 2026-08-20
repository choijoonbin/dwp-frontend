import { useTranslation } from 'react-i18next';
import { ArrowRight, BellRing, CircleAlert, MessageSquareText } from 'lucide-react';
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
import { getNotificationInbox, getNotificationSummary } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function NotificationHome() {
  const { t } = useTranslation('notifications');
  const query = useQuery({
    queryKey: ['notifications', 'home'],
    queryFn: async () => {
      const [summary, inbox] = await Promise.all([
        getNotificationSummary(),
        getNotificationInbox({ view: 'PRIORITY', limit: 6 }),
      ]);
      return { summary, inbox };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
  const header = (
    <ResourcePageHeader
      eyebrow={t('home.eyebrow')}
      title={t('home.title')}
      description={t('home.description')}
      status={
        <LiveStatus
          state={query.isFetching ? 'syncing' : 'live'}
          label={t('home.live')}
          refreshLabel={t('actions.refresh')}
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
        <LoadingState label={t('home.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  if (query.isError || !query.data)
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('home.errorTitle')}
          description={t('home.errorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      </PageCanvas>
    );

  const { summary, inbox } = query.data;
  return (
    <PageCanvas>
      {header}
      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('home.summaryLabel')}
          items={[
            {
              key: 'actionable',
              value: summary.actionableUnread,
              label: t('home.metrics.actionable'),
              detail: t('home.metrics.actionableDetail'),
              tone: 'warning',
            },
            {
              key: 'unread',
              value: summary.totalUnread,
              label: t('home.metrics.unread'),
              detail: t('home.metrics.unreadDetail'),
              tone: 'info',
            },
            {
              key: 'mentions',
              value: summary.viewCounts.MENTIONS,
              label: t('home.metrics.mentions'),
              detail: t('home.metrics.mentionsDetail'),
            },
            {
              key: 'later',
              value: summary.viewCounts.SNOOZED,
              label: t('home.metrics.later'),
              detail: t('home.metrics.laterDetail'),
            },
          ]}
        />
      </Box>
      <Box component="section" aria-labelledby="notification-home-priority" sx={{ mt: 4 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1.5}
        >
          <Box>
            <Typography id="notification-home-priority" component="h2" variant="h6">
              {t('home.priorityTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {t('home.priorityDescription')}
            </Typography>
          </Box>
          <ActionButton
            component={Link}
            to="/notifications/center"
            intent="secondary"
            endIcon={<ArrowRight size={16} />}
          >
            {t('home.openCenter')}
          </ActionButton>
        </Stack>
        <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
          {inbox.items.length ? (
            inbox.items.map((item, index) => {
              const ItemIcon = item.reason.kind === 'MENTION' ? MessageSquareText : CircleAlert;
              return (
                <Box key={item.notificationId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    gap={1.5}
                    sx={{ py: 1.65 }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start" minWidth={0}>
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
                          flexShrink: 0,
                        }}
                      >
                        <ItemIcon size={17} />
                      </Box>
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={800}>
                          {item.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ mt: 0.3 }}
                        >
                          {item.preview || item.source.appName}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={item.priority === 'URGENT' ? 'error' : 'default'}
                        label={t(`priority.${item.priority}`)}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(item.receivedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                      </Typography>
                      <ActionButton
                        component={Link}
                        to={`/notifications/center/${encodeURIComponent(item.notificationId)}`}
                        intent="quiet"
                        size="small"
                      >
                        {t('home.open')}
                      </ActionButton>
                    </Stack>
                  </Stack>
                </Box>
              );
            })
          ) : (
            <EmptyState
              title={t('home.emptyTitle')}
              description={t('home.emptyDescription')}
              icon={<BellRing size={24} />}
              size="compact"
            />
          )}
        </Box>
      </Box>
    </PageCanvas>
  );
}
