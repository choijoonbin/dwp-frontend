import { describe, expect, it, vi } from 'vitest';

import {
  calendarSchedulingActorIsOrganizerV2,
  verifyCalendarSchedulingFinalV2,
} from './calendar-scheduling-final-check';

import type { CalendarSchedulingFinalCheckError } from './calendar-scheduling-final-check';

import type {
  CalendarSchedulingEvaluationV2,
  CalendarSchedulingHardRecheckV2,
} from '@dwp-frontend/shared-utils';

const PERSON_ID = '00ba0853-02a8-7499-b6d8-009251e6a464';
const EVALUATION_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74ca';
const STARTS_AT = '2026-11-02T05:00:00Z';
const ENDS_AT = '2026-11-02T05:30:00Z';

function evaluation(
  overrides: Partial<CalendarSchedulingEvaluationV2> = {}
): CalendarSchedulingEvaluationV2 {
  return {
    evaluationId: EVALUATION_ID,
    criteriaHash: 'criteria-1',
    challengeToken: 'challenge-1',
    completeness: 'COMPLETE',
    participants: [
      {
        clientRef: 'attendee-1',
        personPublicId: PERSON_ID,
        role: 'REQUIRED',
        coverage: 'COMPLETE',
        workingSchedule: {
          timeZone: 'Asia/Seoul',
          days: [
            {
              dayOfWeek: 'MONDAY',
              windows: [{ startsAt: '09:00', endsAt: '18:00' }],
            },
          ],
          source: 'USER_SETTINGS',
          version: 1,
          observedAt: '2026-11-02T04:59:00Z',
        },
        intervals: [],
      },
    ],
    suggestions: [],
    sources: [
      {
        sourceType: 'DWP_NATIVE',
        status: 'HEALTHY',
        coverageFrom: '2026-11-02T00:00:00Z',
        coverageTo: '2026-11-03T00:00:00Z',
        lastSuccessfulSyncAt: '2026-11-02T04:59:00Z',
        observedAt: '2026-11-02T04:59:00Z',
        reasonCode: null,
        affectedParticipantRefs: [],
      },
    ],
    rooms: [],
    generatedAt: '2026-11-02T04:59:00Z',
    validUntil: '2026-11-02T05:05:00Z',
    ...overrides,
  };
}

function pass(): CalendarSchedulingHardRecheckV2 {
  return {
    evaluationId: EVALUATION_ID,
    criteriaHash: 'criteria-1',
    status: 'PASS',
    hardRecheckToken: 'hard-token-1',
    selectionHash: 'selection-1',
    conflicts: [],
    room: null,
    checkedAt: '2026-11-02T05:00:01Z',
    validUntil: '2026-11-02T05:00:25Z',
  };
}

const input = {
  startsAt: STARTS_AT,
  endsAt: ENDS_AT,
  timeZone: 'Asia/Seoul',
  attendees: [{ personId: PERSON_ID, displayName: 'A', type: 'REQUIRED' }],
  resource: null,
  resourceId: null,
};

describe('calendar scheduling final check', () => {
  it('offers token-backed verification only to the current event organizer', () => {
    expect(calendarSchedulingActorIsOrganizerV2(null, null)).toBe(true);
    expect(
      calendarSchedulingActorIsOrganizerV2(
        { organizerPersonPublicId: PERSON_ID, organizerUserId: 7 },
        { personPublicId: PERSON_ID, userId: '9' }
      )
    ).toBe(true);
    expect(
      calendarSchedulingActorIsOrganizerV2(
        { organizerPersonPublicId: PERSON_ID, organizerUserId: 7 },
        { personPublicId: '019a3d6e-4be8-779c-8a6d-893fe39b74cb', userId: '7' }
      )
    ).toBe(false);
  });

  it('re-evaluates the exact final selection and returns the one-time save receipt', async () => {
    const evaluate = vi.fn().mockResolvedValue(evaluation());
    const hardRecheck = vi.fn().mockResolvedValue(pass());

    await expect(
      verifyCalendarSchedulingFinalV2(input, { evaluate, hardRecheck }, () =>
        Date.parse('2026-11-02T05:00:00Z')
      )
    ).resolves.toMatchObject({
      evaluationId: EVALUATION_ID,
      hardRecheckToken: 'hard-token-1',
      selection: { startsAt: STARTS_AT, endsAt: ENDS_AT },
      roomId: null,
      draftFingerprint: expect.any(String),
    });
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: [{ clientRef: 'attendee-1', personPublicId: PERSON_ID, role: 'REQUIRED' }],
        candidateSlot: { startsAt: STARTS_AT, endsAt: ENDS_AT },
        searchTimeZone: 'Asia/Seoul',
      })
    );
    expect(hardRecheck).toHaveBeenCalledWith(EVALUATION_ID, {
      challengeToken: 'challenge-1',
      criteriaHash: 'criteria-1',
      selection: { startsAt: STARTS_AT, endsAt: ENDS_AT },
      roomId: null,
    });
  });

  it('rejects unresolved attendees before sending private scheduling requests', async () => {
    const evaluate = vi.fn();
    const hardRecheck = vi.fn();

    await expect(
      verifyCalendarSchedulingFinalV2(
        { ...input, attendees: [{ personId: 'person-1', type: 'REQUIRED' }] },
        { evaluate, hardRecheck }
      )
    ).rejects.toMatchObject({
      reason: 'UNRESOLVED_PARTICIPANT',
    } satisfies Partial<CalendarSchedulingFinalCheckError>);
    expect(evaluate).not.toHaveBeenCalled();
    expect(hardRecheck).not.toHaveBeenCalled();
  });

  it('fails closed on partial evidence and does not issue a hard recheck', async () => {
    const evaluate = vi.fn().mockResolvedValue(evaluation({ completeness: 'PARTIAL' }));
    const hardRecheck = vi.fn();

    await expect(
      verifyCalendarSchedulingFinalV2(input, { evaluate, hardRecheck }, () =>
        Date.parse('2026-11-02T05:00:00Z')
      )
    ).rejects.toMatchObject({
      reason: 'UNVERIFIED_EVIDENCE',
    } satisfies Partial<CalendarSchedulingFinalCheckError>);
    expect(hardRecheck).not.toHaveBeenCalled();
  });

  it('rejects a blocked hard recheck instead of returning a save token', async () => {
    const evaluate = vi.fn().mockResolvedValue(evaluation());
    const hardRecheck = vi.fn().mockResolvedValue({
      ...pass(),
      status: 'BLOCKED',
      hardRecheckToken: null,
    });

    await expect(
      verifyCalendarSchedulingFinalV2(input, { evaluate, hardRecheck }, () =>
        Date.parse('2026-11-02T05:00:00Z')
      )
    ).rejects.toMatchObject({
      reason: 'HARD_RECHECK_BLOCKED',
    } satisfies Partial<CalendarSchedulingFinalCheckError>);
  });

  it('checks hard-recheck expiry after the response instead of at request start', async () => {
    const evaluate = vi.fn().mockResolvedValue(evaluation());
    const hardRecheck = vi.fn().mockResolvedValue(pass());
    const now = vi
      .fn()
      .mockReturnValueOnce(Date.parse('2026-11-02T05:00:00Z'))
      .mockReturnValueOnce(Date.parse('2026-11-02T05:00:25Z'));

    await expect(
      verifyCalendarSchedulingFinalV2(input, { evaluate, hardRecheck }, now)
    ).rejects.toMatchObject({
      reason: 'HARD_RECHECK_BLOCKED',
    } satisfies Partial<CalendarSchedulingFinalCheckError>);
  });
});
