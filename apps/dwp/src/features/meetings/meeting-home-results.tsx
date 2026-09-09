import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileCheck2, ListTodo } from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import {
  formatDate as formatSharedDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  boundMeetingHomeResults,
  createMeetingHomeResultsLoader,
  meetingHomeResultReviewPath,
  meetingHomeResultUnexpired,
  type MeetingHomeResultsSection,
} from './meeting-home-results-model';
import { meetingHomeCard, meetingHomeInset } from './meeting-home-presentation';
import type { MeetingHomeManualOutcome } from './meeting-home-manual-outcomes-model';
import type { MeetingHomeQueueState } from './meeting-home-queue-state';

export function MeetingHomeResults({
  recent,
  section,
  timeZone = resolveSystemTimeZone('UTC'),
  embedded = false,
  manualOutcomes = [],
  onStateChange,
}: {
  recent: VideoMeetingSummary[];
  section: MeetingHomeResultsSection;
  timeZone?: string;
  embedded?: boolean;
  manualOutcomes?: readonly MeetingHomeManualOutcome[];
  onStateChange?: (state: MeetingHomeQueueState) => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const auth = useAuth();
  const navigate = useNavigate();
  const candidates = boundMeetingHomeResults(recent);
  const meetingIds = candidates.map((meeting) => meeting.meetingId);
  const tenantId = String(auth.user?.tenantId ?? '');
  const actorId = String(auth.user?.userId ?? '');
  const enabled =
    auth.isAuthenticated &&
    auth.user?.identityPlane === 'TENANT' &&
    Number.isSafeInteger(auth.user?.tenantId) &&
    Number(tenantId) > 0 &&
    Number.isSafeInteger(auth.user?.userId) &&
    Number(actorId) > 0;
  const scope = JSON.stringify([
    auth.isAuthenticated,
    auth.user?.identityPlane,
    tenantId,
    actorId,
    section,
    meetingIds,
  ]);
  const loader = useMemo(() => createMeetingHomeResultsLoader(scope, section), [scope, section]);
  const [now, setNow] = useState(Date.now);
  const [suppressed, setSuppressed] = useState<{ scope: string; ids: string[] } | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      loader.revoke();
    },
    [loader]
  );
  const query = useQuery({
    queryKey: ['meetings', 'home', 'results', scope],
    queryFn: async ({ signal }) => {
      const snapshot = await loader.load(meetingIds, signal, (meetingId) => {
        setSuppressed((current) => ({
          scope,
          ids: [...new Set([...(current?.scope === scope ? current.ids : []), meetingId])],
        }));
      });
      setSuppressed({ scope, ids: snapshot.failedMeetingIds });
      return snapshot;
    },
    enabled: enabled && meetingIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true, tenantId, actorId },
  });
  const entries =
    !enabled || query.isError || query.isRefetchError || query.isFetching
      ? []
      : (query.data?.entries ?? []).filter(
          (entry) =>
            meetingHomeResultUnexpired(entry, now) &&
            !(suppressed?.scope === scope && suppressed.ids.includes(entry.meetingId))
        );
  const partialError = query.isError || (query.data?.failedMeetingIds.length ?? 0) > 0;
  const loading = meetingIds.length > 0 && (query.isLoading || query.isFetching);
  useEffect(() => {
    if (!onStateChange) return;
    onStateChange({
      status: loading ? 'loading' : partialError && entries.length === 0 ? 'error' : 'ready',
      count: entries.length,
    });
  }, [entries.length, loading, onStateChange, partialError]);
  const titleId = `meeting-home-results-${section}-title`;
  const formatDate = (value: string) =>
    formatSharedDate(
      value,
      {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );
  const recentFallback = section === 'recent' ? candidates[0] : undefined;
  const manualOutcome = recentFallback
    ? manualOutcomes.find((outcome) => outcome.meetingId === recentFallback.meetingId)
    : undefined;

  return (
    <Box
      component="section"
      aria-labelledby={embedded ? undefined : titleId}
      aria-label={embedded ? t(`home.results.${section}.title`) : undefined}
      data-testid={`meeting-home-results-${section}`}
      sx={{ minWidth: 0 }}
    >
      {!embedded && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 1 }}
        >
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
            {section === 'queue' ? (
              <ListTodo size={17} aria-hidden="true" />
            ) : (
              <FileCheck2 size={17} aria-hidden="true" />
            )}
            <Typography id={titleId} component="h2" variant="subtitle2">
              {t(`home.results.${section}.title`)}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
            {section === 'queue' && (
              <Chip
                size="small"
                color={entries.length ? 'primary' : 'default'}
                label={t('home.results.count', { count: entries.length })}
              />
            )}
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => navigate('/meetings/history')}
              sx={{ minHeight: 44 }}
            >
              {t('actions.viewAll')}
            </ActionButton>
          </Stack>
        </Stack>
      )}
      {!embedded && section !== 'recent' && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 2 }}>
          {t('home.results.scope', { count: candidates.length })}
        </Typography>
      )}
      {loading ? (
        <LoadingState
          label={t('home.results.loading')}
          variant="skeleton"
          skeletonRows={3}
          size="compact"
        />
      ) : (
        <Stack spacing={1.5}>
          {entries.length > 0 && (
            <Stack gap={1.25}>
              {entries.slice(0, section === 'recent' ? 1 : embedded ? 2 : 4).map((entry) => (
                <Box
                  component="article"
                  key={entry.reportId}
                  data-testid={`meeting-home-result-${section}-${entry.meetingId}`}
                  sx={(theme) => ({
                    ...meetingHomeCard(theme),
                    p: { xs: 1.25, md: 2 },
                    minWidth: 0,
                    ...(section === 'queue'
                      ? {
                          borderLeft: 3,
                          borderLeftColor: alpha(theme.palette.primary.main, 0.55),
                        }
                      : {}),
                    '@media (forced-colors: active)': {
                      borderLeftColor: 'CanvasText',
                    },
                  })}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    flexWrap="wrap"
                  >
                    {section === 'queue' ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={section === 'queue' ? 'primary' : 'success'}
                        label={t(`home.results.${section}.badge`)}
                      />
                    ) : (
                      <Typography
                        component="h3"
                        variant="subtitle2"
                        sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
                      >
                        {candidates.find((meeting) => meeting.meetingId === entry.meetingId)?.title}
                      </Typography>
                    )}
                    {section === 'queue' && (
                      <Typography
                        component="h3"
                        variant="subtitle2"
                        sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
                      >
                        {candidates.find((meeting) => meeting.meetingId === entry.meetingId)?.title}
                      </Typography>
                    )}
                    {entry.publishedAt && Number.isFinite(Date.parse(entry.publishedAt)) && (
                      <Typography variant="caption" color="text.secondary">
                        {t('home.results.publishedAt', { date: formatDate(entry.publishedAt) })}
                      </Typography>
                    )}
                  </Stack>
                  {entry.summary ? (
                    <Typography
                      component="blockquote"
                      variant="body2"
                      sx={(theme) => ({
                        ...meetingHomeInset(theme),
                        m: 0,
                        mt: 1,
                        p: { xs: 1, md: 1.5 },
                        borderLeft: 3,
                        borderLeftColor: 'primary.main',
                        fontStyle: 'italic',
                        color: theme.palette.text.secondary,
                        overflowWrap: 'anywhere',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      })}
                    >
                      “{entry.summary}”
                    </Typography>
                  ) : (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                      sx={{ mt: 0.5, mb: 0 }}
                    >
                      {t(`home.results.${section}.description`)}
                    </Typography>
                  )}
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    flexWrap="nowrap"
                    sx={(theme) => ({
                      ...(section === 'recent' ? meetingHomeInset(theme) : {}),
                      mt: 0.75,
                      p: section === 'recent' ? 0.75 : 0,
                    })}
                  >
                    <Stack gap={0.25} sx={{ minWidth: 0 }}>
                      {section === 'recent' && (
                        <Typography variant="caption" color="primary.main">
                          {t('home.results.recent.badge')}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
                      >
                        {entry.legalHold
                          ? t('home.results.legalHold')
                          : t('home.results.retentionUntil', {
                              date: formatDate(entry.retentionUntil),
                            })}
                      </Typography>
                    </Stack>
                    <ActionButton
                      intent={section === 'queue' ? 'primary' : 'quiet'}
                      size="small"
                      endIcon={<ArrowRight size={15} aria-hidden="true" />}
                      onClick={() =>
                        navigate(
                          section === 'queue'
                            ? meetingHomeResultReviewPath(entry)
                            : `/meetings/history?meeting=${encodeURIComponent(entry.meetingId)}&reportId=${encodeURIComponent(entry.reportId)}`
                        )
                      }
                      sx={{
                        minHeight: 44,
                        flexShrink: 0,
                        typography: { xs: 'caption', md: 'button' },
                      }}
                    >
                      {t(`home.results.${section}.action`)}
                    </ActionButton>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
          {!entries.length && !loading && recentFallback && (
            <Box
              component="article"
              data-testid="meeting-home-recent-factual"
              sx={(theme) => ({ ...meetingHomeCard(theme), p: { xs: 1.5, md: 2 }, minWidth: 0 })}
            >
              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                <Typography
                  component="h3"
                  variant="subtitle2"
                  sx={{ flex: 1, minWidth: 180, overflowWrap: 'anywhere' }}
                >
                  {recentFallback.title}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={manualOutcome?.decision ? 'success' : 'default'}
                  label={
                    manualOutcome?.decision
                      ? t('home.manual.resultBadge')
                      : t('home.manual.endedBadge')
                  }
                />
                {recentFallback.endedAt && (
                  <Typography variant="caption" color="text.secondary">
                    {t('home.manual.endedAt', { date: formatDate(recentFallback.endedAt) })}
                  </Typography>
                )}
              </Stack>
              {manualOutcome?.decision ? (
                <Typography
                  component="blockquote"
                  variant="body2"
                  sx={(theme) => ({
                    ...meetingHomeInset(theme),
                    m: 0,
                    mt: 1,
                    p: { xs: 1, md: 1.5 },
                    borderLeft: 3,
                    borderLeftColor: 'success.main',
                    overflowWrap: 'anywhere',
                  })}
                >
                  {manualOutcome.decision}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t('home.manual.noPublishedRecap')}
                </Typography>
              )}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ mt: 0.75 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {manualOutcome?.decision
                    ? t('home.manual.notAiResult')
                    : t('home.manual.providerUnavailable')}
                </Typography>
                <ActionButton
                  intent="quiet"
                  size="small"
                  endIcon={<ArrowRight size={15} aria-hidden="true" />}
                  onClick={() =>
                    navigate(
                      `/meetings/history?meeting=${encodeURIComponent(recentFallback.meetingId)}`
                    )
                  }
                  sx={{ minHeight: 44, flexShrink: 0 }}
                >
                  {t('home.manual.openMeeting')}
                </ActionButton>
              </Stack>
            </Box>
          )}
          {partialError && (
            <ErrorState
              size="compact"
              title={t('home.results.errorTitle')}
              description={t('home.results.errorDescription')}
              retryLabel={t('home.results.retry')}
              retrying={query.isFetching}
              onRetry={() => query.refetch()}
            />
          )}
          {!entries.length &&
            !recentFallback &&
            !partialError &&
            (embedded ? null : (
              <GuidedEmptyState
                kind="empty"
                size="compact"
                title={t(`home.results.${section}.emptyTitle`)}
                description={t(`home.results.${section}.emptyDescription`)}
              />
            ))}
        </Stack>
      )}
    </Box>
  );
}
