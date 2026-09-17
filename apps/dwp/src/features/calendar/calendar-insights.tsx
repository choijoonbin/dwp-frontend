import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Clock3,
  Focus,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import {
  getCalendarInsights,
  usePermissions,
  type CalendarInsightPeriod,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LiveStatus,
  OperationalContextBar,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarPageHeading, calendarDate, calendarTime } from './calendar-components';
import {
  CalendarCanvas,
  CalendarRecommendationRow,
  CalendarSectionHeader,
} from './calendar-experience';
import {
  calendarReadSourceData,
  calendarReadSourceState,
  retryRecoverableCalendarRead,
} from './calendar-read-source-state';

const PERIODS: CalendarInsightPeriod[] = [4, 8, 12];

function hours(value: number) {
  return (value / 60).toFixed(value % 60 === 0 ? 0 : 1);
}

function comparison(current: number, previous: number) {
  if (current === previous) return { direction: 'same' as const, value: 0 };
  return {
    direction: current > previous ? ('more' as const) : ('less' as const),
    value: Math.abs(current - previous),
  };
}

function InsightMetric({
  label,
  value,
  detail,
  emphasized = false,
}: {
  label: string;
  value: string;
  detail: string;
  emphasized?: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        minWidth: 0,
        p: { xs: 1.75, sm: 2 },
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: emphasized
          ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.1 : 0.04)
          : 'transparent',
        '@media (forced-colors: active)': { backgroundColor: 'Canvas' },
      })}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography
        component="p"
        sx={{ mt: 0.4, fontSize: { xs: '1.35rem', sm: '1.55rem' }, fontWeight: 750 }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.45 }}>
        {detail}
      </Typography>
    </Box>
  );
}

function metricComparison(
  current: number,
  previous: number,
  unit: string,
  t: (key: string, values?: Record<string, unknown>) => string
) {
  const delta = comparison(current, previous);
  if (delta.direction === 'same') return t('insights.comparison.same');
  return t(`insights.comparison.${delta.direction}`, {
    value: delta.value,
    unit,
  });
}

