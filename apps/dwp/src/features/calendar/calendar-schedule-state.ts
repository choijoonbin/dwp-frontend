import type { SavedViewConfiguration } from '@dwp-frontend/shared-utils';

export type CalendarScheduleView = 'day' | 'week' | 'month' | 'agenda';

const SCHEDULE_VIEWS = new Set<CalendarScheduleView>(['day', 'week', 'month', 'agenda']);
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export function isCalendarScheduleView(value: unknown): value is CalendarScheduleView {
  return typeof value === 'string' && SCHEDULE_VIEWS.has(value as CalendarScheduleView);
}

export function calendarScheduleView(
  value: unknown,
  fallback: CalendarScheduleView
): CalendarScheduleView {
  return isCalendarScheduleView(value) ? value : fallback;
}

export function calendarScheduleDate(value: unknown, fallback = new Date()): Date {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value)) return new Date(fallback);
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

export function calendarScheduleDateValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calendarScheduleCalendarIds(value: unknown): string[] | null {
  if (value === 'none') return [];
  if (typeof value === 'string') {
    const ids = Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
    return ids.length ? ids : null;
  }
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      )
    );
  }
  return null;
}

export function calendarScheduleSearchParams(
  current: URLSearchParams,
  state: Readonly<{
    view: CalendarScheduleView;
    date: Date;
    calendarIds: readonly string[];
  }>
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set('view', state.view);
  next.set('date', calendarScheduleDateValue(state.date));
  next.set(
    'calendars',
    state.calendarIds.length ? [...state.calendarIds].sort().join(',') : 'none'
  );
  return next;
}

export function calendarScheduleSavedConfiguration(
  state: Readonly<{
    view: CalendarScheduleView;
    date: Date;
    calendarIds: readonly string[];
  }>
): SavedViewConfiguration {
  return {
    schemaVersion: 1,
    view: state.view,
    date: calendarScheduleDateValue(state.date),
    calendarIds: [...state.calendarIds].sort(),
  };
}

export function calendarScheduleStateFromSavedView(
  configuration: SavedViewConfiguration,
  fallback: Readonly<{
    view: CalendarScheduleView;
    date: Date;
    calendarIds: readonly string[];
  }>
): Readonly<{ view: CalendarScheduleView; date: Date; calendarIds: string[] }> {
  return {
    view: calendarScheduleView(configuration.view, fallback.view),
    date: calendarScheduleDate(configuration.date, fallback.date),
    calendarIds: calendarScheduleCalendarIds(configuration.calendarIds) ?? [
      ...fallback.calendarIds,
    ],
  };
}

export function fullCalendarView(view: CalendarScheduleView): string {
  return {
    day: 'timeGridDay',
    week: 'timeGridWeek',
    month: 'dayGridMonth',
    agenda: 'listMonth',
  }[view];
}

export function scheduleViewFromFullCalendar(value: string): CalendarScheduleView {
  return (
    ({
      timeGridDay: 'day',
      timeGridWeek: 'week',
      dayGridMonth: 'month',
      listMonth: 'agenda',
    }[value] as CalendarScheduleView | undefined) ?? 'week'
  );
}
