import { isAppReadEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';

import type { PermissionDTO, SavedViewConfiguration } from '@dwp-frontend/shared-utils';

export type CalendarScheduleView = 'day' | 'threeDay' | 'fourDay' | 'week' | 'month' | 'agenda';

export function calendarScheduleInitialRange(now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - ((from.getDay() || 7) - 1));
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function sameCalendarSelection(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function calendarScheduleAuthorizedEvent<T extends { eventId: string }>(
  event: T | null,
  authoritativeEventIds: ReadonlySet<string>
): T | null {
  return event && authoritativeEventIds.has(event.eventId) ? event : null;
}

const SCHEDULE_VIEWS = new Set<CalendarScheduleView>([
  'day',
  'threeDay',
  'fourDay',
  'week',
  'month',
  'agenda',
]);
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const RETURN_TARGET_MAX_LENGTH = 2_048;

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

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

export function calendarScheduleReturnTarget(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > RETURN_TARGET_MAX_LENGTH ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    hasControlCharacter(value)
  ) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes('\\') || hasControlCharacter(decoded)) return null;
    const resolved = new URL(value, 'https://calendar.internal');
    const canonical = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    const workOwnedPath = resolved.pathname === '/work' || resolved.pathname.startsWith('/work/');

    return resolved.origin === 'https://calendar.internal' && canonical === value && workOwnedPath
      ? canonical
      : null;
  } catch {
    return null;
  }
}

export function authorizedCalendarWorkReturnTarget(
  value: unknown,
  permissions: readonly PermissionDTO[]
): string | null {
  return isAppReadEntitled('APP.WORK', permissions) ? calendarScheduleReturnTarget(value) : null;
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

const CALENDAR_SCHEDULE_QUERY_KEYS = ['view', 'date', 'calendars'] as const;

export function calendarInternalPath(
  target: string,
  current: URLSearchParams,
  options: Readonly<{ preserveScheduleState?: boolean }> = {}
) {
  const resolved = new URL(target, 'https://calendar.internal');
  const next = new URLSearchParams(resolved.search);
  const preserve = options.preserveScheduleState
    ? (['scope', ...CALENDAR_SCHEDULE_QUERY_KEYS] as const)
    : (['scope'] as const);

  preserve.forEach((key) => {
    if (next.has(key)) return;
    current.getAll(key).forEach((value) => next.append(key, value));
  });

  const search = next.toString();
  return `${resolved.pathname}${search ? `?${search}` : ''}${resolved.hash}`;
}

export function isCalendarCommandShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const editing =
    target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
  return (
    !editing &&
    !event.isComposing &&
    !event.defaultPrevented &&
    (event.metaKey || event.ctrlKey) &&
    event.key === '/'
  );
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
    threeDay: 'timeGridThreeDay',
    fourDay: 'timeGridFourDay',
    week: 'timeGridWeek',
    month: 'dayGridMonth',
    agenda: 'listMonth',
  }[view];
}

export function scheduleViewFromFullCalendar(value: string): CalendarScheduleView {
  return (
    ({
      timeGridDay: 'day',
      timeGridThreeDay: 'threeDay',
      timeGridFourDay: 'fourDay',
      timeGridWeek: 'week',
      dayGridMonth: 'month',
      listMonth: 'agenda',
    }[value] as CalendarScheduleView | undefined) ?? 'week'
  );
}
