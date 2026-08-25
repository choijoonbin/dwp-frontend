import { useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import listPlugin from '@fullcalendar/react/list';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import formaThemePlugin from '@fullcalendar/react/themes/forma';
import koLocale from '@fullcalendar/react/locales/ko';
import { LockKeyhole, MapPin } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/forma/theme.css';
import '@fullcalendar/react/themes/forma/palettes/blue.css';

import { CALENDAR_EVENT_TONES } from './calendar-components';

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

export type CalendarRange = Readonly<{ from: string; to: string }>;

type CalendarInteractiveGridProps = {
  events: readonly CalendarEvent[];
  language: string;
  compact: boolean;
  loading: boolean;
  navigateDate?: Date;
  canCreate: boolean;
  canMove: (event: CalendarEvent) => boolean;
  onRangeChange: (range: CalendarRange) => void;
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
      backgroundColor: tone.soft,
      borderColor: event.conflict ? '#C62828' : tone.main,
      textColor: '#172033',
      editable,
      startEditable: editable,
      durationEditable: editable,
      extendedProps: { source: event, tone: tone.main, editable },
    };
  });
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
  loading,
  navigateDate,
  canCreate,
  canMove,
  onRangeChange,
  onCreateRange,
  onOpenEvent,
  onMoveEvent,
}: CalendarInteractiveGridProps) {
  const calendarRef = useRef<CalendarRef>(null);
  const inputs = useMemo(() => eventInputs(events, canMove), [canMove, events]);

  useEffect(() => {
    if (navigateDate) calendarRef.current?.getApi().gotoDate(navigateDate);
  }, [navigateDate]);

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

  return (
    <Box
      data-testid="interactive-calendar"
      aria-busy={loading}
      sx={(theme) => ({
        minWidth: 0,
        '--fc-border-color': theme.palette.divider,
        '--fc-page-bg-color': theme.palette.background.paper,
        '--fc-neutral-bg-color': theme.palette.action.hover,
        '--fc-today-bg-color': theme.palette.mode === 'dark' ? '#17304B' : '#F0F6FF',
        '--fc-now-indicator-color': theme.palette.error.main,
        '& .fc': { color: theme.palette.text.primary, fontFamily: theme.typography.fontFamily },
        '& .fc-header-toolbar': {
          gap: 1,
          px: { xs: 1, md: 2 },
          py: 1.25,
          mb: '0 !important',
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
        },
        '& .fc-toolbar-title': {
          fontSize: { xs: '1rem', md: '1.125rem' },
          fontWeight: 800,
          letterSpacing: 0,
        },
        '& .fc-button': { minHeight: 34, borderRadius: '4px !important', fontWeight: 700 },
        '& .fc-col-header-cell-cushion': { py: 1.25, fontWeight: 750, color: 'text.secondary' },
        '& .fc-timegrid-slot': { height: '2.8rem' },
        '& .fc-timegrid-slot-label-cushion': { color: 'text.secondary', fontSize: '0.72rem' },
        '& .fc-event': { borderRadius: 4, boxShadow: 'none', cursor: 'pointer' },
        '& .fc-event:hover': { boxShadow: theme.shadows[2] },
        '& .fc-event:focus': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 1,
        },
        '& .fc-event-main': { color: 'inherit', p: 0 },
        '& .fc-list-event:hover td': { bgcolor: 'action.hover' },
        '& .fc-daygrid-day-number': { color: 'text.primary', p: 1 },
        '& .fc-popover': { borderRadius: 1, boxShadow: theme.shadows[8] },
      })}
    >
      <FullCalendar
        ref={calendarRef}
        plugins={[formaThemePlugin, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={language.startsWith('ko') ? koLocale : 'en'}
        initialView={compact ? 'listMonth' : 'timeGridWeek'}
        headerToolbar={
          compact
            ? { start: 'prev,next today', center: 'title', end: 'timeGridDay,listMonth' }
            : {
                start: 'prev,next today',
                center: 'title',
                end: 'timeGridDay,timeGridWeek,dayGridMonth,listMonth',
              }
        }
        events={inputs}
        datesSet={(info: DatesSetInfo) =>
          onRangeChange({ from: info.start.toISOString(), to: info.end.toISOString() })
        }
        selectable={canCreate}
        selectMirror={canCreate}
        selectMinDistance={4}
        select={select}
        editable
        eventStartEditable
        eventDurationEditable
        eventResizableFromStart
        eventDrop={move}
        eventResize={move}
        eventClick={(info) => onOpenEvent(sourceEvent(info))}
        eventContent={(info) => {
          const event = info.event.extendedProps.source as CalendarEvent;
          const editable = Boolean(info.event.extendedProps.editable);
          return (
            <Box sx={{ minWidth: 0, px: 0.75, py: 0.4 }}>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                {info.timeText && (
                  <Typography component="span" variant="caption" fontWeight={800} noWrap>
                    {info.timeText}
                  </Typography>
                )}
                <Typography component="span" variant="caption" fontWeight={750} noWrap>
                  {event.title}
                </Typography>
                {!editable && <LockKeyhole size={11} aria-hidden="true" />}
              </Stack>
              {event.location && info.view.type.startsWith('timeGrid') && (
                <Stack direction="row" spacing={0.35} alignItems="center" sx={{ opacity: 0.76 }}>
                  <MapPin size={10} aria-hidden="true" />
                  <Typography component="span" variant="caption" noWrap>
                    {event.location}
                  </Typography>
                </Stack>
              )}
            </Box>
          );
        }}
        eventDidMount={(info) => {
          const event = info.event.extendedProps.source as CalendarEvent;
          info.el.setAttribute('aria-label', `${info.timeText} ${event.title}`.trim());
          info.el.title = event.title;
        }}
        nowIndicator
        navLinks
        businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '19:00' }}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        scrollTime="08:00:00"
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        allDaySlot
        dayMaxEvents={4}
        eventMaxStack={4}
        height="auto"
        expandRows
      />
    </Box>
  );
}
