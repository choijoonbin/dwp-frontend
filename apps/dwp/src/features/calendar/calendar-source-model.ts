import type { CalendarEvent, CalendarSummary } from '@dwp-frontend/shared-utils';

export type CalendarSourceGroupKey = 'favorites' | 'company' | 'mine' | 'shared' | 'team';

export type CalendarSourceGroup = Readonly<{
  key: CalendarSourceGroupKey;
  calendars: readonly CalendarSummary[];
}>;

const GROUP_ORDER: readonly CalendarSourceGroupKey[] = [
  'favorites',
  'company',
  'mine',
  'shared',
  'team',
];

export function calendarIsRequired(calendar: CalendarSummary): boolean {
  return calendar.required === true || calendar.subscriptionPolicy === 'REQUIRED';
}

function sourceGroup(calendar: CalendarSummary): Exclude<CalendarSourceGroupKey, 'favorites'> {
  if (calendar.sourceKind === 'COMPANY') return 'company';
  if (calendar.sourceKind === 'SHARED') return 'shared';
  if (calendar.sourceKind === 'TEAM' || calendar.sourceKind === 'RESOURCE') return 'team';
  if (calendar.sourceKind === 'OWNED') return 'mine';
  if (calendar.type === 'SYSTEM') return 'company';
  if (calendar.type === 'PERSONAL') return 'mine';
  return 'team';
}

export function groupCalendarSources(
  calendars: readonly CalendarSummary[]
): readonly CalendarSourceGroup[] {
  const grouped = new Map<CalendarSourceGroupKey, CalendarSummary[]>(
    GROUP_ORDER.map((key) => [key, []])
  );

  calendars.forEach((calendar) => {
    const key = calendar.favorite ? 'favorites' : sourceGroup(calendar);
    grouped.get(key)?.push(calendar);
  });

  return GROUP_ORDER.map((key) => ({ key, calendars: grouped.get(key) ?? [] })).filter(
    (group) => group.calendars.length > 0
  );
}

export function normalizeCalendarSelection(
  calendars: readonly CalendarSummary[],
  requestedIds: readonly string[] | null
): string[] {
  const available = new Set(calendars.map((calendar) => calendar.calendarId));
  const requested = new Set(
    requestedIds === null
      ? calendars.filter((calendar) => calendar.selected).map((calendar) => calendar.calendarId)
      : requestedIds.filter((calendarId) => available.has(calendarId))
  );
  calendars.filter(calendarIsRequired).forEach((calendar) => requested.add(calendar.calendarId));
  return calendars
    .map((calendar) => calendar.calendarId)
    .filter((calendarId) => requested.has(calendarId));
}

export function calendarCanChangeSelection(
  calendar: CalendarSummary,
  nextSelected: boolean
): boolean {
  if (calendarIsRequired(calendar) && !nextSelected) return false;
  if (nextSelected) return true;
  return calendar.capabilities?.canUnsubscribe ?? true;
}

export function calendarCanManageSharing(calendar: CalendarSummary): boolean {
  return calendar.capabilities?.canManageSharing === true;
}

export function eventCapability(
  event: CalendarEvent,
  capability: keyof NonNullable<CalendarEvent['capabilities']>,
  legacyFallback = false
): boolean {
  return event.capabilities ? event.capabilities[capability] : legacyFallback;
}
