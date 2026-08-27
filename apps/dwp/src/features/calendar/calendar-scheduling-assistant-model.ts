import { Temporal } from 'temporal-polyfill';

import type {
  CalendarAvailabilitySlot,
  CalendarResource,
  CalendarSchedulingEvaluation,
} from '@dwp-frontend/shared-utils';

export const CALENDAR_AVAILABILITY_ATTENDEE_LIMIT = 19;
export const CALENDAR_AVAILABILITY_HORIZON_DAYS = 14;

export type SchedulingAttendeeIdentity = Readonly<{ personId: string }>;

export type SchedulingParticipantSelection = Readonly<{
  personIds: readonly string[];
  internalCount: number;
  uncheckedCount: number;
  overflowCount: number;
}>;

const PUBLIC_PERSON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function calendarMeetingDurationMinutes(startsAt: string, endsAt: string): number | null {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(1, Math.round((end - start) / 60_000));
}

export function calendarAvailabilityWindow(
  startsAt: string,
  timeZone: string,
  horizonDays = CALENDAR_AVAILABILITY_HORIZON_DAYS
): Readonly<{ from: string; to: string }> | null {
  try {
    const from = Temporal.Instant.from(startsAt);
    const boundedDays = Math.max(1, Math.min(horizonDays, 14));
    const to = from.toZonedDateTimeISO(timeZone).add({ days: boundedDays }).toInstant();
    return {
      from: from.toString({ smallestUnit: 'millisecond' }),
      to: to.toString({ smallestUnit: 'millisecond' }),
    };
  } catch {
    return null;
  }
}

export function calendarSchedulingParticipants(
  attendees: readonly SchedulingAttendeeIdentity[],
  limit = CALENDAR_AVAILABILITY_ATTENDEE_LIMIT
): SchedulingParticipantSelection {
  const normalized = attendees.map((attendee) => attendee.personId.trim());
  const internal = Array.from(
    new Set(normalized.filter((personId) => PUBLIC_PERSON_ID.test(personId)))
  );
  const cappedLimit = Math.max(0, limit);
  return {
    personIds: internal.slice(0, cappedLimit),
    internalCount: internal.length,
    uncheckedCount: normalized.filter((personId) => !PUBLIC_PERSON_ID.test(personId)).length,
    overflowCount: Math.max(0, internal.length - cappedLimit),
  };
}

export function calendarSchedulingFingerprint(
  input: Readonly<{
    personIds: readonly string[];
    startsAt: string;
    endsAt: string;
    timeZone: string;
  }>
): string {
  return JSON.stringify({
    personIds: [...input.personIds].sort(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timeZone: input.timeZone,
  });
}

export function calendarSchedulingEvaluationIsUsable(
  evaluation: CalendarSchedulingEvaluation | null | undefined,
  now = Date.now()
): boolean {
  if (!evaluation || evaluation.completeness !== 'COMPLETE') return false;
  const validUntil = Date.parse(evaluation.validUntil);
  return (
    Number.isFinite(validUntil) &&
    validUntil > now &&
    evaluation.sources.length > 0 &&
    evaluation.sources.every((source) => source.status === 'HEALTHY')
  );
}

export function rankCalendarRooms(
  resources: readonly CalendarResource[],
  attendeeCount: number
): readonly CalendarResource[] {
  const requiredCapacity = Math.max(1, attendeeCount + 1);
  return resources
    .filter(
      (resource) =>
        resource.type === 'ROOM' &&
        resource.state === 'AVAILABLE' &&
        resource.available &&
        resource.capacity >= requiredCapacity
    )
    .sort((left, right) => {
      if (left.approvalRequired !== right.approvalRequired) {
        return Number(left.approvalRequired) - Number(right.approvalRequired);
      }
      const capacityDelta =
        Math.abs(left.capacity - requiredCapacity) - Math.abs(right.capacity - requiredCapacity);
      if (capacityDelta !== 0) return capacityDelta;
      const featureDelta = right.features.length - left.features.length;
      return featureDelta || left.name.localeCompare(right.name);
    });
}

export function applyCalendarAvailabilitySlot(
  slot: Pick<CalendarAvailabilitySlot, 'startsAt' | 'endsAt'>
): Readonly<{ startsAt: string; endsAt: string }> {
  return { startsAt: slot.startsAt, endsAt: slot.endsAt };
}
