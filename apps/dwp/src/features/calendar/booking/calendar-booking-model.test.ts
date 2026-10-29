import { describe, expect, it } from 'vitest';

import {
  boundedCalendarBookingItems,
  calendarBookingAccessInfo,
  calendarBookingAccessIssue,
  calendarBookingAnswers,
  calendarBookingAppointmentIsMutable,
  calendarBookingAvailabilityRange,
  calendarBookingHoldIssue,
  calendarBookingSlots,
  createCalendarBookingTokenMemory,
} from './calendar-booking-model';

import type {
  AuthenticatedCalendarBookablePage,
  CalendarBookingAppointment,
  CalendarBookingAvailability,
  CalendarBookingQuestion,
} from '@dwp-frontend/shared-utils';

const PAGE_ID = '00ba0853-02a8-7499-b6d8-009251e6a464';

function bookable(
  overrides: Partial<AuthenticatedCalendarBookablePage> = {}
): AuthenticatedCalendarBookablePage {
  return {
    pageId: PAGE_ID,
    pageVersion: 4,
    title: 'Design review',
    description: null,
    timeZone: 'Asia/Seoul',
    durationMinutes: 30,
    meetingMode: 'VIDEO',
    location: null,
    conferenceUrl: 'https://meet.google.com/abc-defg-hij',
    dialInInstructions: null,
    questions: [],
    ...overrides,
  };
}

