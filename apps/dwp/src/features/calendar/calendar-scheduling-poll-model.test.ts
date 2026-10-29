import { describe, expect, it } from 'vitest';

import {
  calendarSchedulingPollActions,
  calendarSchedulingPollCreateInput,
  calendarSchedulingPollDraftValidation,
  calendarSchedulingPollInitialVoteChoices,
  calendarSchedulingPollVoteInput,
  calendarSchedulingPollVotesComplete,
  formatCalendarSchedulingPollDateTime,
  type CalendarSchedulingPollDraft,
} from './calendar-scheduling-poll-model';

import type { CalendarSchedulingPollDetails } from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';

const NOW = Date.parse('2026-10-28T00:00:00Z');
const POLL_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74ca';
const CANDIDATE_ONE = '019a3d6e-4be8-779c-8a6d-893fe39b74cb';
const CANDIDATE_TWO = '019a3d6e-4be8-779c-8a6d-893fe39b74cc';
const ORGANIZER = '00ba0853-02a8-7499-b6d8-009251e6a464';
const PARTICIPANT = '00ba0853-02a8-7499-b6d8-009251e6a465';
const COMMAND_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74cd';

const draft: CalendarSchedulingPollDraft = {
  title: ' Release planning ',
  description: ' Choose a time ',
  timeZone: 'Asia/Seoul',
  candidates: [
    {
      candidateId: CANDIDATE_ONE,
      startsAt: '2026-11-03T01:00:00Z',
      endsAt: '2026-11-03T01:30:00Z',
      resourceId: null,
    },
    {
      candidateId: CANDIDATE_TWO,
      startsAt: '2026-11-04T01:00:00Z',
      endsAt: '2026-11-04T01:30:00Z',
      resourceId: null,
    },
  ],
  participants: [
    {
      personPublicId: PARTICIPANT,
      externalEmail: null,
      displayName: ' Minseo Kim ',
      required: true,
    },
  ],
  expiresAt: '2026-11-02T01:00:00Z',
};

function details(
  state: CalendarSchedulingPollDetails['poll']['state'] = 'AGREEMENT_REACHED'
): CalendarSchedulingPollDetails {
  return {
    poll: {
      pollId: POLL_ID,
      organizerPersonPublicId: ORGANIZER,
      state,
      title: 'Release planning',
      description: 'Choose a time',
      timeZone: 'Asia/Seoul',
      candidates: [
        {
          candidateId: CANDIDATE_ONE,
          startsAt: '2026-11-03T01:00:00Z',
          endsAt: '2026-11-03T01:30:00Z',
          resourceId: null,
          yesCount: 2,
          ifNeededCount: 0,
          noCount: 0,
          agreementEligible: true,
        },
        {
          candidateId: CANDIDATE_TWO,
          startsAt: '2026-11-04T01:00:00Z',
          endsAt: '2026-11-04T01:30:00Z',
          resourceId: '019a3d6e-4be8-779c-8a6d-893fe39b74ce',
          yesCount: 1,
          ifNeededCount: 0,
          noCount: 1,
          agreementEligible: false,
        },
      ],
      participants: [
        {
          participantId: '019a3d6e-4be8-779c-8a6d-893fe39b74cf',
          personPublicId: PARTICIPANT,
          externalEmail: null,
          displayName: 'Minseo Kim',
          required: true,
          externalVotingEnabled: false,
        },
      ],
      myVotes: [
        {
          participantId: '019a3d6e-4be8-779c-8a6d-893fe39b74cf',
          candidateId: CANDIDATE_ONE,
          choice: 'YES',
        },
      ],
      expiresAt: '2026-11-02T01:00:00Z',
      confirmedEventId: null,
      confirmedCandidateId: null,
      version: 4,
      updatedAt: '2026-10-28T00:01:00Z',
    },
    availability: [
      {
        candidateId: CANDIDATE_ONE,
        availabilityState: 'AVAILABLE',
        safeReasonCode: null,
        roomHoldActive: false,
      },
      {
        candidateId: CANDIDATE_TWO,
        availabilityState: 'ROOM_UNAVAILABLE',
        safeReasonCode: 'ACTIVE_ROOM_CONFLICT',
        roomHoldActive: false,
      },
    ],
    holds: [],
  };
}

