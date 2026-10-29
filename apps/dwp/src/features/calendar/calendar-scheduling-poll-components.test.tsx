import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CalendarSchedulingPollOrganizer } from './calendar-scheduling-poll-organizer';
import { CalendarSchedulingPollParticipant } from './calendar-scheduling-poll-participant';

import type { CalendarSchedulingPollDetails } from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));

const NOW = Date.parse('2026-10-28T00:00:00Z');
const POLL_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74ca';
const CANDIDATE_ONE = '019a3d6e-4be8-779c-8a6d-893fe39b74cb';
const CANDIDATE_TWO = '019a3d6e-4be8-779c-8a6d-893fe39b74cc';
const ORGANIZER = '00ba0853-02a8-7499-b6d8-009251e6a464';
const PARTICIPANT = '00ba0853-02a8-7499-b6d8-009251e6a465';
const CALENDAR = '019a3d6e-4be8-779c-8a6d-893fe39b74cd';

function details(
  state: CalendarSchedulingPollDetails['poll']['state']
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
          resourceId: CALENDAR,
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
      myVotes: [],
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

function renderOrganizer(
  state: CalendarSchedulingPollDetails['poll']['state'],
  actorPersonPublicId = ORGANIZER
) {
  return renderToStaticMarkup(
    <CalendarSchedulingPollOrganizer
      details={details(state)}
      actorPersonPublicId={actorPersonPublicId}
      calendars={[{ calendarId: CALENDAR, name: 'My calendar' }]}
      selectedCandidateId={state === 'AGREEMENT_REACHED' ? CANDIDATE_ONE : ''}
      selectedCalendarId={state === 'AGREEMENT_REACHED' ? CALENDAR : ''}
      now={NOW}
      onCandidateChange={vi.fn()}
      onCalendarChange={vi.fn()}
      onOpen={vi.fn()}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
    />
  );
}

function renderParticipant(
  choices: Record<string, 'YES' | 'IF_NEEDED' | 'NO' | undefined>,
  actorPersonPublicId = PARTICIPANT,
  state: CalendarSchedulingPollDetails['poll']['state'] = 'OPEN'
) {
  return renderToStaticMarkup(
    <CalendarSchedulingPollParticipant
      details={details(state)}
      actorPersonPublicId={actorPersonPublicId}
      choices={choices}
      comment=""
      now={NOW}
      onChoiceChange={vi.fn()}
      onCommentChange={vi.fn()}
      onSubmit={vi.fn()}
    />
  );
}

describe('Calendar scheduling poll components', () => {
  it('shows only valid draft organizer actions before the poll opens', () => {
    const html = renderOrganizer('DRAFT');
    expect(html).toContain('calendar-scheduling-poll-organizer');
    expect(html).toContain('polls.organizer.open');
    expect(html).toContain('polls.organizer.cancel');
    expect(html).not.toContain('polls.organizer.confirm</button>');
  });

  it('offers confirmation only for server-eligible evidence without exposing raw reason codes', () => {
    const html = renderOrganizer('AGREEMENT_REACHED');
    expect(html).toContain('polls.organizer.calendarLabel');
    expect(html).toContain('polls.organizer.confirm');
    expect(html).toContain('polls.organizer.agreementEligible');
    expect(html).toContain('polls.availability.ROOM_UNAVAILABLE');
    expect(html).not.toContain('ACTIVE_ROOM_CONFLICT');
  });

  it('fails closed when the organizer component receives another person identity', () => {
    const html = renderOrganizer('AGREEMENT_REACHED', PARTICIPANT);
    expect(html).toContain('polls.organizer.notOrganizer');
    expect(html).not.toContain('polls.organizer.confirm');
    expect(html).not.toContain('polls.organizer.cancel');
  });

  it('requires a response for every candidate before participant submission', () => {
    const incomplete = renderParticipant({ [CANDIDATE_ONE]: 'YES' });
    expect(incomplete).toContain('polls.votes.YES');
    expect(incomplete).toContain('polls.votes.IF_NEEDED');
    expect(incomplete).toContain('polls.votes.NO');
    expect(incomplete).toContain('polls.participant.completeAll');

    const complete = renderParticipant({
      [CANDIDATE_ONE]: 'YES',
      [CANDIDATE_TWO]: 'IF_NEEDED',
    });
    expect(complete).toContain('polls.participant.submit');
    expect(complete).not.toContain('polls.participant.completeAll');
  });

  it('does not render voting controls for a non-participant or a terminal poll', () => {
    const outsider = renderParticipant({}, ORGANIZER);
    expect(outsider).toContain('polls.participant.notParticipant');
    expect(outsider).not.toContain('polls.votes.YES');

    const confirmed = renderParticipant({}, PARTICIPANT, 'CONFIRMED');
    expect(confirmed).toContain('polls.participant.readOnly.CONFIRMED');
    expect(confirmed).not.toContain('polls.participant.submit');
  });
});
