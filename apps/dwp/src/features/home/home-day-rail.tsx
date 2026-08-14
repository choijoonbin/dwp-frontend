import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  CalendarEvent,
  HomeBackgroundPosition,
  HomeOverview,
  HomeRecommendation,
  WorkspaceWorkItem,
} from '@dwp-frontend/shared-utils';

type HomeDayRailProps = {
  overview?: HomeOverview;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  currentDate: string;
  updatedAt: string;
  headline: string;
  subheadline: string;
  backgroundUrl: string;
  backgroundPosition: HomeBackgroundPosition;
  overlayOpacity: number;
  onRetry: () => void;
  feedbackBusy?: boolean;
  onRecommendationFeedback?: (recommendation: HomeRecommendation) => void;
};

const audienceTone = {
  MEMBER: '#176B68',
  MANAGER: '#7A4FC4',
  OPERATOR: '#A14B14',
} as const;

function nextWorkItem(items: readonly WorkspaceWorkItem[] = []): WorkspaceWorkItem | undefined {
  const statusOrder = { 'due-soon': 0, 'in-progress': 1, waiting: 2, completed: 3 };
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...items]
    .filter((item) => item.status !== 'completed')
    .sort(
      (left, right) =>
        statusOrder[left.status] - statusOrder[right.status] ||
        priorityOrder[left.priority] - priorityOrder[right.priority] ||
        new Date(left.dueAt ?? '9999-12-31').getTime() -
          new Date(right.dueAt ?? '9999-12-31').getTime()
    )[0];
}

function eventPosition(event: CalendarEvent) {
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  const dayStart = 8 * 60;
  const dayEnd = 20 * 60;
  const start = startsAt.getHours() * 60 + startsAt.getMinutes();
  const end = endsAt.getHours() * 60 + endsAt.getMinutes();
  const left = Math.max(0, Math.min(100, ((start - dayStart) / (dayEnd - dayStart)) * 100));
  const width = Math.max(2.5, (Math.max(15, end - start) / (dayEnd - dayStart)) * 100);
  return { left: `${left}%`, width: `${Math.min(100 - left, width)}%` };
}

