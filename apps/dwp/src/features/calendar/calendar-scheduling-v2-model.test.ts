import { describe, expect, it } from 'vitest';

import {
  calendarSchedulingCandidateDecisionV2,
  calendarSchedulingCandidateStatusV2,
  calendarSchedulingEvaluationStateV2,
  calendarSchedulingFingerprintV2,
  calendarSchedulingHardRecheckPassedV2,
  calendarSchedulingParticipantsV2,
} from './calendar-scheduling-v2-model';

import type {
  CalendarSchedulingCandidateV2,
  CalendarSchedulingEvaluationV2,
  CalendarSchedulingParticipantAvailabilityV2,
  CalendarSchedulingParticipantRoleV2,
} from '@dwp-frontend/shared-utils';

const CANDIDATE: CalendarSchedulingCandidateV2 = {
  candidateId: 'candidate-1',
  startsAt: '2026-11-02T05:00:00Z',
  endsAt: '2026-11-02T05:30:00Z',
  completeness: 'COMPLETE',
  score: 96,
  reasonCodes: ['ALL_REQUIRED_AVAILABLE'],
  requiredConflictRefs: [],
  optionalConflictRefs: ['optional'],
  hardRecheckRequired: true,
};

function participant(
  clientRef: string,
  role: CalendarSchedulingParticipantRoleV2,
  overrides: Partial<CalendarSchedulingParticipantAvailabilityV2> = {}
): CalendarSchedulingParticipantAvailabilityV2 {
  return {
    clientRef,
    personPublicId: clientRef,
    role,
    coverage: 'COMPLETE',
    intervals: [],
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
    ...overrides,
  };
}

