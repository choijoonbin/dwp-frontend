import type { CalendarEvent } from '@dwp-frontend/shared-utils';

export type CalendarEventSearchValidation =
  | Readonly<{ valid: true; query: string }>
  | Readonly<{ valid: false; reason: 'TOO_SHORT' | 'TOO_LONG'; query: string }>;

export function normalizeCalendarEventSearchQuery(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\p{White_Space}\p{Z}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

export function validateCalendarEventSearchQuery(value: string): CalendarEventSearchValidation {
  const query = normalizeCalendarEventSearchQuery(value);
  const length = [...query].length;
  if (length < 2) return { valid: false, reason: 'TOO_SHORT', query };
  if (length > 120) return { valid: false, reason: 'TOO_LONG', query };
  return { valid: true, query };
}

export function calendarEventSearchResultKey(event: CalendarEvent) {
  return `${event.eventId}:${event.recurrenceId ?? event.startsAt}`;
}

export function calendarEventSearchResults(
  pages: readonly Readonly<{ items: readonly CalendarEvent[] }>[] | undefined,
  failed: boolean
) {
  if (!pages || failed) return [];
  const seen = new Set<string>();
  return pages.flatMap((page) =>
    page.items.filter((event) => {
      const key = calendarEventSearchResultKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  );
}
