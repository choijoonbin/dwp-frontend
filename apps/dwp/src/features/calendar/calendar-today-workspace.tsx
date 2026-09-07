import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Clock3, Focus } from 'lucide-react';
import { ActionButton, foundationTokens, GuidedEmptyState } from '@dwp-frontend/design-system';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { calendarDate, calendarTime } from './calendar-components';
import { CalendarHomeHero } from './calendar-home-hero';
import { CalendarHomeRhythm } from './calendar-home-rhythm';
import { CalendarHomeEventRow } from './calendar-home-event-row';
import { calendarHomeSurface, CALENDAR_HOME_ROW_RADIUS } from './calendar-home-surfaces';
import {
  calendarTodayMetrics,
  calendarTodayStream,
  calendarWorkdayPhase,
} from './calendar-today-model';
import { eventCapability } from './calendar-source-model';
import { CalendarWorkspaceRailSurface } from './calendar-workspace-overlays';

import type { CalendarEvent, CalendarHome } from '@dwp-frontend/shared-utils';
import type { CalendarReadSourceState } from './calendar-read-source-state';

const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;
const PAST_EVENT_PREVIEW_LIMIT = 3;

function minutesLabel(value: number, hour: string, minute: string) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes}${minute}`;
  if (!minutes) return `${hours}${hour}`;
  return `${hours}${hour} ${minutes}${minute}`;
}

function CalendarOpenWindow({
  startsAt,
  endsAt,
  durationMinutes,
  boundary,
  language,
  canCreate,
  onProtect,
}: {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  boundary: 'NEXT_EVENT' | 'WORKDAY_END';
  language: string;
  canCreate: boolean;
  onProtect: (startsAt: string, endsAt: string) => void;
}) {
  const { t } = useTranslation('calendar');
  return (
    <Box
      data-testid="calendar-today-open-window"
      sx={(theme) => ({
        minHeight: 68,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '70px minmax(0, 1fr) auto' },
        gap: { xs: 0.8, sm: 1.25 },
        alignItems: 'center',
        border: 1,
        borderRadius: CALENDAR_HOME_ROW_RADIUS,
        borderColor: alpha(theme.palette.success.main, 0.25),
        bgcolor: alpha(theme.palette.success.main, 0.055),
        '@media (forced-colors: active)': { bgcolor: 'Canvas', borderColor: 'CanvasText' },
      })}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {calendarTime(startsAt, language)}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 28,
            height: 28,
            flex: '0 0 28px',
            display: 'grid',
            placeItems: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: COMPACT_RADIUS,
            color: 'success.main',
          }}
        >
          <Focus size={15} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight="fontWeightBold">
            {t('home.openWindow', {
              duration: minutesLabel(durationMinutes, t('units.hour'), t('units.minute')),
            })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t(
              boundary === 'WORKDAY_END' ? 'home.openWindowWorkdayRange' : 'home.openWindowRange',
              {
                start: calendarTime(startsAt, language),
                end: calendarTime(endsAt, language),
              }
            )}
          </Typography>
        </Box>
      </Stack>
      {canCreate ? (
        <ActionButton intent="quiet" size="small" onClick={() => onProtect(startsAt, endsAt)}>
          {t('home.protectWindow')}
        </ActionButton>
      ) : null}
    </Box>
  );
}

function CalendarDayCloseout({
  elapsedCount,
  nextDateLabel,
  onOpenNextDate,
}: {
  elapsedCount: number;
  nextDateLabel: string | null;
  onOpenNextDate: () => void;
}) {
  const { t } = useTranslation('calendar');

  return (
    <Box
      component="section"
      role="status"
      aria-labelledby="calendar-day-closeout-title"
      data-testid="calendar-day-closeout"
      sx={(theme) => ({
        px: { xs: 1.5, sm: 2.5 },
        py: { xs: 1.5, sm: 1.75 },
        display: 'grid',
        gridTemplateColumns: { xs: 'auto minmax(0, 1fr)', sm: 'auto minmax(0, 1fr) auto' },
        alignItems: 'center',
        gap: { xs: 1.25, sm: 1.5 },
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.13 : 0.055),
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          borderColor: 'CanvasText',
        },
      })}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          borderRadius: COMPACT_RADIUS,
          color: 'success.main',
          bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
          '@media (forced-colors: active)': {
            color: 'CanvasText',
            bgcolor: 'Canvas',
            border: '1px solid CanvasText',
          },
        })}
      >
        <CheckCircle2 size={20} strokeWidth={1.8} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          id="calendar-day-closeout-title"
          component="h3"
          variant="subtitle1"
          fontWeight="fontWeightBold"
        >
          {t('home.dayCloseoutTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {t(elapsedCount ? 'home.dayCloseoutDescription' : 'home.dayCloseoutEmptyDescription', {
            count: elapsedCount,
          })}
        </Typography>
      </Box>
      <ActionButton
        intent="quiet"
        size="small"
        endIcon={<ArrowRight size={15} />}
        onClick={onOpenNextDate}
        sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, justifySelf: { xs: 'stretch', sm: 'end' } }}
      >
        {nextDateLabel
          ? t('home.openNextDate', { date: nextDateLabel })
          : t('actions.openCalendar')}
      </ActionButton>
    </Box>
  );
}

function CalendarTodayTimeline({
  data,
  currentTime,
  workingDayStart,
  workingDayEnd,
  language,
  canCreate,
  canRespond,
  onOpenEvent,
  onRespond,
  onProtect,
  onCreateFocus,
  onOpenSchedule,
  onOpenScheduleDate,
}: {
  data: CalendarHome;
  currentTime: string;
  workingDayStart?: string | null;
  workingDayEnd?: string | null;
  language: string;
  canCreate: boolean;
  canRespond: boolean;
  onOpenEvent: (event: CalendarEvent) => void;
  onRespond: (event: CalendarEvent, response: 'ACCEPTED' | 'DECLINED') => void;
  onProtect: (startsAt: string, endsAt: string) => void;
  onCreateFocus: () => void;
  onOpenSchedule: () => void;
  onOpenScheduleDate: (date: string) => void;
}) {
  const { t } = useTranslation('calendar');
  const stream = useMemo(
    () =>
      calendarTodayStream(data.today, currentTime, {
        date: data.date,
        timeZone: data.timeZone,
        workingDayStart,
        workingDayEnd,
      }),
    [currentTime, data.date, data.timeZone, data.today, workingDayEnd, workingDayStart]
  );
  const metrics = useMemo(
    () => calendarTodayMetrics(data.today, data.date, data.timeZone),
    [data.date, data.timeZone, data.today]
  );
  const activeItems = stream.filter(
    (item) => item.kind === 'open-window' || item.phase !== 'ELAPSED'
  );
  const pastItems = stream.filter(
    (item): item is Extract<typeof item, { kind: 'event' }> =>
      item.kind === 'event' && item.phase === 'ELAPSED'
  );
  const workdayPhase = calendarWorkdayPhase(currentTime, {
    date: data.date,
    timeZone: data.timeZone,
    workingDayStart,
    workingDayEnd,
  });
  const elapsedSchedule = activeItems.length === 0 && pastItems.length > 0;
  const showCloseout = elapsedSchedule || (activeItems.length === 0 && workdayPhase === 'AFTER');
  const canSuggestFocus = canCreate && workdayPhase === 'ACTIVE';
  const nextDate = data.nextEvent
    ? resolveZonedDateKey(data.nextEvent.startsAt, data.timeZone)
    : null;
  const nextDateLabel = data.nextEvent ? calendarDate(data.nextEvent.startsAt, language) : null;
  const [pastOpen, setPastOpen] = useState(elapsedSchedule);
  const [showAllPast, setShowAllPast] = useState(false);
  const hiddenPastCount = Math.max(0, pastItems.length - PAST_EVENT_PREVIEW_LIMIT);
  const visiblePastItems = showAllPast ? pastItems : pastItems.slice(-PAST_EVENT_PREVIEW_LIMIT);

  useEffect(() => {
    setPastOpen(elapsedSchedule);
  }, [elapsedSchedule]);

  useEffect(() => {
    setShowAllPast(false);
  }, [data.date]);

  return (
    <Box component="section" aria-labelledby="calendar-today-timeline-title">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5 }}
      >
        <Box>
          <Typography
            id="calendar-today-timeline-title"
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('home.todayAgenda')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('home.todaySummary', {
              count: metrics.eventCount,
              meetings: minutesLabel(metrics.meetingMinutes, t('units.hour'), t('units.minute')),
              focus: minutesLabel(metrics.focusMinutes, t('units.hour'), t('units.minute')),
            })}
          </Typography>
        </Box>
        {!showCloseout ? (
          <ActionButton
            intent="quiet"
            size="small"
            endIcon={<ArrowRight size={15} />}
            onClick={onOpenSchedule}
          >
            {t('actions.openCalendar')}
          </ActionButton>
        ) : null}
      </Stack>
      <Divider />
      {activeItems.length ? (
        <Stack
          direction="row"
          gap={1}
          alignItems="center"
          sx={{ px: 2.5, pt: 1.5, color: 'primary.main' }}
        >
          <Clock3 size={13} aria-hidden="true" />
          <Typography variant="caption" fontWeight="fontWeightBold">
            {t('flow.now', { time: calendarTime(currentTime, language) })}
          </Typography>
          <Box
            aria-hidden="true"
            sx={{ flex: 1, borderTop: 1, borderColor: 'primary.main', opacity: 0.3 }}
          />
        </Stack>
      ) : null}
      {activeItems.length ? (
        <Box
          component="ol"
          sx={{ p: { xs: 1.5, sm: 2.5 }, m: 0, listStyle: 'none', display: 'grid', gap: 1.25 }}
        >
          {activeItems.map((item, index) =>
            item.kind === 'open-window' ? (
              <Box component="li" key={`open-${item.startsAt}-${item.endsAt}`}>
                <CalendarOpenWindow
                  {...item}
                  language={language}
                  canCreate={canCreate}
                  onProtect={onProtect}
                />
              </Box>
            ) : (
              <Box
                component="li"
                key={`${item.event.eventId}-${item.event.startsAt}-${index}`}
                data-calendar-today-phase={item.phase}
              >
                <CalendarHomeEventRow
                  event={item.event}
                  current={item.phase === 'CURRENT'}
                  language={language}
                  onOpen={() => onOpenEvent(item.event)}
                  onRespond={
                    canRespond && eventCapability(item.event, 'canRespond')
                      ? (response) => onRespond(item.event, response)
                      : undefined
                  }
                />
              </Box>
            )
          )}
        </Box>
      ) : showCloseout ? (
        <CalendarDayCloseout
          elapsedCount={pastItems.length}
          nextDateLabel={nextDateLabel}
          onOpenNextDate={() => (nextDate ? onOpenScheduleDate(nextDate) : onOpenSchedule())}
        />
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('home.emptyToday')}
          description={t('home.emptyTodayDescription')}
          actionLabel={t(canSuggestFocus ? 'actions.addFocus' : 'actions.openCalendar')}
          onAction={canSuggestFocus ? onCreateFocus : onOpenSchedule}
          secondaryActionLabel={canSuggestFocus ? t('actions.openCalendar') : undefined}
          onSecondaryAction={canSuggestFocus ? onOpenSchedule : undefined}
          size="compact"
          announce={false}
        />
      )}
      {pastItems.length ? (
        <Box
          component="details"
          data-testid="calendar-today-past-events"
          open={pastOpen}
          onToggle={(event) => setPastOpen((event.currentTarget as HTMLDetailsElement).open)}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        >
          <Box
            component="summary"
            sx={{
              px: { xs: 2, sm: 2.5 },
              py: 1.25,
              color: 'text.secondary',
              cursor: 'pointer',
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
              '@media (forced-colors: active)': {
                '&:focus-visible': { outlineColor: 'Highlight' },
              },
            }}
          >
            <Typography component="span" variant="caption" fontWeight="fontWeightBold">
              {t(elapsedSchedule ? 'home.elapsedEvents' : 'home.pastEvents', {
                count: pastItems.length,
              })}
            </Typography>
          </Box>
          <Box
            id="calendar-today-past-event-list"
            component="ol"
            sx={{ p: { xs: 1.5, sm: 2.5 }, m: 0, listStyle: 'none', display: 'grid', gap: 1.25 }}
          >
            {visiblePastItems.map((item, index) => (
              <Box
                component="li"
                key={`${item.event.eventId}-${item.event.startsAt}-past-${index}`}
                data-calendar-today-phase="ELAPSED"
              >
                <CalendarHomeEventRow
                  event={item.event}
                  current={false}
                  language={language}
                  onOpen={() => onOpenEvent(item.event)}
                  onRespond={
                    canRespond && eventCapability(item.event, 'canRespond')
                      ? (response) => onRespond(item.event, response)
                      : undefined
                  }
                />
              </Box>
            ))}
          </Box>
          {hiddenPastCount ? (
            <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: 1, borderColor: 'divider' }}>
              <ActionButton
                intent="quiet"
                size="small"
                aria-controls="calendar-today-past-event-list"
                aria-expanded={showAllPast}
                onClick={() => setShowAllPast((current) => !current)}
              >
                {t(showAllPast ? 'home.showRecentPastEvents' : 'home.showMorePastEvents', {
                  count: hiddenPastCount,
                })}
              </ActionButton>
            </Box>
          ) : null}
        </Box>
      ) : null}
      <Typography
        component="p"
        variant="caption"
        color="text.secondary"
        textAlign="right"
        sx={{ px: 2, py: 1.25 }}
      >
        {t('home.updatedAt', { time: calendarTime(data.generatedAt, language) })}
      </Typography>
    </Box>
  );
}

export function CalendarTodayWorkspace({
  data,
  currentTime,
  workingDayStart,
  workingDayEnd,
  railState,
  railFetching,
  language,
  currentSearch,
  roomsPath,
  railVisible,
  canCreate,
  canRespond,
  onRetryRail,
  onOpenEvent,
  onRespond,
  onProtect,
  onCreateFocus,
  onOpenSchedule,
  onOpenScheduleDate,
  onOpenInsights,
  onOpenCommands,
}: {
  data: CalendarHome;
  currentTime: string;
  workingDayStart?: string | null;
  workingDayEnd?: string | null;
  railState: CalendarReadSourceState;
  railFetching: boolean;
  language: string;
  currentSearch: string;
  roomsPath: string | null;
  railVisible: boolean;
  canCreate: boolean;
  canRespond: boolean;
  onRetryRail: () => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onRespond: (event: CalendarEvent, response: 'ACCEPTED' | 'DECLINED') => void;
  onProtect: (startsAt: string, endsAt: string) => void;
  onCreateFocus: () => void;
  onOpenSchedule: () => void;
  onOpenScheduleDate: (date: string) => void;
  onOpenInsights: () => void;
  onOpenCommands: () => void;
}) {
  const { t } = useTranslation('calendar');
  return (
    <Box data-testid="calendar-today-workspace" sx={{ minWidth: 0 }}>
      <CalendarHomeHero
        data={data}
        currentTime={currentTime}
        language={language}
        writable={railState === 'READY'}
        onOpen={onOpenEvent}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: railVisible ? 'minmax(0, 1fr) 304px' : 'minmax(0, 1fr)',
          alignItems: 'start',
          gap: railVisible ? 2.5 : 0,
          minWidth: 0,
        }}
      >
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <Box data-testid="calendar-today-flow-surface" sx={calendarHomeSurface}>
            <CalendarTodayTimeline
              data={data}
              currentTime={currentTime}
              workingDayStart={workingDayStart}
              workingDayEnd={workingDayEnd}
              language={language}
              canCreate={canCreate}
              canRespond={canRespond}
              onOpenEvent={onOpenEvent}
              onRespond={onRespond}
              onProtect={onProtect}
              onCreateFocus={onCreateFocus}
              onOpenSchedule={onOpenSchedule}
              onOpenScheduleDate={onOpenScheduleDate}
            />
          </Box>
          <CalendarHomeRhythm
            data={data}
            language={language}
            onOpenInsights={onOpenInsights}
            onOpenDate={onOpenScheduleDate}
          />
        </Stack>
        <CalendarWorkspaceRailSurface
          expanded
          visible={railVisible}
          label={t('workspace.railTitle')}
          data={data}
          state={railState}
          isFetching={railFetching}
          language={language}
          currentSearch={currentSearch}
          roomsPath={roomsPath}
          canCreate={canCreate}
          onCreateFocus={onCreateFocus}
          onOpenCommands={onOpenCommands}
          onRetry={onRetryRail}
        />
      </Box>
    </Box>
  );
}
