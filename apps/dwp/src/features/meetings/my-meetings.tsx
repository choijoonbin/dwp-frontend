import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { getVideoMeetings } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MeetingPageHeading, MeetingSummaryRow } from './meeting-components';
import { MeetingScheduleDialog } from './meeting-schedule-dialog';
import { meetingListSurface } from './meeting-visual-system';
import {
  scheduleVideoMeeting,
  type ScheduleVideoMeetingInput,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@dwp-frontend/shared-utils';

export function MyMeetings() {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const query = useQuery({
    queryKey: ['meetings', 'mine', page],
    queryFn: () => getVideoMeetings(page, 30),
    staleTime: 30_000,
    retry: 1,
  });
  const scheduleMutation = useMutation({
    mutationFn: (input: ScheduleVideoMeetingInput) => scheduleVideoMeeting(input),
    onSuccess: async () => {
      setScheduleOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success(t('schedule.success'));
    },
    onError: () => toast.error(t('schedule.error')),
  });

  return (
    <PageCanvas mode="focus">
      <MeetingPageHeading
        eyebrow={t('mine.eyebrow')}
        title={t('mine.title')}
        description={t('mine.description')}
        actions={
          <ActionButton
            intent="primary"
            startIcon={<Plus size={17} />}
            onClick={() => setScheduleOpen(true)}
          >
            {t('home.schedule.action')}
          </ActionButton>
        }
      />

      {query.isLoading ? (
        <LoadingState label={t('mine.loading')} variant="skeleton" skeletonRows={6} />
      ) : query.isError || !query.data ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : (
        <>
          <Box sx={(theme) => meetingListSurface(theme)}>
            {query.data.items.length ? (
              query.data.items.map((meeting) => (
                <MeetingSummaryRow
                  key={meeting.meetingId}
                  meeting={meeting}
                  onOpen={
                    meeting.lifecycleState === 'CANCELLED'
                      ? undefined
                      : () =>
                          navigate(
                            meeting.lifecycleState === 'ENDED'
                              ? `/meetings/history?meeting=${encodeURIComponent(meeting.meetingId)}`
                              : `/meetings/room/${encodeURIComponent(meeting.meetingId)}`
                          )
                  }
                />
              ))
            ) : (
              <GuidedEmptyState
                kind="empty"
                title={t('mine.empty')}
                description={t('mine.emptyDescription')}
              />
            )}
          </Box>
          {query.data.total > query.data.pageSize && (
            <Stack
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
              gap={1}
              sx={{ mt: 2 }}
            >
              <ActionButton
                intent="quiet"
                aria-label={t('mine.previous')}
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft size={17} />
              </ActionButton>
              <Typography variant="caption" color="text.secondary">
                {t('mine.page', {
                  current: page + 1,
                  total: Math.ceil(query.data.total / query.data.pageSize),
                })}
              </Typography>
              <ActionButton
                intent="quiet"
                aria-label={t('mine.next')}
                disabled={(page + 1) * query.data.pageSize >= query.data.total}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight size={17} />
              </ActionButton>
            </Stack>
          )}
        </>
      )}

      <MeetingScheduleDialog
        open={scheduleOpen}
        busy={scheduleMutation.isPending}
        onClose={() => setScheduleOpen(false)}
        onSubmit={(input) => scheduleMutation.mutate(input)}
      />
    </PageCanvas>
  );
}