function DayTimeline({ events }: { events: readonly CalendarEvent[] }) {
  const { t } = useTranslation('home');
  const visibleEvents = events.filter((event) => event.status !== 'CANCELLED' && !event.allDay);

  return (
    <Box component="section" aria-label={t('dayRail.timeline')} sx={{ mt: 2.5 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          color: 'text.secondary',
        }}
      >
        {['08', '10', '12', '14', '16', '18', '20'].map((hour) => (
          <Typography
            key={hour}
            variant="caption"
            sx={{ textAlign: hour === '08' ? 'left' : hour === '20' ? 'right' : 'center' }}
          >
            {hour}:00
          </Typography>
        ))}
      </Box>
      <Box
        sx={{
          position: 'relative',
          height: 38,
          mt: 0.5,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {[1, 2, 3, 4, 5].map((marker) => (
          <Box
            key={marker}
            aria-hidden="true"
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(marker / 6) * 100}%`,
              borderLeft: 1,
              borderColor: 'divider',
            }}
          />
        ))}
        {visibleEvents.map((event, index) => (
          <Box
            key={`${event.eventId}-${event.startsAt}`}
            title={`${event.title} ${formatDate(event.startsAt, { hour: '2-digit', minute: '2-digit' })}`}
            sx={{
              position: 'absolute',
              top: index % 2 === 0 ? 6 : 20,
              height: 10,
              borderRadius: 0.5,
              bgcolor: event.type === 'FOCUS' ? '#0F8A78' : event.conflict ? '#D64545' : '#356AE6',
              border: '1px solid rgba(255,255,255,0.8)',
              ...eventPosition(event),
            }}
          />
        ))}
        {visibleEvents.length === 0 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}
          >
            {t('dayRail.openTimeline')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function HomeDayRail({
  overview,
  loading,
  fetching,
  requestFailed,
  currentDate,
  updatedAt,
  headline,
  subheadline,
  backgroundUrl,
  backgroundPosition,
  overlayOpacity,
  onRetry,
  feedbackBusy = false,
  onRecommendationFeedback,
}: HomeDayRailProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const work = overview?.work.data;
  const calendar = overview?.calendar.data;
  const topWork = useMemo(() => nextWorkItem(work?.items), [work?.items]);
  const recommendation = overview?.recommendations[0];
  const workUnavailable = requestFailed || overview?.work.status === 'UNAVAILABLE';
  const workForbidden = overview?.work.status === 'FORBIDDEN';
  const calendarUnavailable = requestFailed || overview?.calendar.status === 'UNAVAILABLE';
  const calendarForbidden = overview?.calendar.status === 'FORBIDDEN';
  const audience = overview?.audience.profile ?? 'MEMBER';
  const backgroundAlignment = `${backgroundPosition.toLowerCase()} center`;
  const backgroundOverlay = Math.min(0.8, Math.max(0, overlayOpacity / 100));

  return (
    <Box
      component="section"
      aria-label={t('page.personalWorkspace')}
      data-testid="home-command-center"
      sx={{ bgcolor: '#F7F9FC', borderBottom: 1, borderColor: 'divider' }}
    >
      <Box
        sx={{
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
          bgcolor: '#07163D',
          backgroundImage: `url(${backgroundUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: backgroundAlignment,
          backgroundSize: 'cover',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: -2,
            bgcolor: `rgba(2, 10, 34, ${backgroundOverlay})`,
            pointerEvents: 'none',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            background:
              'linear-gradient(90deg, rgba(2,10,34,0.62) 0%, rgba(2,10,34,0.34) 58%, rgba(2,10,34,0.12) 100%)',
            pointerEvents: 'none',
          },
          '@media (forced-colors: active)': {
            bgcolor: 'Canvas',
            backgroundImage: 'none',
            '&::before, &::after': { display: 'none' },
          },
        }}
      >
        <Box
          sx={{
            width: 'calc(100% - 32px)',
            maxWidth: 1600,
            minHeight: { xs: 142, md: 156 },
            mx: 'auto',
            py: { xs: 2.5, md: 3 },
            display: 'flex',
            alignItems: 'center',
            color: 'common.white',
          }}
        >
          <Stack
            width={1}
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            gap={2}
          >
            <Box minWidth={0}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.78)' }}>
                  {currentDate}
                </Typography>
                <Chip
                  size="small"
                  icon={<ShieldCheck size={14} aria-hidden="true" />}
                  label={t(`dayRail.audience.${audience.toLowerCase()}`)}
                  sx={{
                    color: audienceTone[audience],
                    bgcolor: 'common.white',
                    border: 1,
                    borderColor: 'divider',
                    '& .MuiChip-icon': { color: 'inherit' },
                  }}
                />
              </Stack>
              <Typography component="h1" variant="h5" sx={{ mt: 0.5, color: 'common.white' }}>
                {headline}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.5, maxWidth: 760, color: 'rgba(255,255,255,0.82)' }}
              >
                {subheadline}
              </Typography>
            </Box>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.74)' }}>
                {t('page.updatedAt', { time: updatedAt })}
              </Typography>
              <ActionIconButton
                label={t('page.retry')}
                size="small"
                disabled={fetching}
                onClick={onRetry}
                sx={{
                  color: 'common.white',
                  bgcolor: 'rgba(2,10,34,0.28)',
                  '&:hover': { bgcolor: 'rgba(2,10,34,0.46)' },
                  ...(fetching
                    ? {
                        '& svg': { animation: 'dwp-home-refresh 900ms linear infinite' },
                        '@keyframes dwp-home-refresh': {
                          from: { transform: 'rotate(0deg)' },
                          to: { transform: 'rotate(360deg)' },
                        },
                        '@media (prefers-reduced-motion: reduce)': {
                          '& svg': { animation: 'none' },
                        },
                      }
                    : {}),
                }}
              >
                <RefreshCw size={16} />
              </ActionIconButton>
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ width: 'calc(100% - 32px)', maxWidth: 1600, mx: 'auto', py: { xs: 2, md: 2.5 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)' },
            bgcolor: 'common.white',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <BriefcaseBusiness size={17} color="#356AE6" aria-hidden="true" />
              <Typography variant="overline" color="text.secondary">
                {t('dayRail.now')}
              </Typography>
            </Stack>
            {loading ? (
              <LoadingState label={t('page.loadingPriorities')} variant="skeleton" size="compact" />
            ) : workUnavailable ? (
              <ErrorState
                title={t('page.priorityLoadError')}
                retryLabel={t('page.retry')}
                onRetry={onRetry}
                retrying={fetching}
                size="compact"
              />
            ) : workForbidden ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {t('dayRail.restricted')}
              </Typography>
            ) : topWork ? (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                  <Chip size="small" label={topWork.type} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`page.priority.${topWork.priority}`)}
                  />
                  {topWork.dueAt && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(topWork.dueAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Typography>
                  )}
                </Stack>
                <Typography component="h2" variant="h6" sx={{ mt: 0.75 }}>
                  {topWork.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  {topWork.reason ?? topWork.summary}
                </Typography>
                <ActionButton
                  intent="quiet"
                  endIcon={<ArrowRight size={16} aria-hidden="true" />}
                  onClick={() => navigate(`/work?item=${encodeURIComponent(topWork.id)}`)}
                  sx={{ mt: 1 }}
                >
                  {t('page.openPriority')}
                </ActionButton>
              </Box>
            ) : (
              <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.5 }}>
                <CheckCircle2 size={20} color="#0F8A78" aria-hidden="true" />
                <Box>
                  <Typography variant="subtitle2">{t('page.clearTitle')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('page.clearDescription')}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Box>

          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              borderTop: { xs: 1, lg: 0 },
              borderLeft: { lg: 1 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75}>
              <CalendarDays size={17} color="#0F8A78" aria-hidden="true" />
              <Typography variant="overline" color="text.secondary">
                {t('dayRail.next')}
              </Typography>
            </Stack>
            {loading ? (
              <LoadingState
                label={t('widgets.schedule.loading')}
                variant="skeleton"
                size="compact"
              />
            ) : calendarUnavailable ? (
              <ErrorState
                title={t('widgets.schedule.loadError')}
                retryLabel={t('page.retry')}
                onRetry={onRetry}
                retrying={fetching}
                size="compact"
              />
            ) : calendarForbidden ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {t('dayRail.restricted')}
              </Typography>
            ) : calendar?.nextEvent ? (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="primary.main">
                  {formatDate(calendar.nextEvent.startsAt, { hour: '2-digit', minute: '2-digit' })}
                </Typography>
                <Typography component="h2" variant="subtitle1" sx={{ mt: 0.35 }}>
                  {calendar.nextEvent.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {calendar.nextEvent.location || t('widgets.schedule.noLocation')}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {t('dayRail.noNextEvent')}
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              borderTop: { xs: 1, lg: 0 },
              borderLeft: { lg: 1 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75}>
              <Sparkles size={17} color="#A14B14" aria-hidden="true" />
              <Typography variant="overline" color="text.secondary">
                {t('dayRail.later')}
              </Typography>
            </Stack>
            {loading ? (
              <LoadingState label={t('widgets.brief.loading')} variant="skeleton" size="compact" />
            ) : recommendation ? (
              <Box sx={{ mt: 1 }}>
                <Typography component="h2" variant="subtitle1">
                  {recommendation.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  {recommendation.description}
                </Typography>
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 1 }}>
                  <ActionButton
                    intent="quiet"
                    endIcon={<ArrowRight size={16} aria-hidden="true" />}
                    onClick={() => navigate(recommendation.actionPath)}
                  >
                    {t('dayRail.review')}
                  </ActionButton>
                  {onRecommendationFeedback && (
                    <ActionIconButton
                      label={t('widgets.brief.notRelevant')}
                      size="small"
                      disabled={feedbackBusy}
                      onClick={() => onRecommendationFeedback(recommendation)}
                    >
                      <EyeOff size={16} />
                    </ActionIconButton>
                  )}
                </Stack>
              </Box>
            ) : (
              <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.5 }}>
                <Clock3 size={18} color="#64748B" aria-hidden="true" />
                <Typography variant="body2" color="text.secondary">
                  {t('dayRail.noRecommendation')}
                </Typography>
              </Stack>
            )}
          </Box>
        </Box>

        {!loading && !calendarUnavailable && !calendarForbidden && (
          <DayTimeline events={calendar?.today ?? []} />
        )}
      </Box>
    </Box>
  );
}