export function CalendarInsights() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<CalendarInsightPeriod>(4);
  const [focusDialog, setFocusDialog] = useState(false);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const timeZone = resolveSystemTimeZone('Asia/Seoul');
  const query = useQuery({
    queryKey: ['calendar', 'insights', period, timeZone],
    queryFn: ({ signal }) => getCalendarInsights(period, timeZone, signal),
    staleTime: 60_000,
    retry: retryRecoverableCalendarRead,
  });
  const sourceState = calendarReadSourceState({
    data: query.data,
    error: query.error,
    failureCount: query.failureCount,
    failureReason: query.failureReason,
    isError: query.isError,
    isPending: query.isPending,
  });
  const data = calendarReadSourceData(sourceState, query.data);
  const canCreate = hasPermission('APP.CALENDAR', 'CREATE') && sourceState === 'READY';
  const derived = useMemo(() => {
    if (!data) return null;
    return {
      maximum: Math.max(
        1,
        ...data.trend.map(
          (week) =>
            week.metrics.meetingMinutes +
            week.metrics.protectedFocusMinutes +
            week.metrics.afterHoursMinutes
        )
      ),
      empty: data.current.eventCount === 0,
    };
  }, [data]);

  const periodSelector = (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={period}
      aria-label={t('insights.period.label')}
      onChange={(_, value: CalendarInsightPeriod | null) => {
        if (value) setPeriod(value);
      }}
      sx={{ flexWrap: 'wrap' }}
    >
      {PERIODS.map((weeks) => (
        <ToggleButton key={weeks} value={weeks} aria-label={t('insights.period.option', { weeks })}>
          {t('insights.period.short', { weeks })}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  return (
    <CalendarCanvas archetype="coach">
      <CalendarPageHeading
        icon={BarChart3}
        eyebrow={t('insights.eyebrow')}
        title={t('insights.title')}
        description={t('insights.description')}
        actions={
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ width: { xs: 1, sm: 'auto' } }}
          >
            {periodSelector}
            {canCreate && (
              <ActionButton
                intent="primary"
                startIcon={<CalendarPlus size={17} />}
                onClick={() => setFocusDialog(true)}
              >
                {t('insights.protectFocus')}
              </ActionButton>
            )}
          </Stack>
        }
      />

      {(sourceState === 'STALE' || sourceState === 'DENIED') && (
        <Box data-testid="calendar-insights-read-state" sx={{ mb: 2 }}>
          <OperationalContextBar
            label={t('insights.title')}
            items={[]}
            status={
              <LiveStatus
                state={sourceState === 'STALE' ? 'stale' : 'degraded'}
                label={t('insights.title')}
                detail={t(sourceState === 'STALE' ? 'readState.stale' : 'readState.denied')}
              />
            }
            actions={
              <ActionButton intent="quiet" onClick={() => void query.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
          />
        </Box>
      )}

      {(sourceState === 'DENIED' || sourceState === 'UNAVAILABLE') && !data ? (
        <ErrorState
          title={
            sourceState === 'DENIED'
              ? t('insights.authorityError')
              : t('insights.loadError')
          }
          description={t(
            sourceState === 'DENIED' ? 'readState.denied' : 'readState.unavailable'
          )}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : sourceState === 'LOADING' || !data || !derived ? (
        <Stack spacing={2} aria-label={t('insights.loading')}>
          <Skeleton variant="rounded" height={190} />
          <Skeleton variant="rounded" height={360} />
        </Stack>
      ) : derived.empty ? (
        <Box
          sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          <GuidedEmptyState
            kind="first-use"
            title={t('insights.empty.title', { weeks: period })}
            description={t('insights.empty.description')}
            actionLabel={canCreate ? t('insights.protectFocus') : undefined}
            onAction={canCreate ? () => setFocusDialog(true) : undefined}
            secondaryActionLabel={canCreate ? t('actions.openCalendar') : undefined}
            onSecondaryAction={canCreate ? () => navigate('/calendar/schedule') : undefined}
          />
        </Box>
      ) : (
        <Stack spacing={2.5} data-testid="calendar-insights-content">
          <Box
            component="section"
            aria-labelledby="calendar-insights-overview-title"
            sx={(theme) => ({
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              backgroundImage: `linear-gradient(120deg, ${alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.12 : 0.045
              )}, transparent 48%)`,
              '@media (forced-colors: active)': { backgroundImage: 'none' },
            })}
          >
            <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                gap={2}
              >
                <Box>
                  <Typography variant="overline" color="primary.main" fontWeight={800}>
                    {t('insights.period.caption', { weeks: data.weeks })}
                  </Typography>
                  <Typography id="calendar-insights-overview-title" variant="h5" fontWeight={750}>
                    {t('insights.overview.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                    {t('insights.period.range', {
                      start: calendarDate(data.periodStart, language),
                      end: calendarDate(data.periodEnd, language),
                    })}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShieldCheck size={18} color="currentColor" aria-hidden="true" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('insights.overview.focusQuality')}
                    </Typography>
                    <Typography fontWeight={800} fontSize="1.5rem" lineHeight={1.15}>
                      {data.current.focusQualityPercent}%
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                },
                '& > * + *': { borderLeft: { lg: 1 }, borderColor: { lg: 'divider' } },
              }}
            >
              <InsightMetric
                label={t('insights.metrics.meetingTime')}
                value={`${hours(data.current.meetingMinutes)}${t('units.hour')}`}
                detail={metricComparison(
                  data.current.meetingMinutes,
                  data.previous.meetingMinutes,
                  t('units.minute'),
                  t
                )}
              />
              <InsightMetric
                emphasized
                label={t('insights.metrics.protectedFocus')}
                value={`${hours(data.current.protectedFocusMinutes)}${t('units.hour')}`}
                detail={metricComparison(
                  data.current.focusMinutes,
                  data.previous.focusMinutes,
                  t('units.minute'),
                  t
                )}
              />
              <InsightMetric
                label={t('insights.metrics.noMeetingDays')}
                value={String(data.current.noMeetingDays)}
                detail={metricComparison(
                  data.current.noMeetingDays,
                  data.previous.noMeetingDays,
                  t('units.day'),
                  t
                )}
              />
              <InsightMetric
                label={t('insights.metrics.afterHours')}
                value={`${hours(data.current.afterHoursMinutes)}${t('units.hour')}`}
                detail={metricComparison(
                  data.current.afterHoursMinutes,
                  data.previous.afterHoursMinutes,
                  t('units.minute'),
                  t
                )}
              />
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(300px, 0.8fr)' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box
              component="section"
              sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <CalendarSectionHeader
                icon={BarChart3}
                title={t('insights.trend.title')}
                description={t('insights.trend.description', { weeks: data.weeks })}
              />
              <Divider />
              <Stack
                component="ul"
                spacing={1.5}
                sx={{
                  listStyle: 'none',
                  m: 0,
                  p: { xs: 2, sm: 2.5 },
                  pr: { sm: 8 },
                }}
              >
                {data.trend.map((week) => {
                  const meetingWidth = (week.metrics.meetingMinutes * 100) / derived.maximum;
                  const focusWidth = (week.metrics.protectedFocusMinutes * 100) / derived.maximum;
                  const afterHoursWidth = (week.metrics.afterHoursMinutes * 100) / derived.maximum;
                  return (
                    <Box component="li" key={week.weekStart}>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="caption" fontWeight={700}>
                          {calendarDate(week.weekStart, language)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('insights.trend.weekSummary', {
                            meeting: week.metrics.meetingMinutes,
                            focus: week.metrics.protectedFocusMinutes,
                          })}
                        </Typography>
                      </Stack>
                      <Box
                        role="img"
                        aria-label={t('insights.trend.accessibleWeek', {
                          date: calendarDate(week.weekStart, language),
                          meeting: week.metrics.meetingMinutes,
                          focus: week.metrics.protectedFocusMinutes,
                          afterHours: week.metrics.afterHoursMinutes,
                        })}
                        sx={{
                          display: 'flex',
                          height: 9,
                          mt: 0.75,
                          overflow: 'hidden',
                          borderRadius: 999,
                          bgcolor: 'action.hover',
                          '@media (forced-colors: active)': { border: '1px solid CanvasText' },
                        }}
                      >
                        <Box
                          sx={{
                            width: `${meetingWidth}%`,
                            bgcolor: 'primary.main',
                            '@media (forced-colors: active)': {
                              forcedColorAdjust: 'none',
                              backgroundColor: 'Highlight',
                            },
                          }}
                        />
                        <Box
                          sx={{
                            width: `${focusWidth}%`,
                            bgcolor: 'success.main',
                            '@media (forced-colors: active)': {
                              forcedColorAdjust: 'none',
                              backgroundColor: 'CanvasText',
                            },
                          }}
                        />
                        <Box
                          sx={{
                            width: `${afterHoursWidth}%`,
                            bgcolor: 'warning.main',
                            '@media (forced-colors: active)': {
                              forcedColorAdjust: 'none',
                              backgroundColor: 'GrayText',
                            },
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
              <Divider />
              <Stack
                direction="row"
                useFlexGap
                flexWrap="wrap"
                spacing={2}
                sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5 }}
              >
                {(['meeting', 'focus', 'afterHours'] as const).map((key) => (
                  <Stack key={key} direction="row" spacing={0.75} alignItems="center">
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        bgcolor:
                          key === 'meeting'
                            ? 'primary.main'
                            : key === 'focus'
                              ? 'success.main'
                              : 'warning.main',
                        '@media (forced-colors: active)': {
                          forcedColorAdjust: 'none',
                          backgroundColor:
                            key === 'meeting'
                              ? 'Highlight'
                              : key === 'focus'
                                ? 'CanvasText'
                                : 'GrayText',
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t(`insights.trend.legend.${key}`)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Box
              component="section"
              sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <CalendarSectionHeader
                icon={ListChecks}
                title={t('insights.recommendations')}
                description={t('insights.recommendationsDescription')}
              />
              <Divider />
              <Stack divider={<Divider flexItem />}>
                <CalendarRecommendationRow
                  icon={Focus}
                  label={t('insights.focusLabel')}
                  tone={data.current.focusQualityPercent >= 75 ? 'success' : 'warning'}
                  title={
                    data.current.focusQualityPercent >= 75
                      ? t('insights.recommendation.focusProtected')
                      : t('insights.recommendation.focusAtRisk', {
                          value: data.current.focusQualityPercent,
                        })
                  }
                  description={t('insights.recommendation.focusEvidence', {
                    protected: data.current.protectedFocusMinutes,
                    total: data.current.focusMinutes,
                  })}
                  onClick={canCreate ? () => setFocusDialog(true) : undefined}
                  actionLabel={canCreate ? t('insights.protectFocus') : undefined}
                />
                <CalendarRecommendationRow
                  icon={Clock3}
                  label={t('insights.recommendation.boundaryLabel')}
                  tone={data.current.afterHoursMinutes > 0 ? 'warning' : 'success'}
                  title={
                    data.current.afterHoursMinutes > 0
                      ? t('insights.recommendation.afterHours', {
                          value: data.current.afterHoursMinutes,
                        })
                      : t('insights.recommendation.boundaryHealthy')
                  }
                  description={t('insights.recommendation.boundaryEvidence', {
                    start: data.workingDayStart.slice(0, 5),
                    end: data.workingDayEnd.slice(0, 5),
                  })}
                  onClick={() => navigate('/calendar/schedule')}
                  actionLabel={t('actions.openCalendar')}
                />
                <CalendarRecommendationRow
                  icon={AlertTriangle}
                  label={t('insights.recommendation.fragmentationLabel')}
                  tone={
                    data.current.fragmentedDays > 0 || data.current.conflictCount > 0
                      ? 'error'
                      : 'info'
                  }
                  title={t('insights.recommendation.fragmentation', {
                    days: data.current.fragmentedDays,
                    conflicts: data.current.conflictCount,
                  })}
                  description={t('insights.recommendation.fragmentationEvidence')}
                  onClick={() => navigate('/calendar/invitations')}
                  actionLabel={t('actions.details')}
                />
              </Stack>
            </Box>
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            color="text.secondary"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarDays size={15} aria-hidden="true" />
              <Typography variant="caption">{t('insights.privateHint')}</Typography>
            </Stack>
            <Typography variant="caption">
              {sourceState === 'STALE'
                ? t('insights.lastVerifiedAt', {
                    time: calendarTime(data.generatedAt, language),
                  })
                : t('insights.updatedAt', {
                    time: calendarTime(data.generatedAt, language),
                  })}
            </Typography>
          </Stack>
        </Stack>
      )}

      {canCreate && (
        <CalendarEventDialog
          open={focusDialog}
          initialType="FOCUS"
          onClose={() => setFocusDialog(false)}
        />
      )}
    </CalendarCanvas>
  );
}
