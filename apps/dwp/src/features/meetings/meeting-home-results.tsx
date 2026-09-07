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
  SectionHeader,
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
import { meetingListSurface } from './meeting-visual-system';

export function MeetingHomeResults({
  recent,
  section,
  timeZone = resolveSystemTimeZone('UTC'),
}: {
  recent: VideoMeetingSummary[];
  section: MeetingHomeResultsSection;
  timeZone?: string;
}) {
  const { t, i18n } = useTranslation('meetings');
  const auth = useAuth();
  const navigate = useNavigate();
  const candidates = boundMeetingHomeResults(recent);
  const meetingIds = candidates.map((meeting) => meeting.meetingId);
  const tenantId = String(auth.user?.tenantId ?? '');
  const actorId = String(auth.user?.userId ?? '');
  const scope = JSON.stringify([tenantId, actorId, section, meetingIds]);
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
    enabled: auth.isAuthenticated && Boolean(tenantId && actorId) && meetingIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true, tenantId, actorId },
  });
  const entries =
    query.isError || query.isRefetchError
      ? []
      : (query.data?.entries ?? []).filter(
          (entry) =>
            meetingHomeResultUnexpired(entry, now) &&
            !(suppressed?.scope === scope && suppressed.ids.includes(entry.meetingId))
        );
  const partialError = query.isError || (query.data?.failedMeetingIds.length ?? 0) > 0;
  const loading = meetingIds.length > 0 && query.isLoading;
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

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid={`meeting-home-results-${section}`}
      sx={{ minWidth: 0 }}
    >
      <SectionHeader
        density="compact"
        glyph="plain"
        id={titleId}
        icon={section === 'queue' ? ListTodo : FileCheck2}
        title={t(`home.results.${section}.title`)}
        meta={
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Chip
              size="small"
              color={section === 'queue' && entries.length ? 'primary' : 'default'}
              label={t('home.results.count', { count: entries.length })}
            />
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => navigate('/meetings/history')}
              sx={{ minHeight: 44 }}
            >
              {t('home.results.openLibrary')}
            </ActionButton>
          </Stack>
        }
      />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 2 }}>
        {t('home.results.scope', { count: candidates.length })}
      </Typography>
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
            <Box sx={(theme) => meetingListSurface(theme)}>
              {entries.map((entry) => (
                <Box
                  component="article"
                  key={entry.reportId}
                  data-testid={`meeting-home-result-${section}-${entry.meetingId}`}
                  sx={(theme) => ({
                    p: { xs: 1.5, md: 2 },
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
                    <Chip
                      size="small"
                      variant="outlined"
                      color={section === 'queue' ? 'primary' : 'success'}
                      label={t(`home.results.${section}.badge`)}
                    />
                    {entry.publishedAt && Number.isFinite(Date.parse(entry.publishedAt)) && (
                      <Typography variant="caption" color="text.secondary">
                        {t('home.results.publishedAt', { date: formatDate(entry.publishedAt) })}
                      </Typography>
                    )}
                  </Stack>
                  <Typography
                    component="h3"
                    variant="subtitle2"
                    sx={{ mt: 1.5, overflowWrap: 'anywhere' }}
                  >
                    {candidates.find((meeting) => meeting.meetingId === entry.meetingId)?.title}
                  </Typography>
                  {entry.summary ? (
                    <Typography
                      variant="body2"
                      sx={(theme) => ({
                        mt: 1,
                        pl: 1.5,
                        borderLeft: 2,
                        borderColor: 'primary.main',
                        color: theme.palette.text.secondary,
                        overflowWrap: 'anywhere',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      })}
                    >
                      {entry.summary}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {t(`home.results.${section}.description`)}
                    </Typography>
                  )}
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    flexWrap="wrap"
                    sx={{ mt: 1.5 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {entry.legalHold
                        ? t('home.results.legalHold')
                        : t('home.results.retentionUntil', {
                            date: formatDate(entry.retentionUntil),
                          })}
                    </Typography>
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
                      sx={{ minHeight: 44 }}
                    >
                      {t(`home.results.${section}.action`)}
                    </ActionButton>
                  </Stack>
                </Box>
              ))}
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
          {!entries.length && !partialError && (
            <GuidedEmptyState
              kind="empty"
              size="compact"
              title={t(`home.results.${section}.emptyTitle`)}
              description={t(`home.results.${section}.emptyDescription`)}
            />
          )}
        </Stack>
      )}
    </Box>
  );
}