describe('calendar scheduling poll model', () => {
  it('builds a bounded internal-only creation request with normalized copy', () => {
    expect(calendarSchedulingPollDraftValidation(draft, NOW)).toEqual({
      valid: true,
      issues: [],
    });
    expect(calendarSchedulingPollCreateInput(draft, COMMAND_ID, NOW)).toMatchObject({
      title: 'Release planning',
      description: 'Choose a time',
      participants: [
        {
          personPublicId: PARTICIPANT,
          externalEmail: null,
          displayName: 'Minseo Kim',
          required: true,
        },
      ],
      idempotencyKey: COMMAND_ID,
    });
  });

  it('reports duplicate candidates, missing required participants, and an unsafe expiry together', () => {
    const invalid = calendarSchedulingPollDraftValidation(
      {
        ...draft,
        candidates: [draft.candidates[0]!, { ...draft.candidates[0]! }],
        participants: draft.participants.map((participant) => ({
          ...participant,
          required: false,
        })),
        expiresAt: '2026-11-03T02:00:00Z',
      },
      NOW
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'CANDIDATE_DUPLICATE',
        'CANDIDATE_RANGE_DUPLICATE',
        'REQUIRED_PARTICIPANT_MISSING',
        'EXPIRES_AT_RANGE',
      ])
    );
  });

  it('does not treat a date-only value as the backend OffsetDateTime contract', () => {
    const invalid = calendarSchedulingPollDraftValidation(
      {
        ...draft,
        candidates: [
          {
            ...draft.candidates[0]!,
            startsAt: '2026-11-03',
          },
        ],
      },
      NOW
    );
    expect(invalid.issues.map((issue) => issue.code)).toContain('CANDIDATE_RANGE_INVALID');
  });

  it('fails closed when actor identity, expiry, availability, or lifecycle does not permit action', () => {
    expect(calendarSchedulingPollActions(details(), ORGANIZER, NOW)).toMatchObject({
      role: 'ORGANIZER',
      canOpen: true,
      canCancel: true,
      canConfirm: true,
      eligibleCandidateIds: [CANDIDATE_ONE],
    });
    expect(calendarSchedulingPollActions(details('OPEN'), PARTICIPANT, NOW)).toMatchObject({
      role: 'PARTICIPANT',
      canVote: true,
      canConfirm: false,
    });
    expect(calendarSchedulingPollActions(details('OPEN'), 'not-a-person', NOW)).toMatchObject({
      role: 'NONE',
      canVote: false,
      canCancel: false,
    });
    expect(
      calendarSchedulingPollActions(
        details('OPEN'),
        PARTICIPANT,
        Date.parse('2026-11-02T01:00:00Z')
      )
    ).toMatchObject({ expired: true, canVote: false });
  });

  it('allows an organizer to vote only when that same internal identity is also a participant', () => {
    const base = details('OPEN');
    const organizerParticipant = {
      ...base,
      poll: {
        ...base.poll,
        participants: [
          ...base.poll.participants,
          {
            participantId: '019a3d6e-4be8-779c-8a6d-893fe39b74d0',
            personPublicId: ORGANIZER,
            externalEmail: null,
            displayName: 'Organizer',
            required: true,
            externalVotingEnabled: false,
          },
        ],
      },
    } satisfies CalendarSchedulingPollDetails;
    expect(calendarSchedulingPollActions(organizerParticipant, ORGANIZER, NOW)).toMatchObject({
      role: 'ORGANIZER_PARTICIPANT',
      isOrganizer: true,
      isParticipant: true,
      canVote: true,
    });
  });

  it('requires one choice for every candidate and preserves deterministic candidate order', () => {
    const poll = details('OPEN');
    const initial = calendarSchedulingPollInitialVoteChoices(poll);
    expect(initial).toEqual({ [CANDIDATE_ONE]: 'YES' });
    expect(calendarSchedulingPollVotesComplete(poll, initial)).toBe(false);
    const complete = { ...initial, [CANDIDATE_TWO]: 'IF_NEEDED' as const };

    expect(
      calendarSchedulingPollVoteInput(
        poll,
        PARTICIPANT,
        complete,
        '  Works with preparation  ',
        COMMAND_ID,
        NOW
      )
    ).toEqual({
      votes: [
        { candidateId: CANDIDATE_ONE, choice: 'YES' },
        { candidateId: CANDIDATE_TWO, choice: 'IF_NEEDED' },
      ],
      comment: 'Works with preparation',
      idempotencyKey: COMMAND_ID,
    });
  });

  it('formats candidate time in the poll zone and refuses invalid zone evidence', () => {
    expect(
      formatCalendarSchedulingPollDateTime('2026-11-03T01:00:00Z', 'Asia/Seoul', 'en')
    ).toContain('Nov');
    expect(
      formatCalendarSchedulingPollDateTime('2026-11-03T01:00:00Z', '../Seoul', 'en')
    ).toBeNull();
  });
});
