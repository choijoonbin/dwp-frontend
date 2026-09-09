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
import { meetingHomeCard } from './meeting-home-presentation';
import type { MeetingHomeQueueState } from './meeting-home-queue-state';

export function MeetingHomeWorkQueue({
  scope,
  actorId,
  timeZone,
  embedded = false,
  onStateChange,
}: {
  scope: string;
  actorId: number;
  timeZone: string;
  embedded?: boolean;
  onStateChange?: (state: MeetingHomeQueueState) => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  const client = useQueryClient();
  const queryKey = useMemo(() => ['meetings', 'home', 'work-queue', scope] as const, [scope]);
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const data = await getWorkAssignments(
        { scope: 'ASSIGNED_TO_ME', page: 0, size: MEETING_HOME_WORK_PAGE_SIZE },
        signal
      );
      if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      return projectMeetingHomeWorkQueue(data, actorId, Date.now());
    },
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
  const items = query.isError || query.isRefetchError || query.isFetching ? [] : (query.data ?? []);
  useEffect(() => {
    if (!onStateChange) return;
    onStateChange({
      status:
        query.isLoading || query.isFetching
          ? 'loading'
          : query.isError || query.isRefetchError
            ? 'error'
            : 'ready',
      count: items.length,
    });
  }, [
    items.length,
    onStateChange,
    query.isError,
    query.isFetching,
    query.isLoading,
    query.isRefetchError,
  ]);
  const formatDue = (value: string) =>
    formatDate(
      value,
      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );

  return (
    <Box
      component="section"
      aria-labelledby={embedded ? undefined : 'meeting-home-work-title'}
      aria-label={embedded ? t('home.workQueue.title') : undefined}
      sx={{ mt: embedded ? 0 : 2 }}
    >
      {!embedded && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <ClipboardCheck size={17} aria-hidden="true" />
            <Typography id="meeting-home-work-title" component="h3" variant="subtitle2">
              {t('home.workQueue.title')}
            </Typography>
          </Stack>
          <ActionButton
            intent="quiet"
            size="small"
            onClick={() => navigate('/meetings/follow-ups')}
          >
            {t('home.workQueue.openAll')}
          </ActionButton>
        </Stack>
      )}
      {!embedded && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5, mb: 1 }}>
          {t('home.workQueue.description')}
        </Typography>
      )}
      {query.isLoading || query.isFetching ? (
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
        <Stack gap={1.25} data-testid="meeting-home-work-items">
          {items.slice(0, embedded ? 2 : 6).map((item) => (
            <Box
              component="article"
              key={item.assignmentId}
              sx={(theme) => ({ ...meetingHomeCard(theme), p: { xs: 1.5, md: 2 }, minWidth: 0 })}
            >
              <Stack gap={0.75}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.75 }}>
                    <Chip size="small" label={t(`followUps.workStates.${item.workState}`)} />
                    {item.overdue && (
                      <Chip
                        size="small"
                        color="error"
                        variant="outlined"
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
                </Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
                    {item.dueAt
                      ? t('home.workQueue.dueAt', { date: formatDue(item.dueAt) })
                      : t('followUps.noDue')}
                  </Typography>
                  <ActionButton
                    intent="quiet"
                    size="small"
                    aria-label={t('home.workQueue.openTask', { title: item.title })}
                    endIcon={<ArrowRight size={16} aria-hidden="true" />}
                    onClick={() =>
                      navigate(
                        '/meetings/follow-ups?' +
                          new URLSearchParams({ assignment: item.assignmentId })
                      )
                    }
                    sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
                  >
                    {t('home.workQueue.checkTask')}
                  </ActionButton>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : embedded ? null : (
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
