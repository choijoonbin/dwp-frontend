import type { CalendarEvent, CalendarResponseStatus } from '@dwp-frontend/shared-utils';

export type CalendarInvitationFilter =
  'ALL' | 'NEEDS_ACTION' | 'ACCEPTED' | 'TENTATIVE' | 'DECLINED';

export type CalendarPlanningEvents = Readonly<{
  focus: readonly CalendarEvent[];
  tasks: readonly CalendarEvent[];
}>;

export function calendarHorizon(
  now = new Date(),
  beforeDays = 0,
  afterDays = 30
): Readonly<{ from: string; to: string }> {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - beforeDays);
  const to = new Date(from);
  to.setDate(to.getDate() + beforeDays + afterDays);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function calendarEventMinutes(event: Pick<CalendarEvent, 'startsAt' | 'endsAt'>): number {
  return Math.max(
    0,
    Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60_000)
  );
}

function byStart(left: CalendarEvent, right: CalendarEvent): number {
  return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
}

export function calendarPlanningEvents(
  events: readonly CalendarEvent[],
  now = new Date()
): CalendarPlanningEvents {
  const upcoming = events
    .filter(
      (event) =>
        event.status !== 'CANCELLED' &&
        new Date(event.endsAt).getTime() >= now.getTime() &&
        (event.type === 'FOCUS' || event.type === 'TASK')
    )
    .sort(byStart);
  return {
    focus: upcoming.filter((event) => event.type === 'FOCUS'),
    tasks: upcoming.filter((event) => event.type === 'TASK'),
  };
}

export function calendarInvitations(events: readonly CalendarEvent[]): readonly CalendarEvent[] {
  return events
    .filter(
      (event) =>
        event.status !== 'CANCELLED' &&
        event.responseRequired &&
        event.myResponse !== null &&
        event.myResponse !== undefined
    )
    .sort(byStart);
}

export function filterCalendarInvitations(
  events: readonly CalendarEvent[],
  filter: CalendarInvitationFilter,
  now = new Date()
): readonly CalendarEvent[] {
  const invitations = calendarInvitations(events);
  return filter === 'ALL'
    ? invitations
    : invitations.filter(
        (event) =>
          event.myResponse === filter &&
          (filter !== 'NEEDS_ACTION' || new Date(event.endsAt).getTime() >= now.getTime())
      );
}

export function countCalendarInvitationResponses(
  events: readonly CalendarEvent[],
  now = new Date()
): Readonly<Record<CalendarResponseStatus, number>> {
  return calendarInvitations(events).reduce<Record<CalendarResponseStatus, number>>(
    (counts, event) => {
      if (
        event.myResponse &&
        (event.myResponse !== 'NEEDS_ACTION' || new Date(event.endsAt).getTime() >= now.getTime())
      ) {
        counts[event.myResponse] += 1;
      }
      return counts;
    },
    { NEEDS_ACTION: 0, ACCEPTED: 0, TENTATIVE: 0, DECLINED: 0 }
  );
}
