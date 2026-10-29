import type { PersonSummary } from '@dwp-frontend/shared-utils';
import type { CalendarEditorAttendee } from './calendar-attendee-contract';

const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const EMAIL_DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function calendarNormalizedExternalEmail(value: string): string | null {
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > 254 ||
    [...candidate].some((character) => (character.codePointAt(0) ?? 128) > 127)
  ) {
    return null;
  }
  const separator = candidate.lastIndexOf('@');
  if (separator <= 0 || separator !== candidate.indexOf('@')) return null;
  const local = candidate.slice(0, separator);
  const domain = candidate.slice(separator + 1);
  if (
    local.length > 64 ||
    !EMAIL_LOCAL.test(local) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..')
  ) {
    return null;
  }
  const labels = domain.split('.');
  if (
    labels.length < 2 ||
    labels.some((label) => !EMAIL_DOMAIN_LABEL.test(label)) ||
    labels.at(-1)!.length < 2
  ) {
    return null;
  }
  return `${local.toLowerCase()}@${domain.toLowerCase()}`;
}

export function calendarAttendeeIdentity(attendee: CalendarEditorAttendee) {
  const email = attendee.workEmail ? calendarNormalizedExternalEmail(attendee.workEmail) : null;
  return email ? `email:${email}` : `person:${attendee.personId}`;
}

export function calendarExternalAttendee(
  value: string,
  type: CalendarEditorAttendee['type']
): CalendarEditorAttendee | null {
  const email = calendarNormalizedExternalEmail(value);
  return email
    ? {
        personId: `email:${email}`,
        displayName: email,
        workEmail: email,
        type,
      }
    : null;
}

export function calendarPersonAttendee(
  person: PersonSummary,
  type: CalendarEditorAttendee['type']
): CalendarEditorAttendee {
  return {
    personId: person.personId,
    displayName: person.displayName,
    workEmail: person.workEmail,
    type,
  };
}

export function calendarDedupedAttendees(values: readonly CalendarEditorAttendee[]) {
  const selected = new Map<string, CalendarEditorAttendee>();
  values.forEach((attendee) => {
    const key = calendarAttendeeIdentity(attendee);
    const current = selected.get(key);
    const currentExternal = current?.personId.startsWith('email:') ?? false;
    const nextExternal = attendee.personId.startsWith('email:');
    if (!current || (currentExternal && !nextExternal)) selected.set(key, attendee);
  });
  return [...selected.values()];
}

export function calendarAttendeeOptions(
  selected: readonly CalendarEditorAttendee[],
  people: readonly PersonSummary[],
  type: CalendarEditorAttendee['type']
) {
  return calendarDedupedAttendees([
    ...selected.map((attendee) => ({ ...attendee, type })),
    ...people.map((person) => calendarPersonAttendee(person, type)),
  ]);
}

export function calendarResolveAttendeeValues(
  values: readonly (CalendarEditorAttendee | string)[],
  type: CalendarEditorAttendee['type'],
  allowExternal: boolean
): Readonly<{
  attendees: readonly CalendarEditorAttendee[];
  invalidExternal: boolean;
  blockedExternal: boolean;
}> {
  let invalidExternal = false;
  let blockedExternal = false;
  const attendees = values.flatMap((value) => {
    if (typeof value !== 'string') return [{ ...value, type }];
    if (!allowExternal) {
      blockedExternal = true;
      return [];
    }
    const external = calendarExternalAttendee(value, type);
    if (!external) {
      invalidExternal = true;
      return [];
    }
    return [external];
  });
  return {
    attendees: calendarDedupedAttendees(attendees),
    invalidExternal,
    blockedExternal,
  };
}

export function calendarReplaceAttendeeType(
  current: readonly CalendarEditorAttendee[],
  type: CalendarEditorAttendee['type'],
  values: readonly CalendarEditorAttendee[]
) {
  const next = calendarDedupedAttendees(values.map((attendee) => ({ ...attendee, type })));
  const identities = new Set(next.map(calendarAttendeeIdentity));
  return calendarDedupedAttendees([
    ...current.filter(
      (attendee) => attendee.type !== type && !identities.has(calendarAttendeeIdentity(attendee))
    ),
    ...next,
  ]);
}
