import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Play, Search, X } from 'lucide-react';
import {
  ActionButton,
  FormField,
  foundationTokens,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { HttpError, useAuth } from '@dwp-frontend/shared-utils';
import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  queryVideoMeetingTranscript,
  type VideoMeetingTranscriptSegment,
} from '@dwp-frontend/shared-utils/api/video-meeting-transcript-api';

import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useMeetingPlaybackSync } from './meeting-playback-sync';

const PAGE_SIZE = 25;
const transcriptAuthorizationDenied = (error: unknown) =>
  error instanceof HttpError && [401, 403, 404].includes(error.status);

function formatTimestamp(millis: number) {
  const totalSeconds = Math.max(0, Math.floor(millis / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MeetingTranscriptViewer({
  meetingId,
  artifact,
}: {
  meetingId: string;
  artifact: VideoMeetingArtifact;
}) {
  const { t } = useTranslation('meetings');
  const auth = useAuth();
  const authorizationScope = JSON.stringify([
    auth.isAuthenticated,
    auth.user?.identityPlane ?? null,
    auth.user?.tenantId ?? null,
    auth.user?.userId ?? null,
  ]);
  const playback = useMeetingPlaybackSync();
  const generation = useRef(0);
  const [opened, setOpened] = useState(false);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [segments, setSegments] = useState<VideoMeetingTranscriptSegment[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const activeSegment = useMemo(
    () =>
      playback?.currentMillis == null
        ? null
        : (segments.find(
            (segment) =>
              playback.currentMillis! >= segment.startMillis &&
              playback.currentMillis! < segment.endMillis
          )?.segmentId ?? null),
    [playback?.currentMillis, segments]
  );

  const load = async (cursor: number, requestedQuery: string, append: boolean) => {
    const requestGeneration = ++generation.current;
    setLoading(true);
    setError(false);
    try {
      const page = await queryVideoMeetingTranscript(meetingId, artifact, {
        cursor,
        pageSize: PAGE_SIZE,
        query: requestedQuery || undefined,
      });
      if (generation.current !== requestGeneration) return;
      setSegments((current) => (append ? [...current, ...page.segments] : page.segments));
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      if (generation.current !== requestGeneration) return;
      if (transcriptAuthorizationDenied(loadError)) {
        setSegments([]);
        setNextCursor(null);
        setInput('');
        setQuery('');
        setAccessRevoked(true);
        setError(false);
      } else {
        setError(true);
      }
    } finally {
      if (generation.current === requestGeneration) setLoading(false);
    }
  };

  useEffect(() => {
    generation.current += 1;
    setOpened(false);
    setInput('');
    setQuery('');
    setSegments([]);
    setNextCursor(null);
    setError(false);
    setAccessRevoked(false);
    return () => {
      generation.current += 1;
    };
  }, [authorizationScope, meetingId, artifact.artifactId, artifact.version]);

  if (!opened) {
    return (
      <Stack gap={1.25} data-testid="meeting-transcript-viewer">
        <Box>
          <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
            {t('history.recap.transcript.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('history.recap.transcript.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="secondary"
          startIcon={<FileText size={16} aria-hidden="true" />}
          onClick={() => {
            setOpened(true);
            void load(0, '', false);
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          {t('history.recap.transcript.open')}
        </ActionButton>
        <Typography variant="caption" color="text.secondary">
          {t('history.recap.transcript.privacy')}
        </Typography>
      </Stack>
    );
  }

  if (accessRevoked) {
    return (
      <Stack gap={1.25} data-testid="meeting-transcript-viewer">
        <Box>
          <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
            {t('history.recap.transcript.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('history.recap.transcript.description')}
          </Typography>
        </Box>
        <InlineFeedback severity="error">
          {t('history.recap.transcript.accessRevoked')}
        </InlineFeedback>
        <Typography variant="caption" color="text.secondary">
          {t('history.recap.transcript.privacy')}
        </Typography>
      </Stack>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = input.trim();
    if (next.length === 1) return;
    setQuery(next);
    setSegments([]);
    setNextCursor(null);
    void load(0, next, false);
  };

  const clear = () => {
    setInput('');
    setQuery('');
    setSegments([]);
    setNextCursor(null);
    void load(0, '', false);
  };

  return (
    <Stack gap={1.5} data-testid="meeting-transcript-viewer">
      <Box>
        <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
          {t('history.recap.transcript.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('history.recap.transcript.description')}
        </Typography>
      </Box>
      <Box component="form" role="search" onSubmit={submit}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <FormField
            size="small"
            fullWidth
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 80))}
            label={t('history.recap.transcript.searchLabel')}
            placeholder={t('history.recap.transcript.searchPlaceholder')}
            errorMessage={
              input.trim().length === 1 ? t('history.recap.transcript.searchMinimum') : undefined
            }
            reserveFeedbackSpace
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
              htmlInput: { maxLength: 80 },
            }}
          />
          <ActionButton
            intent="secondary"
            type="submit"
            disabled={loading || input.trim().length === 1}
            startIcon={<Search size={16} aria-hidden="true" />}
            sx={{ minHeight: 44 }}
          >
            {t('history.recap.transcript.search')}
          </ActionButton>
          {query && (
            <ActionButton
              intent="secondary"
              onClick={clear}
              disabled={loading}
              startIcon={<X size={16} aria-hidden="true" />}
              sx={{ minHeight: 44 }}
            >
              {t('history.recap.transcript.clear')}
            </ActionButton>
          )}
        </Stack>
      </Box>
      {error && (
        <InlineFeedback severity="warning">
          {t('history.recap.transcript.loadError')}
        </InlineFeedback>
      )}
      {!error && !loading && segments.length === 0 && (
        <Stack alignItems="center" gap={0.75} sx={{ py: 3, color: 'text.secondary' }}>
          <FileText size={22} aria-hidden="true" />
          <Typography variant="body2">
            {query ? t('history.recap.transcript.noResults') : t('history.recap.transcript.empty')}
          </Typography>
        </Stack>
      )}
      {segments.length > 0 && (
        <Stack
          component="ol"
          gap={0.5}
          sx={{ p: 0, m: 0, listStyle: 'none', maxHeight: 520, overflowY: 'auto' }}
        >
          {segments.map((segment) => {
            const active = activeSegment === segment.segmentId;
            return (
              <Box
                component="li"
                key={segment.segmentId}
                aria-current={active ? 'true' : undefined}
                sx={(theme) => ({
                  display: 'grid',
                  gridTemplateColumns: { xs: 'auto minmax(0, 1fr)', sm: '72px minmax(0, 1fr)' },
                  gap: 1.25,
                  alignItems: 'start',
                  p: 1.25,
                  borderInlineStart: '3px solid',
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? 'action.selected' : 'transparent',
                  borderRadius: foundationTokens.radius.control + 'px',
                  transition: theme.transitions.create('background-color', {
                    duration: theme.transitions.duration.shortest,
                  }),
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                })}
              >
                <ActionButton
                  intent="secondary"
                  size="small"
                  onClick={() => playback?.seekTo(segment.startMillis)}
                  disabled={!playback}
                  startIcon={<Play size={14} aria-hidden="true" />}
                  aria-label={t('history.recap.transcript.seek', {
                    time: formatTimestamp(segment.startMillis),
                  })}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  {formatTimestamp(segment.startMillis)}
                </ActionButton>
                <Typography variant="body2" sx={{ pt: 0.75, whiteSpace: 'pre-wrap' }}>
                  {segment.text}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
      {loading && <LoadingState label={t('history.recap.transcript.loading')} size="compact" />}
      {!loading && !error && nextCursor != null && (
        <ActionButton
          intent="secondary"
          onClick={() => void load(nextCursor, query, true)}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          {t('history.recap.transcript.loadMore')}
        </ActionButton>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('history.recap.transcript.privacy')}
      </Typography>
    </Stack>
  );
}
