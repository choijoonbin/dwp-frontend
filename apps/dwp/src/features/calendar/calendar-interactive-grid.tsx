import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import listPlugin from '@fullcalendar/react/list';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import formaThemePlugin from '@fullcalendar/react/themes/forma';
import koLocale from '@fullcalendar/react/locales/ko';
import { LockKeyhole, MapPin, TriangleAlert } from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/forma/theme.css';
import '@fullcalendar/react/themes/forma/palettes/blue.css';

import { CALENDAR_EVENT_TONES, calendarDate, calendarTime } from './calendar-components';
import {
  calendarScheduleDateValue,
  fullCalendarView,
  scheduleViewFromFullCalendar,
  type CalendarScheduleView,
} from './calendar-schedule-state';

import type {
  CalendarRef,
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDropInfo,
  EventInput,
  EventResizeDoneInfo,
} from '@fullcalendar/react';
import type { CalendarEvent } from '@dwp-frontend/shared-utils';
import type { Theme } from '@mui/material/styles';

export type CalendarRange = Readonly<{ from: string; to: string }>;

type CalendarInteractiveGridProps = {
  events: readonly CalendarEvent[];
  language: string;
  compact: boolean;
  mobile: boolean;
  loading: boolean;
  view: CalendarScheduleView;
  navigateDate?: Date;
  weekStart: number;
  workingDayStart: string;
  workingDayEnd: string;
  canCreate: boolean;
  interactionLocked: boolean;
  canMove: (event: CalendarEvent) => boolean;
  onRangeChange: (range: CalendarRange) => void;
  onCalendarStateChange: (view: CalendarScheduleView, date: Date) => void;
  onCreateRange: (start: Date, end: Date, allDay: boolean) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onMoveEvent: (
    event: CalendarEvent,
    change: Readonly<{ startsAt: string; endsAt: string; allDay: boolean }>,
    revert: () => void
  ) => void;
};

function sourceEvent(info: EventClickInfo | EventDropInfo | EventResizeDoneInfo) {
  return info.event.extendedProps.source as CalendarEvent;
}

function eventInputs(
  events: readonly CalendarEvent[],
  canMove: (event: CalendarEvent) => boolean
): EventInput[] {
  return events.map((event) => {
    const tone = CALENDAR_EVENT_TONES[event.type];
    const editable = canMove(event);
    return {
      id: `${event.eventId}:${event.startsAt}`,
      groupId: event.eventId,
      title: event.title,
      start: event.startsAt,
      end: event.endsAt,
      allDay: event.allDay,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: 'inherit',
      editable,
      startEditable: editable,
      durationEditable: editable,
      extendedProps: { source: event, tone: tone.main, editable },
    };
  });
}

function eventSurfaceColor(theme: Theme, event: CalendarEvent) {
  const color = {
    MEETING: theme.palette.primary.main,
    FOCUS: theme.palette.success.main,
    TASK: theme.palette.warning.main,
    OUT_OF_OFFICE: theme.palette.secondary.main,
    REMINDER: theme.palette.info.main,
  }[event.type];
  return alpha(color, theme.palette.mode === 'dark' ? 0.24 : 0.1);
}

function mutationRange(info: EventDropInfo | EventResizeDoneInfo) {
  const source = sourceEvent(info);
  const startsAt = info.event.start?.toISOString() ?? source.startsAt;
  const fallbackDuration = Date.parse(source.endsAt) - Date.parse(source.startsAt);
  const endsAt =
    info.event.end?.toISOString() ??
    new Date(Date.parse(startsAt) + fallbackDuration).toISOString();
  return { startsAt, endsAt, allDay: info.event.allDay };
}

