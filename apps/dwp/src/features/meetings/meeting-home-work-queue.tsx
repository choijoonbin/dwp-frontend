import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, ClipboardCheck } from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getWorkAssignments } from '@dwp-frontend/shared-utils/api/work-assignment-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  MEETING_HOME_WORK_PAGE_SIZE,
  projectMeetingHomeWorkQueue,
} from './meeting-home-work-queue-model';
import { meetingListSurface } from './meeting-visual-system';

export function MeetingHomeWorkQueue({
  scope,
  actorId,
  timeZone,
}: {
  scope: string;
  actorId: number;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  const client = useQueryClient();
  const queryKey = useMemo(() => ['meetings', 'home', 'work-queue', scope] as const, [scope]);
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      projectMeetingHomeWorkQueue(
        await getWorkAssignments({
          scope: 'ASSIGNED_TO_ME',
          page: 0,
          size: MEETING_HOME_WORK_PAGE_SIZE,
        }),
        actorId,
        Date.now()
      ),
    enabled: actorId > 0,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  useEffect(
    () => () => {
      client.removeQueries({ queryKey });
    },
    [client, queryKey]
  );
  const items = query.isError || query.isRefetchError ? [] : (query.data ?? []);
  const formatDue = (value: string) =>
    formatDate(
      value,
      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );

  return (
    <Box component="section" aria-labelledby="meeting-home-work-title" sx={{ mt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <ClipboardCheck size={17} aria-hidden="true" />
          <Typography id="meeting-home-work-title" component="h3" variant="subtitle2">
            {t('home.workQueue.title')}
          </Typography>
        </Stack>
        <ActionButton intent="quiet" size="small" onClick={() => navigate('/meetings/follow-ups')}>
          {t('home.workQueue.openAll')}
        </ActionButton>
      </Stack>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5, mb: 1 }}>
        {t('home.workQueue.description')}
      </Typography>
      {query.isLoading ? (
        <LoadingState label={t('home.workQueue.loading')} size="compact" skeletonRows={2} />
      ) : query.isError || query.isRefetchError ? (
        <ErrorState
          size="compact"
          title={t('home.workQueue.errorTitle')}
          description={t('home.workQueue.errorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : items.length ? (
        <Box sx={(theme) => meetingListSurface(theme)} data-testid="meeting-home-work-items">
          {items.map((item) => (
            <Box component="article" key={item.assignmentId} sx={{ p: 1.5, minWidth: 0 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.75 }}>
                    <Chip size="small" label={t(`followUps.workStates.${item.workState}`)} />
                    {item.overdue && (
                      <Chip
                        size="small"
                        color="error"
                        icon={<CircleAlert size={13} aria-hidden="true" />}
                        label={t('home.workQueue.overdue')}
                      />
                    )}
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={(theme) => ({
                      fontWeight: theme.typography.fontWeightBold,
                      overflowWrap: 'anywhere',
                    })}
                  >
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.dueAt
                      ? t('home.workQueue.dueAt', { date: formatDue(item.dueAt) })
                      : t('followUps.noDue')}
                  </Typography>
                </Box>
                <ActionButton
                  intent="quiet"
                  size="small"
                  aria-label={t('home.workQueue.openTask', { title: item.title })}
                  onClick={() => navigate('/meetings/follow-ups')}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <ArrowRight size={16} aria-hidden="true" />
                </ActionButton>
              </Stack>
            </Box>
          ))}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="empty"
          size="compact"
          title={t('home.workQueue.emptyTitle')}
          description={t('home.workQueue.emptyDescription')}
        />
      )}
    </Box>
  );
}