function evaluation(
  overrides: Partial<CalendarSchedulingEvaluationV2> = {}
): CalendarSchedulingEvaluationV2 {
  return {
    evaluationId: 'evaluation-1',
    criteriaHash: 'criteria-1',
    challengeToken: 'challenge-1',
    completeness: 'COMPLETE',
    participants: [
      participant('organizer', 'ORGANIZER'),
      participant('required', 'REQUIRED'),
      participant('optional', 'OPTIONAL', {
        intervals: [
          {
            startsAt: '2026-11-02T05:10:00Z',
            endsAt: '2026-11-02T05:20:00Z',
            state: 'TENTATIVE',
            sourceType: 'DWP_NATIVE',
          },
        ],
      }),
    ],
    suggestions: [CANDIDATE],
    sources: [
      {
        sourceType: 'DWP_NATIVE',
        status: 'HEALTHY',
        coverageFrom: '2026-11-02T00:00:00Z',
        coverageTo: '2026-11-03T00:00:00Z',
        observedAt: '2026-11-02T04:59:00Z',
        lastSuccessfulSyncAt: '2026-11-02T04:59:00Z',
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

const INPUT = {
  participants: [
    {
      clientRef: 'a',
      personPublicId: '00ba0853-02a8-7499-b6d8-009251e6a464',
      role: 'REQUIRED' as const,
    },
    { clientRef: 'b', personPublicId: null, role: 'OPTIONAL' as const },
  ],
  searchWindow: { from: '2026-11-02T00:00:00Z', to: '2026-11-03T00:00:00Z' },
  candidateSlot: { startsAt: CANDIDATE.startsAt, endsAt: CANDIDATE.endsAt },
  durationMinutes: 30,
  searchTimeZone: 'Asia/Seoul',
  roomCriteria: {
    minimumCapacity: 3,
    requiredFeatures: [] as string[],
    preferredFeatures: ['VIDEO'],
    approvalPreference: 'PREFER_NO_APPROVAL' as const,
  },
};

describe('calendar scheduling v2 model', () => {
  it('preserves roles and unresolved attendees with opaque client references', () => {
    const personPublicId = '00ba0853-02a8-7499-b6d8-009251e6a464';
    const selection = calendarSchedulingParticipantsV2([
      { personId: personPublicId, displayName: 'A', type: 'OPTIONAL' },
      { personId: personPublicId, displayName: 'A', type: 'REQUIRED' },
      { personId: 'email:guest@example.com', displayName: 'Guest', type: 'OPTIONAL' },
      { personId: 'person-1', displayName: 'Legacy slug', type: 'REQUIRED' },
    ]);

    expect(selection.participants).toEqual([
      { clientRef: 'attendee-1', personPublicId, role: 'REQUIRED' },
      { clientRef: 'attendee-3', personPublicId: null, role: 'OPTIONAL' },
      { clientRef: 'attendee-4', personPublicId: null, role: 'REQUIRED' },
    ]);
    expect(selection.labels).toEqual({
      'attendee-1': 'A',
      'attendee-3': 'Guest',
      'attendee-4': 'Legacy slug',
    });
    expect(selection.uncheckedCount).toBe(2);
  });

  it('builds an order-independent fingerprint over roles and structured criteria', () => {
    const first = calendarSchedulingFingerprintV2(INPUT);
    const second = calendarSchedulingFingerprintV2({
      ...INPUT,
      participants: [...INPUT.participants].reverse(),
      roomCriteria: {
        ...INPUT.roomCriteria,
        preferredFeatures: [...INPUT.roomCriteria.preferredFeatures].reverse(),
      },
    });

    expect(first).toBe(second);
    expect(
      calendarSchedulingFingerprintV2({
        ...INPUT,
        roomCriteria: { ...INPUT.roomCriteria, minimumCapacity: 4 },
      })
    ).not.toBe(first);
  });

  it('allows known optional conflicts as warnings but blocks required conflicts', () => {
    expect(
      calendarSchedulingCandidateDecisionV2(
        evaluation(),
        CANDIDATE,
        true,
        Date.parse('2026-11-02T05:00:00Z')
      )
    ).toMatchObject({ canApply: true, blockReason: null, optionalConflictCount: 1 });

    expect(
      calendarSchedulingCandidateDecisionV2(
        evaluation(),
        { ...CANDIDATE, requiredConflictRefs: ['required'] },
        true,
        Date.parse('2026-11-02T05:00:00Z')
      )
    ).toMatchObject({ canApply: false, blockReason: 'REQUIRED_CONFLICT' });
  });

  it('fails closed for unknown, partial, stale, and mismatched evidence', () => {
    const now = Date.parse('2026-11-02T05:00:00Z');
    expect(
      calendarSchedulingEvaluationStateV2(evaluation({ completeness: 'UNKNOWN' }), true, now)
    ).toBe('UNKNOWN');
    expect(
      calendarSchedulingEvaluationStateV2(evaluation({ completeness: 'PARTIAL' }), true, now)
    ).toBe('PARTIAL');
    expect(
      calendarSchedulingEvaluationStateV2(
        evaluation({ validUntil: '2026-11-02T05:00:00Z' }),
        true,
        now
      )
    ).toBe('STALE');
    expect(calendarSchedulingEvaluationStateV2(evaluation(), false, now)).toBe('MISMATCH');

    const unknown = participant('required', 'REQUIRED', {
      coverage: 'UNKNOWN',
      workingSchedule: null,
    });
    expect(calendarSchedulingCandidateStatusV2(unknown, CANDIDATE)).toBe('UNKNOWN');
  });

  it('treats outside-working-hours as an explicit required conflict', () => {
    const afterHours = {
      ...CANDIDATE,
      candidateId: 'after-hours',
      startsAt: '2026-11-02T12:00:00Z',
      endsAt: '2026-11-02T12:30:00Z',
      optionalConflictRefs: [],
    };
    expect(
      calendarSchedulingCandidateDecisionV2(
        evaluation(),
        afterHours,
        true,
        Date.parse('2026-11-02T05:00:00Z')
      )
    ).toMatchObject({ canApply: false, blockReason: 'REQUIRED_CONFLICT' });
  });

  it('evaluates each participant in the working schedule time zone returned for them', () => {
    const newYorkParticipant = participant('required', 'REQUIRED', {
      workingSchedule: {
        timeZone: 'America/New_York',
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
    });

    expect(calendarSchedulingCandidateStatusV2(newYorkParticipant, CANDIDATE)).toBe(
      'OUT_OF_OFFICE'
    );
    expect(
      calendarSchedulingCandidateStatusV2(participant('required', 'REQUIRED'), CANDIDATE)
    ).toBe('AVAILABLE');
  });

  it('accepts only a fresh PASS with a hard-recheck token and no blocking conflict', () => {
    const current = evaluation();
    const pass = {
      evaluationId: current.evaluationId,
      criteriaHash: current.criteriaHash,
      status: 'PASS' as const,
      hardRecheckToken: 'hard-token-1',
      selectionHash: 'selection-1',
      conflicts: [],
      room: null,
      checkedAt: '2026-11-02T05:00:01Z',
      validUntil: '2026-11-02T05:00:31Z',
    };
    const now = Date.parse('2026-11-02T05:00:02Z');
    expect(calendarSchedulingHardRecheckPassedV2(current, pass, now)).toBe(true);
    expect(
      calendarSchedulingHardRecheckPassedV2(
        current,
        {
          ...pass,
          conflicts: [
            {
              clientRef: 'required',
              state: 'BUSY',
              startsAt: CANDIDATE.startsAt,
              endsAt: CANDIDATE.endsAt,
              blocking: true,
            },
          ],
        },
        now
      )
    ).toBe(false);
    expect(
      calendarSchedulingHardRecheckPassedV2(current, { ...pass, status: 'BLOCKED' }, now)
    ).toBe(false);
  });
});