export function CalendarInteractiveGrid({
  events,
  language,
  compact,
  mobile,
  loading,
  view,
  navigateDate,
  weekStart,
  workingDayStart,
  workingDayEnd,
  canCreate,
  interactionLocked,
  canMove,
  onRangeChange,
  onCalendarStateChange,
  onCreateRange,
  onOpenEvent,
  onMoveEvent,
}: CalendarInteractiveGridProps) {
  const { t } = useTranslation('calendar');
  const calendarRef = useRef<CalendarRef>(null);
  const applyingViewRef = useRef<string | null>(null);
  const applyingDateRef = useRef<string | null>(null);
  const eventKeyboardHandlersRef = useRef(
    new WeakMap<HTMLElement, (event: KeyboardEvent) => void>()
  );
  const [activeView, setActiveView] = useState<CalendarScheduleView>(view);
  const inputs = useMemo(() => eventInputs(events, canMove), [canMove, events]);

  useEffect(() => {
    const calendar = calendarRef.current?.getApi();
    if (!calendar || !navigateDate) return;
    const nextDate = calendarScheduleDateValue(navigateDate);
    if (calendarScheduleDateValue(calendar.getDate()) === nextDate) return;
    applyingDateRef.current = nextDate;
    calendar.gotoDate(navigateDate);
  }, [navigateDate]);

  useEffect(() => {
    const calendar = calendarRef.current?.getApi();
    const nextView = fullCalendarView(view);
    if (calendar && calendar.view.type !== nextView) {
      applyingViewRef.current = nextView;
      calendar.changeView(nextView);
    }
  }, [activeView, view]);

  const select = (selection: DateSelectInfo) => {
    if (selection.allDay) {
      const start = new Date(selection.start);
      start.setHours(9, 0, 0, 0);
      onCreateRange(start, new Date(start.getTime() + 30 * 60_000), false);
    } else {
      onCreateRange(selection.start, selection.end, false);
    }
    calendarRef.current?.getApi().unselect();
  };

  const move = (info: EventDropInfo | EventResizeDoneInfo) => {
    onMoveEvent(sourceEvent(info), mutationRange(info), info.revert);
  };

  const accessibleEventLabel = (event: CalendarEvent, editable: boolean) => {
    const state = [
      event.recurrence !== 'NONE' ? t('schedule.recurringEvent') : '',
      event.conflict ? t('event.conflict') : '',
      event.myResponse ? t(`event.responses.${event.myResponse}`) : '',
      editable ? t('schedule.editableEvent') : t('schedule.readOnlyEvent'),
    ]
      .filter(Boolean)
      .join(', ');
    return t('schedule.eventAccessibleLabel', {
      date: calendarDate(event.startsAt, language),
      start: calendarTime(event.startsAt, language),
      end: calendarTime(event.endsAt, language),
      title: event.title,
      calendar: event.calendarName,
      type: t(`event.types.${event.type}`),
      state,
    });
  };

  return (
    <Box
      data-testid="interactive-calendar"
      data-controlled-view={view}
      data-active-view={activeView}
      data-calendar-interaction-locked={interactionLocked}
      aria-busy={loading || interactionLocked}
      sx={(theme) => ({
        minWidth: 0,
        '--precision-calendar-primary': foundationTokens.color.product.primary,
        '--fc-border-color': alpha(theme.palette.divider, 0.72),
        '--fc-page-bg-color': theme.palette.background.paper,
        '--fc-neutral-bg-color': theme.palette.action.hover,
        '--fc-today-bg-color': alpha(
          theme.palette.primary.main,
          theme.palette.mode === 'dark' ? 0.18 : 0.06
        ),
        '--fc-now-indicator-color': 'var(--precision-calendar-primary)',
        '& .fc': { color: theme.palette.text.primary, fontFamily: theme.typography.fontFamily },
        '& .fc-header-toolbar': {
          gap: 1,
          px: { xs: 1.25, md: 2 },
          py: { xs: 1.25, md: 1.5 },
          mb: '0 !important',
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: alpha(theme.palette.divider, 0.72),
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.025),
        },
        '& .fc-toolbar-title': {
          fontSize: { xs: '1rem', md: '1.125rem' },
          fontWeight: 600,
          letterSpacing: 0,
        },
        '& .fc-button': {
          minHeight: 34,
          border: '0 !important',
          borderRadius: `${theme.shape.borderRadius}px !important`,
          boxShadow: 'none !important',
          bgcolor: 'transparent !important',
          color: `${theme.palette.text.secondary} !important`,
          fontWeight: 700,
        },
        '& .fc-button:hover': {
          bgcolor: `${theme.palette.action.hover} !important`,
          color: `${theme.palette.text.primary} !important`,
        },
        '& .fc-button-active': {
          bgcolor: `${alpha(theme.palette.primary.main, 0.12)} !important`,
          color: `${theme.palette.primary.main} !important`,
        },
        '& .fc-col-header-cell': {
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.018),
        },
        '& .fc-col-header-cell-cushion': {
          py: 1.35,
          fontWeight: 720,
          color: 'text.secondary',
        },
        '& .fc-timegrid-axis, & .fc-timegrid-slot-label, & .precision-calendar-slot-header': {
          width: '3.5rem',
          minWidth: '3.5rem',
          maxWidth: '3.5rem',
        },
        '& .fc-timegrid-slot, & .precision-calendar-slot': {
          height: '2rem',
          minHeight: '2rem',
        },
        '& .fc-timegrid-slot-label-cushion, & .precision-calendar-slot-header': {
          color: 'text.secondary',
          fontSize: '0.6875rem',
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" 1',
          letterSpacing: '0.04em',
        },
        '& .fc-timegrid-now-indicator-line, & .precision-calendar-now-line': {
          borderTop: '1.5px solid var(--precision-calendar-primary)',
        },
        '& .fc-timegrid-now-indicator-arrow, & .precision-calendar-now-dot': {
          width: 8,
          height: 8,
          marginTop: '-4px',
          border: 0,
          borderRadius: '50%',
          bgcolor: 'var(--precision-calendar-primary)',
        },
        '& .fc-event, & .precision-calendar-event': {
          borderRadius: '6px',
          bgcolor: 'transparent !important',
          boxShadow: theme.shadows[1],
          cursor: 'pointer',
          transition: theme.transitions.create(['filter', 'transform', 'box-shadow'], {
            duration: theme.transitions.duration.shorter,
          }),
        },
        '& .fc-timegrid-event:hover, & .fc-daygrid-event:hover, & .fc-event-dragging, & .fc-event-resizing, & .precision-calendar-event-block:hover, & .precision-calendar-event-active':
          {
            filter: 'saturate(1.08)',
            transform: 'scale(1.02)',
            boxShadow: theme.shadows[6],
            zIndex: 5,
          },
        '& .fc-timegrid-event .fc-event-resizer': { opacity: 0 },
        '& .fc-timegrid-event:hover .fc-event-resizer, & .fc-timegrid-event:focus-within .fc-event-resizer':
          {
            opacity: 0.72,
          },
        '& .fc-event:focus': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 1,
        },
        '& .fc-event-main': { color: 'inherit', p: 0 },
        '& .fc-list-event:hover td': { bgcolor: 'action.hover' },
        '& .fc-daygrid-day-number': { color: 'text.primary', p: 1, fontWeight: 650 },
        '& .fc-day-today .fc-daygrid-day-number': {
          minWidth: 24,
          width: 24,
          height: 24,
          display: 'grid',
          placeItems: 'center',
          m: 0.5,
          p: 0,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        },
        '& .fc-popover': {
          borderRadius: `${theme.shape.borderRadius}px`,
          border: 1,
          borderColor: 'divider',
          boxShadow: 'none',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .fc-event, & .precision-calendar-event': { transition: 'none !important' },
          '& .fc-timegrid-event:hover, & .fc-daygrid-event:hover, & .fc-event-dragging, & .fc-event-resizing, & .precision-calendar-event-block:hover, & .precision-calendar-event-active':
            {
              transform: 'none',
            },
        },
        '@media (forced-colors: active)': {
          '& .fc-event, & .precision-calendar-event': {
            forcedColorAdjust: 'auto',
            border: '1px solid CanvasText !important',
            boxShadow: 'none',
          },
          '& .fc-timegrid-now-indicator-line, & .precision-calendar-now-line': {
            borderColor: 'Highlight',
          },
          '& .fc-timegrid-now-indicator-arrow, & .precision-calendar-now-dot': {
            backgroundColor: 'Highlight',
          },
          '& .fc-event:focus': { outlineColor: 'Highlight' },
          '& [data-calendar-event-conflict="true"]': {
            outline: '2px double CanvasText',
          },
          '& .fc-day-today .fc-daygrid-day-number': {
            border: '1px solid CanvasText',
          },
        },
      })}
    >
      <FullCalendar
        ref={calendarRef}
        plugins={[formaThemePlugin, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={language.startsWith('ko') ? koLocale : 'en'}
        initialView={fullCalendarView(view)}
        views={{
          timeGridThreeDay: {
            type: 'timeGrid',
            duration: { days: 3 },
          },
          timeGridFourDay: {
            type: 'timeGrid',
            duration: { days: 4 },
          },
        }}
        buttons={{
          timeGridDay: { text: t('schedule.views.day') },
          timeGridThreeDay: { text: t('schedule.views.threeDay') },
          timeGridFourDay: { text: t('schedule.views.fourDay') },
          timeGridWeek: { text: t('schedule.views.week') },
          dayGridMonth: { text: t('schedule.views.month') },
          listMonth: { text: t('schedule.views.agenda') },
        }}
        firstDay={weekStart}
        headerToolbar={
          mobile
            ? { start: 'prev,next today', center: 'title', end: 'timeGridDay,listMonth' }
            : compact
              ? {
                  start: 'prev,next today',
                  center: 'title',
                  end: 'timeGridThreeDay,timeGridFourDay,timeGridWeek,listMonth',
                }
              : {
                  start: 'prev,next today',
                  center: 'title',
                  end: 'timeGridDay,timeGridThreeDay,timeGridFourDay,timeGridWeek,dayGridMonth,listMonth',
                }
        }
        events={inputs}
        eventClass={(info) =>
          [
            'precision-calendar-event',
            info.view.type.startsWith('list')
              ? 'precision-calendar-event-list'
              : 'precision-calendar-event-block',
            info.isDragging || info.isResizing ? 'precision-calendar-event-active' : '',
          ]
            .filter(Boolean)
            .join(' ')
        }
        dayLaneClass="precision-calendar-day-lane"
        slotLaneClass="precision-calendar-slot"
        slotHeaderClass="precision-calendar-slot-header"
        nowIndicatorLineClass="precision-calendar-now-line"
        nowIndicatorDotClass="precision-calendar-now-dot"
        datesSet={(info: DatesSetInfo) => {
          const nextActiveView = scheduleViewFromFullCalendar(info.view.type);
          setActiveView((current) => (current === nextActiveView ? current : nextActiveView));
          const controlledTransition = Boolean(applyingViewRef.current || applyingDateRef.current);
          if (applyingViewRef.current === info.view.type) applyingViewRef.current = null;
          const activeDate = calendarScheduleDateValue(info.view.calendar.getDate());
          if (applyingDateRef.current === activeDate) applyingDateRef.current = null;
          onRangeChange({ from: info.start.toISOString(), to: info.end.toISOString() });
          if (controlledTransition) return;
          onCalendarStateChange(nextActiveView, info.view.calendar.getDate());
        }}
        selectable={canCreate}
        selectMirror={canCreate}
        selectMinDistance={4}
        select={select}
        editable={!interactionLocked}
        eventStartEditable={!interactionLocked}
        eventDurationEditable={!interactionLocked}
        eventResizableFromStart={!interactionLocked}
        eventDrop={move}
        eventResize={move}
        eventClick={(info) => onOpenEvent(sourceEvent(info))}
        eventContent={(info) => {
          const event = info.event.extendedProps.source as CalendarEvent;
          const editable = Boolean(info.event.extendedProps.editable);
          const listView = info.view.type.startsWith('list');
          const label = accessibleEventLabel(event, editable);
          const content = listView ? (
            <Box sx={{ minWidth: 0 }}>
              {info.timeText && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  fontWeight="fontWeightMedium"
                  sx={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}
                >
                  {info.timeText}
                </Typography>
              )}
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography
                  component="span"
                  variant="body2"
                  fontWeight="fontWeightBold"
                  sx={{
                    minWidth: 0,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }}
                >
                  {event.title}
                </Typography>
                {!editable && <LockKeyhole size={11} aria-hidden="true" />}
                {event.conflict && <TriangleAlert size={11} aria-hidden="true" />}
              </Stack>
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block', mt: 0.2 }}
              >
                {[event.calendarName, event.location].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          ) : (
            <>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                {info.timeText && (
                  <Typography
                    component="span"
                    variant="caption"
                    fontWeight="fontWeightMedium"
                    noWrap
                  >
                    {info.timeText}
                  </Typography>
                )}
                <Typography component="span" variant="caption" fontWeight="fontWeightMedium" noWrap>
                  {event.title}
                </Typography>
                {!editable && <LockKeyhole size={11} aria-hidden="true" />}
                {event.conflict && <TriangleAlert size={11} aria-hidden="true" />}
              </Stack>
              {event.location && info.view.type.startsWith('timeGrid') && (
                <Stack direction="row" spacing={0.35} alignItems="center" sx={{ opacity: 0.76 }}>
                  <MapPin size={10} aria-hidden="true" />
                  <Typography component="span" variant="caption" noWrap>
                    {event.location}
                  </Typography>
                </Stack>
              )}
            </>
          );
          const contentSx = {
            minWidth: 0,
            height: listView ? 'auto' : '100%',
            px: listView ? 1 : 0.75,
            py: listView ? 0.75 : 0.4,
            borderLeft: '3px solid',
            borderLeftColor: event.calendarColor || 'primary.main',
            bgcolor: listView ? 'transparent' : (theme: Theme) => eventSurfaceColor(theme, event),
            color: 'text.primary',
            outline: event.conflict ? '1px solid' : 'none',
            outlineColor: event.conflict ? 'error.main' : 'transparent',
            outlineOffset: event.conflict ? -1 : 0,
          } as const;

          if (listView) {
            return (
              <Box
                component="button"
                type="button"
                aria-label={label}
                title={label}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onOpenEvent(event);
                }}
                sx={{
                  ...contentSx,
                  appearance: 'none',
                  display: 'block',
                  width: '100%',
                  m: 0,
                  borderTop: 0,
                  borderRight: 0,
                  borderBottom: 0,
                  bgcolor: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  font: 'inherit',
                  textAlign: 'left',
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                }}
              >
                {content}
              </Box>
            );
          }

          return (
            <Box data-calendar-event-conflict={event.conflict || undefined} sx={contentSx}>
              {content}
            </Box>
          );
        }}
        eventDidMount={(info) => {
          const event = info.event.extendedProps.source as CalendarEvent;
          const editable = Boolean(info.event.extendedProps.editable);
          const label = accessibleEventLabel(event, editable);
          info.el.dataset.calendarEventShell = event.eventId;
          if (info.view.type.startsWith('list')) {
            info.el.setAttribute('role', 'listitem');
            info.el.removeAttribute('tabindex');
            info.el.removeAttribute('aria-label');
            info.el.removeAttribute('title');
          } else {
            const keyboardHandler = (keyboardEvent: KeyboardEvent) => {
              if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
              keyboardEvent.preventDefault();
              onOpenEvent(event);
            };
            info.el.setAttribute('role', 'button');
            info.el.setAttribute('tabindex', '0');
            info.el.setAttribute('aria-label', label);
            info.el.title = label;
            info.el.addEventListener('keydown', keyboardHandler);
            eventKeyboardHandlersRef.current.set(info.el, keyboardHandler);
          }
        }}
        eventWillUnmount={(info) => {
          const keyboardHandler = eventKeyboardHandlersRef.current.get(info.el);
          if (!keyboardHandler) return;
          info.el.removeEventListener('keydown', keyboardHandler);
          eventKeyboardHandlersRef.current.delete(info.el);
        }}
        nowIndicator
        navLinks
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: workingDayStart,
          endTime: workingDayEnd,
        }}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        scrollTime="08:00:00"
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        slotMinHeight={32}
        allDaySlot
        dayMaxEvents={4}
        eventMaxStack={4}
        height="auto"
        expandRows
      />
    </Box>
  );
}
