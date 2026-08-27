import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, FileClock, Gauge, UsersRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { getVideoMeetingHistory } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { useSearchParams } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatMeetingDateTime, MeetingPageHeading } from './meeting-components';
import { MeetingRecapDetail } from './meeting-recap-detail';

export function MeetingHistory() {
  const { t, i18n } = useTranslation('meetings');
  const [page, setPage] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMeetingId = searchParams.get('meeting');
  const query = useQuery({
    queryKey: ['meetings', 'history', page],
    queryFn: () => getVideoMeetingHistory(page, 30),
    staleTime: 30_000,
    retry: 1,
  });

  if (selectedMeetingId) {
    return (
      <PageCanvas>
        <MeetingRecapDetail
          meetingId={selectedMeetingId}
          onClose={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('meeting');
            setSearchParams(next, { replace: true });
          }}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <MeetingPageHeading
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        description={t('history.description')}
      />
      <Alert severity="info" icon={<FileClock size={19} />} sx={{ mb: 2 }}>
        {t('history.recordingGovernance')}
      </Alert>

      {query.isLoading ? (
        <LoadingState label={t('history.loading')} variant="skeleton" skeletonRows={6} />
      ) : query.isError || !query.data ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : query.data.items.length ? (
        <>
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {query.data.items.map((meeting, index) => (
              <Box key={meeting.meetingId}>
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  gap={2}
                  sx={{ p: 2 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography component="h2" variant="subtitle1" fontWeight={800}>
                      {meeting.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {t('history.endedAt', {
                        time: formatMeetingDateTime(meeting.endedAt, i18n.language),
                      })}
                    </Typography>
                    <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mt: 1 }}>
                      <Stack direction="row" gap={0.5} alignItems="center">
                        <FileClock size={14} />
                        <Typography variant="caption">
                          {t('history.duration', { count: meeting.actualDurationMinutes })}
                        </Typography>
                      </Stack>
                      <Stack direction="row" gap={0.5} alignItems="center">
                        <UsersRound size={14} />
                        <Typography variant="caption">
                          {t('history.peak', { count: meeting.participantPeak })}
                        </Typography>
                      </Stack>
                      {meeting.averageQualityScore != null && (
                        <Stack direction="row" gap={0.5} alignItems="center">
                          <Gauge size={14} />
                          <Typography variant="caption">
                            {t('history.quality', { value: meeting.averageQualityScore })}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                  <Stack direction="row" gap={0.75} flexWrap="wrap">
                    {meeting.recordingAvailable && (
                      <Chip size="small" label={t('history.recording')} />
                    )}
                    {meeting.transcriptAvailable && (
                      <Chip size="small" label={t('history.transcript')} />
                    )}
                    {!meeting.recordingAvailable && !meeting.transcriptAvailable && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('history.contentUnavailable')}
                      />
                    )}
                    <ActionButton
                      intent="quiet"
                      size="small"
                      endIcon={<ArrowRight size={15} aria-hidden="true" />}
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.set('meeting', meeting.meetingId);
                        setSearchParams(next);
                      }}
                    >
                      {t('history.openRecap')}
                    </ActionButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>
          {query.data.total > query.data.pageSize && (
            <Stack alignItems="flex-end" sx={{ mt: 2 }}>
              <Pagination
                page={page + 1}
                count={Math.ceil(query.data.total / query.data.pageSize)}
                onChange={(_, value) => setPage(value - 1)}
              />
            </Stack>
          )}
        </>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('history.empty')}
          description={t('history.emptyDescription')}
        />
      )}
    </PageCanvas>
  );
}
