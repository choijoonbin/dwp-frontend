import { describe, expect, it } from 'vitest';

import {
  calendarExternalAttendee,
  calendarNormalizedExternalEmail,
  calendarReplaceAttendeeType,
  calendarResolveAttendeeValues,
} from './calendar-attendee-picker-model';

describe('calendar attendee picker model', () => {
  it('normalizes common RFC email syntax and rejects ambiguous input', () => {
    expect(calendarNormalizedExternalEmail('  Person+Ops@Example.COM ')).toBe(
      'person+ops@example.com'
    );
    expect(calendarNormalizedExternalEmail('person..ops@example.com')).toBeNull();
    expect(calendarNormalizedExternalEmail('person@example')).toBeNull();
    expect(calendarNormalizedExternalEmail('person @example.com')).toBeNull();
    expect(calendarNormalizedExternalEmail('Kim@example.com')).toBeNull();
  });

  it('fails closed when policy does not explicitly allow external attendees', () => {
    expect(calendarResolveAttendeeValues(['guest@example.com'], 'REQUIRED', false)).toEqual({
      attendees: [],
      invalidExternal: false,
      blockedExternal: true,
    });
  });

  it('marks an allowed external email as unresolved identity data', () => {
    expect(calendarExternalAttendee('Guest@Example.com', 'OPTIONAL')).toEqual({
      personId: 'email:guest@example.com',
      displayName: 'guest@example.com',
      workEmail: 'guest@example.com',
      type: 'OPTIONAL',
    });
  });

  it('deduplicates roles by normalized email and prefers an internal person', () => {
    const external = calendarExternalAttendee('member@example.com', 'OPTIONAL')!;
    const internal = {
      personId: '00ba0853-02a8-7499-b6d8-009251e6a464',
      displayName: 'Member',
      workEmail: 'MEMBER@example.com',
      type: 'REQUIRED' as const,
    };

    expect(calendarReplaceAttendeeType([external], 'REQUIRED', [internal])).toEqual([internal]);
  });
});