describe('calendar booking model', () => {
  it('requires explicit mode-specific access information and accepts only safe video URLs', () => {
    expect(calendarBookingAccessInfo(bookable())).toEqual({
      kind: 'VIDEO',
      text: 'https://meet.google.com/abc-defg-hij',
      href: 'https://meet.google.com/abc-defg-hij',
    });
    expect(
      calendarBookingAccessIssue(bookable({ conferenceUrl: 'http://meet.google.com/abc-defg-hij' }))
    ).toBe('INVALID_VIDEO_URL');
    expect(
      calendarBookingAccessInfo(
        bookable({
          meetingMode: 'PHONE',
          conferenceUrl: null,
          dialInInstructions: 'Call extension 4102',
        })
      )
    ).toEqual({ kind: 'PHONE', text: 'Call extension 4102' });
    expect(
      calendarBookingAccessIssue(bookable({ conferenceUrl: 'https://video.example.test/room' }))
    ).toBe('INVALID_VIDEO_URL');
    expect(
      calendarBookingAccessIssue(
        bookable({ conferenceUrl: 'https://meet.google.com/abc-defg-hij#fragment' })
      )
    ).toBe('INVALID_VIDEO_URL');
    expect(
      calendarBookingAccessIssue(
        bookable({ meetingMode: 'IN_PERSON', conferenceUrl: null, location: '   ' })
      )
    ).toBe('ACCESS_INFO_REQUIRED');
    expect(
      calendarBookingAccessIssue(
        bookable({
          meetingMode: 'PHONE',
          conferenceUrl: null,
          dialInInstructions: ' Call extension 4102 ',
        })
      )
    ).toBe('ACCESS_INFO_REQUIRED');
    expect(
      calendarBookingAccessIssue(
        bookable({
          meetingMode: 'IN_PERSON',
          conferenceUrl: 'https://meet.google.com/abc-defg-hij',
          location: 'Room 4102',
        })
      )
    ).toBe('ACCESS_INFO_REQUIRED');
  });

  it('normalizes answers and fails closed on required, invalid, duplicate and oversized values', () => {
    const questions: CalendarBookingQuestion[] = [
      { key: 'agenda', label: 'Agenda', type: 'LONG_TEXT', required: true, options: null },
      {
        key: 'format',
        label: 'Format',
        type: 'SINGLE_SELECT',
        required: true,
        options: ['Review', 'Workshop'],
      },
      { key: 'agenda', label: 'Duplicate', type: 'SHORT_TEXT', required: false, options: null },
      { key: 'notes', label: 'Notes', type: 'LONG_TEXT', required: false, options: null },
      { key: 'consent', label: 'Consent', type: 'CHECKBOX', required: true, options: null },
    ];

    const result = calendarBookingAnswers(questions, {
      agenda: '   ',
      format: 'Unknown',
      notes: 'x'.repeat(2001),
      consent: 'yes',
    });

    expect(result.answers).toEqual([]);
    expect(result.issues).toEqual({
      agenda: 'DUPLICATE_ANSWER',
      format: 'INVALID_SELECTION',
      notes: 'ANSWER_TOO_LONG',
      consent: 'INVALID_SELECTION',
    });
  });

  it('serializes an accepted checkbox as an explicit true answer', () => {
    expect(
      calendarBookingAnswers(
        [{ key: 'consent', label: 'Consent', type: 'CHECKBOX', required: true, options: null }],
        { consent: 'true' }
      )
    ).toEqual({ answers: [{ key: 'consent', value: 'true' }], issues: {} });
  });

  it('rejects mismatched page versions and removes invalid, duplicate or past slots', () => {
    const availability: CalendarBookingAvailability = {
      pageId: PAGE_ID,
      pageVersion: 4,
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-08T00:00:00Z',
      slots: [
        { startsAt: '2026-11-03T02:00:00Z', endsAt: '2026-11-03T02:30:00Z' },
        { startsAt: '2026-11-02T02:00:00Z', endsAt: '2026-11-02T02:30:00Z' },
        { startsAt: '2026-11-02T02:00:00Z', endsAt: '2026-11-02T02:30:00Z' },
        { startsAt: '2026-10-30T02:00:00Z', endsAt: '2026-10-30T02:30:00Z' },
        { startsAt: 'broken', endsAt: '2026-11-04T02:30:00Z' },
      ],
      generatedAt: '2026-10-28T00:00:00Z',
    };

    expect(
      calendarBookingSlots(availability, PAGE_ID, 5, Date.parse('2026-10-31T00:00:00Z'))
    ).toEqual([]);
    expect(
      calendarBookingSlots(availability, PAGE_ID, 4, Date.parse('2026-10-31T00:00:00Z'))
    ).toEqual([
      { startsAt: '2026-11-02T02:00:00Z', endsAt: '2026-11-02T02:30:00Z' },
      { startsAt: '2026-11-03T02:00:00Z', endsAt: '2026-11-03T02:30:00Z' },
    ]);
  });

  it('bounds range and client paging, exposing partial results instead of silently truncating', () => {
    const range = calendarBookingAvailabilityRange(new Date('2026-11-01T00:00:00Z'), 365);
    expect(range).toEqual({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-12-02T00:00:00.000Z',
    });

    const result = boundedCalendarBookingItems(
      Array.from({ length: 240 }, (_, index) => index),
      20,
      (item) => item % 2 === 0
    );
    expect(result.items).toHaveLength(20);
    expect(result.total).toBe(120);
    expect(result.acceptedTotal).toBe(120);
    expect(result.hasMore).toBe(true);
    expect(result.partial).toBe(false);

    const partial = boundedCalendarBookingItems(
      Array.from({ length: 240 }, (_, index) => index),
      400
    );
    expect(partial.items).toHaveLength(200);
    expect(partial.partial).toBe(true);
  });

  it('fails closed when a hold expires or its page version changes', () => {
    const hold = { state: 'HELD', expiresAt: '2026-11-01T00:05:00Z' };
    expect(calendarBookingHoldIssue(hold, 4, 5, Date.parse('2026-11-01T00:00:00Z'))).toBe(
      'PAGE_VERSION_CHANGED'
    );
    expect(calendarBookingHoldIssue(hold, 4, 4, Date.parse('2026-11-01T00:05:00Z'))).toBe(
      'HOLD_EXPIRED'
    );
    expect(calendarBookingHoldIssue(hold, 4, 4, Date.parse('2026-11-01T00:04:59Z'))).toBeNull();
    expect(
      calendarBookingHoldIssue(
        { ...hold, pageId: 'wrong', fencingToken: 1 },
        4,
        4,
        Date.parse('2026-11-01T00:04:59Z'),
        PAGE_ID
      )
    ).toBe('INVALID_SLOT');
  });

  it('allows mutation only for a future confirmed appointment', () => {
    const appointment = {
      state: 'CONFIRMED',
      endsAt: '2026-11-02T01:30:00Z',
    } as CalendarBookingAppointment;
    expect(
      calendarBookingAppointmentIsMutable(appointment, Date.parse('2026-11-01T00:00:00Z'))
    ).toBe(true);
    expect(calendarBookingAppointmentIsMutable(appointment, Date.parse(appointment.endsAt))).toBe(
      false
    );
    expect(calendarBookingAppointmentIsMutable({ ...appointment, state: 'CANCELLED' })).toBe(false);
  });

  it('hands a raw token out once and has no persistent or serializable surface', () => {
    const memory = createCalendarBookingTokenMemory();
    memory.consume({ kind: 'APPOINTMENT_MANAGEMENT', value: 'raw-once' });
    expect(memory.take()).toEqual({ kind: 'APPOINTMENT_MANAGEMENT', value: 'raw-once' });
    expect(memory.take()).toBeNull();
    expect(Object.keys(memory).sort()).toEqual(['clear', 'consume', 'take']);
  });
});
