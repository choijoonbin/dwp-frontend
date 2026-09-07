import type { CalendarEvent, CalendarHome } from '@dwp-frontend/shared-utils';

/** A successful feed is the current authority, including removals and redaction. */
export function calendarReconcileHomeEvent(
  selected: CalendarEvent | null,
  home: CalendarHome
): CalendarEvent | null {
  if (!selected) return null;
  const candidates = home.nextEvent ? [...home.today, home.nextEvent] : home.today;
  const current = candidates.find(
    (event) => event.eventId === selected.eventId && event.startsAt === selected.startsAt
  );
  return current &&
    !current.redacted &&
    current.detailLevel !== 'FREE_BUSY' &&
    current.capabilities?.canViewDetails === true
    ? current
    : null;
}
