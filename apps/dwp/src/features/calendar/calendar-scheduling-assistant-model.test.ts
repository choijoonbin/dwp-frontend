import { describe, expect, it } from 'vitest';

import {
  applyCalendarAvailabilitySlot,
  calendarAvailabilityWindow,
  calendarMeetingDurationMinutes,
  calendarSchedulingFingerprint,
  calendarSchedulingEvaluationIsUsable,
  calendarSchedulingParticipants,
  rankCalendarRooms,
} from './calendar-scheduling-assistant-model';

import type { CalendarResource } from '@dwp-frontend/shared-utils';

const ROOM: CalendarResource = {
  resourceId: 'room-1',
  code: 'ROOM-01',
  name: 'Studio 1',
  nameKo: '스튜디오 1',
  nameEn: 'Studio 1',
  type: 'ROOM',
  site: 'Seoul',
  floor: '12F',
  capacity: 6,
  features: ['VIDEO'],
  timeZone: 'Asia/Seoul',
  approvalRequired: false,
  state: 'AVAILABLE',
  available: true,
  version: 1,
};

describe('calendar scheduling assistant model', () => {
  it('derives a valid duration and a server-safe fourteen day search window', () => {
    expect(calendarMeetingDurationMinutes('2026-08-27T01:00:00Z', '2026-08-27T02:30:00Z')).toBe(90);
    expect(calendarMeetingDurationMinutes('invalid', '2026-08-27T02:30:00Z')).toBeNull();
    expect(
      calendarMeetingDurationMinutes('2026-08-27T03:00:00Z', '2026-08-27T02:30:00Z')
    ).toBeNull();

    expect(calendarAvailabilityWindow('2026-08-27T01:00:00Z', 'Asia/Seoul')).toEqual({
      from: '2026-08-27T01:00:00.000Z',
      to: '2026-09-10T01:00:00.000Z',
    });
  });

  it('keeps a fourteen-day local horizon across daylight saving changes', () => {
    expect(calendarAvailabilityWindow('2026-10-25T13:00:00Z', 'America/New_York')).toEqual({
      from: '2026-10-25T13:00:00.000Z',
      to: '2026-11-08T14:00:00.000Z',
    });
    expect(calendarAvailabilityWindow('invalid', 'America/New_York')).toBeNull();
    expect(calendarAvailabilityWindow('2026-10-25T13:00:00Z', 'Invalid/Zone')).toBeNull();
  });

  it('sends only unique internal public identities and reports unchecked attendees', () => {
    const internalId = '00ba0853-02a8-7499-b6d8-009251e6a464';
    const selection = calendarSchedulingParticipants([
      { personId: internalId },
      { personId: internalId },
      { personId: 'email:guest@example.com' },
      { personId: 'user:17' },
    ]);

    expect(selection.personIds).toEqual([internalId]);
    expect(selection.internalCount).toBe(1);
    expect(selection.uncheckedCount).toBe(2);
    expect(selection.overflowCount).toBe(0);
  });

  it('caps free-busy subjects so the current organizer remains within the server limit', () => {
    const attendees = Array.from({ length: 21 }, (_, index) => ({
      personId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    const selection = calendarSchedulingParticipants(attendees);

    expect(selection.personIds).toHaveLength(19);
    expect(selection.overflowCount).toBe(2);
  });

  it('creates an order-independent fingerprint and applies a recommended slot verbatim', () => {
    const first = calendarSchedulingFingerprint({
      personIds: ['b', 'a'],
      startsAt: '2026-08-27T01:00:00Z',
      endsAt: '2026-08-27T02:00:00Z',
      timeZone: 'Asia/Seoul',
    });
    const second = calendarSchedulingFingerprint({
      personIds: ['a', 'b'],
      startsAt: '2026-08-27T01:00:00Z',
      endsAt: '2026-08-27T02:00:00Z',
      timeZone: 'Asia/Seoul',
    });

    expect(first).toBe(second);
    expect(
      applyCalendarAvailabilitySlot({
        startsAt: '2026-08-28T03:00:00Z',
        endsAt: '2026-08-28T04:00:00Z',
      })
    ).toEqual({ startsAt: '2026-08-28T03:00:00Z', endsAt: '2026-08-28T04:00:00Z' });
  });

  it('accepts only complete, healthy, unexpired evaluation snapshots', () => {
    const evaluation = {
      evaluationId: 'evaluation-1',
      criteriaHash: 'a'.repeat(64),
      completeness: 'COMPLETE' as const,
      sources: [
        {
          sourceType: 'DWP_NATIVE',
          status: 'HEALTHY' as const,
          lastSuccessfulSyncAt: '2026-08-27T01:00:00Z',
        },
      ],
      availability: { participants: [], suggestions: [], generatedAt: '2026-08-27T01:00:00Z' },
      rooms: [],
      generatedAt: '2026-08-27T01:00:00Z',
      validUntil: '2026-08-27T01:00:30Z',
    };

    expect(
      calendarSchedulingEvaluationIsUsable(evaluation, Date.parse('2026-08-27T01:00:10Z'))
    ).toBe(true);
    expect(
      calendarSchedulingEvaluationIsUsable(evaluation, Date.parse(evaluation.validUntil))
    ).toBe(false);
    expect(
      calendarSchedulingEvaluationIsUsable(
        { ...evaluation, sources: [{ ...evaluation.sources[0], status: 'DEGRADED' }] },
        Date.parse('2026-08-27T01:00:10Z')
      )
    ).toBe(false);
  });

  it('ranks only available rooms that fit and favors instant confirmation with low excess capacity', () => {
    const ranked = rankCalendarRooms(
      [
        { ...ROOM, resourceId: 'large', capacity: 20 },
        { ...ROOM, resourceId: 'approval', capacity: 5, approvalRequired: true },
        { ...ROOM, resourceId: 'best', capacity: 5 },
        { ...ROOM, resourceId: 'busy', capacity: 5, available: false },
        { ...ROOM, resourceId: 'small', capacity: 3 },
        { ...ROOM, resourceId: 'desk', type: 'DESK', capacity: 5 },
      ],
      4
    );

    expect(ranked.map((room) => room.resourceId)).toEqual(['best', 'large', 'approval']);
  });
});
