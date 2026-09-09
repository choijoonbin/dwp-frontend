import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { ArrowRight } from 'lucide-react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createMeetingHomeCandidateLoader } from './meeting-home-candidate-model';
import { meetingHomeResultUnexpired } from './meeting-home-results-model';
import { meetingHomeCard } from './meeting-home-presentation';
import type { MeetingHomeQueueState } from './meeting-home-queue-state';

/** A published suggestion stays a suggestion; this surface never creates an assignment. */
export function MeetingHomeCandidateQueue({
  recent,
  scope,
  enabled,
  onStateChange,
}: {
  recent: VideoMeetingSummary[];
  scope: string;
  enabled: boolean;
  onStateChange?: (state: MeetingHomeQueueState) => void;
}) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const client = useQueryClient();
  const [now, setNow] = useState(Date.now);
  const binding = JSON.stringify([enabled, scope, recent.map((meeting) => meeting.meetingId)]);
  const loader = useMemo(() => createMeetingHomeCandidateLoader(binding), [binding]);
  const queryKey = useMemo(() => ['meetings', 'home', 'candidates', binding] as const, [binding]);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => loader.load(recent, signal),
    enabled: enabled && recent.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearInterval(timer);
      loader.revoke();
      client.removeQueries({ queryKey });
    };
  }, [client, loader, queryKey]);
  const entry =
    enabled && !query.isError && !query.isFetching
      ? query.data?.entries.find((candidate) => meetingHomeResultUnexpired(candidate, now))
      : null;
  const unavailable = query.isError || Boolean(query.data?.unavailable);
  useEffect(() => {
    if (!onStateChange) return;
    onStateChange({
      status: query.isFetching ? 'loading' : unavailable ? 'error' : 'ready',
      count: entry ? 1 : 0,
    });
  }, [entry, onStateChange, query.isFetching, unavailable]);
  if (!entry)
    return query.isFetching || unavailable ? (
      <Typography variant="caption" color="text.secondary">
        {t(query.isFetching ? 'followUps.candidates.loading' : 'followUps.candidates.loadError')}
      </Typography>
    ) : null;
  return (
    <Box
      component="article"
      data-testid="meeting-home-candidate"
      sx={(theme) => ({ ...meetingHomeCard(theme), p: { xs: 1.25, md: 2 } })}
    >
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Chip size="small" label={t('followUps.tabs.CANDIDATES')} />
        <Typography
          component="h3"
          variant="subtitle2"
          sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {entry.title}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ mt: 0.5, mb: 0.5, overflowWrap: 'anywhere' }}
      >
        {entry.meetingTitle}
      </Typography>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
          {t('followUps.candidates.confirmedSource')}
        </Typography>
        <ActionButton
          intent="secondary"
          size="small"
          endIcon={<ArrowRight size={14} aria-hidden="true" />}
          onClick={() => navigate('/meetings/follow-ups?scope=CANDIDATES')}
          sx={{ minHeight: 44, flexShrink: 0, typography: { xs: 'caption', md: 'button' } }}
        >
          {t('followUps.candidates.reviewCandidate')}
        </ActionButton>
      </Stack>
    </Box>
  );
}
