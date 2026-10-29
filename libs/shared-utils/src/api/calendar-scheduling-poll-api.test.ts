import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  cancelCalendarSchedulingPoll,
  castCalendarSchedulingPollVotes,
  confirmCalendarSchedulingPoll,
  createCalendarSchedulingPoll,
  listCalendarSchedulingPolls,
  openCalendarSchedulingPoll,
  type CalendarSchedulingPollDetails,
  type CreateCalendarSchedulingPollInput,
} from './calendar-scheduling-poll-api';

const POLL_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74ca';
const CANDIDATE_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74cb';
const PERSON_ID = '00ba0853-02a8-7499-b6d8-009251e6a464';
const CALENDAR_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74cc';
const COMMAND_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74cd';

const details = { poll: { pollId: POLL_ID } } as CalendarSchedulingPollDetails;

const createInput: CreateCalendarSchedulingPollInput = {
  title: 'Release planning',
  description: 'Choose a time',
  timeZone: 'Asia/Seoul',
  candidates: [
    {
      candidateId: CANDIDATE_ID,
      startsAt: '2026-11-03T01:00:00Z',
      endsAt: '2026-11-03T01:30:00Z',
      resourceId: null,
    },
  ],
  participants: [
    {
      personPublicId: PERSON_ID,
      externalEmail: null,
      displayName: 'Minseo Kim',
      required: true,
    },
  ],
  expiresAt: '2026-11-03T00:00:00Z',
  idempotencyKey: COMMAND_ID,
};

describe('calendar scheduling poll API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses both bounded keyset cursor fields and a private no-cache read', async () => {
    const page = {
      items: [],
      nextUpdatedAt: null,
      nextPollId: null,
      hasMore: false,
    };
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: page } });

    await expect(
      listCalendarSchedulingPolls({
        afterUpdatedAt: '2026-10-28T01:02:03Z',
        afterPollId: POLL_ID,
        limit: 25,
      })
    ).resolves.toEqual(page);
    expect(get).toHaveBeenCalledWith(
      `/api/platform/v1/calendar/scheduling-polls?afterUpdatedAt=2026-10-28T01%3A02%3A03Z&afterPollId=${POLL_ID}&limit=25`,
      { signal: undefined, headers: { 'Cache-Control': 'no-cache' } }
    );
  });

  it('fails before transport for a partial cursor or an out-of-range page size', async () => {
    const get = vi.spyOn(axiosInstance, 'get');
    await expect(listCalendarSchedulingPolls({ afterPollId: POLL_ID })).rejects.toThrow(
      'cursor fields'
    );
    await expect(listCalendarSchedulingPolls({ limit: 51 })).rejects.toThrow('between 1 and 50');
    expect(get).not.toHaveBeenCalled();
  });

  it('posts only verified internal-person participants', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: details } });

    await expect(createCalendarSchedulingPoll(createInput)).resolves.toBe(details);
    expect(post).toHaveBeenCalledWith('/api/platform/v1/calendar/scheduling-polls', createInput, {
      signal: undefined,
      headers: { 'Cache-Control': 'no-cache' },
    });

    const unsafe = {
      ...createInput,
      participants: [
        {
          personPublicId: PERSON_ID,
          externalEmail: 'guest@example.com',
          displayName: 'Guest',
          required: true,
        },
      ],
    } as unknown as CreateCalendarSchedulingPollInput;
    await expect(createCalendarSchedulingPoll(unsafe)).rejects.toThrow('not enabled');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('binds lifecycle commands to the current optimistic version', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: details } });

    await openCalendarSchedulingPoll(POLL_ID, 7);
    await cancelCalendarSchedulingPoll(POLL_ID, 8);

    expect(post).toHaveBeenNthCalledWith(
      1,
      `/api/platform/v1/calendar/scheduling-polls/${POLL_ID}/open`,
      { state: 'OPEN', version: 7 },
      { signal: undefined, headers: { 'Cache-Control': 'no-cache' } }
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/api/platform/v1/calendar/scheduling-polls/${POLL_ID}/cancel`,
      { state: 'CANCELLED', version: 8 },
      { signal: undefined, headers: { 'Cache-Control': 'no-cache' } }
    );
  });

  it('keeps vote and confirmation idempotency in their exact request bodies', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: details } });
    const votes = {
      votes: [{ candidateId: CANDIDATE_ID, choice: 'YES' as const }],
      comment: null,
      idempotencyKey: COMMAND_ID,
    };
    const confirmation = {
      candidateId: CANDIDATE_ID,
      calendarId: CALENDAR_ID,
      idempotencyKey: COMMAND_ID,
      version: 9,
    };

    await castCalendarSchedulingPollVotes(POLL_ID, votes);
    await confirmCalendarSchedulingPoll(POLL_ID, confirmation);

    expect(post).toHaveBeenNthCalledWith(
      1,
      `/api/platform/v1/calendar/scheduling-polls/${POLL_ID}/votes`,
      votes,
      { signal: undefined, headers: { 'Cache-Control': 'no-cache' } }
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/api/platform/v1/calendar/scheduling-polls/${POLL_ID}/confirm`,
      confirmation,
      { signal: undefined, headers: { 'Cache-Control': 'no-cache' } }
    );
  });

  it('rejects non-canonical route and command identifiers before transport', async () => {
    const post = vi.spyOn(axiosInstance, 'post');
    await expect(openCalendarSchedulingPoll('../public', 0)).rejects.toThrow('canonical UUID');
    await expect(
      castCalendarSchedulingPollVotes(POLL_ID, {
        votes: [
          { candidateId: CANDIDATE_ID, choice: 'YES' },
          { candidateId: CANDIDATE_ID, choice: 'NO' },
        ],
        comment: null,
        idempotencyKey: COMMAND_ID,
      })
    ).rejects.toThrow('unique candidates');
    await expect(
      castCalendarSchedulingPollVotes(POLL_ID, {
        votes: [{ candidateId: CANDIDATE_ID, choice: 'MAYBE' as 'YES' }],
        comment: null,
        idempotencyKey: COMMAND_ID,
      })
    ).rejects.toThrow('choice is invalid');
    expect(post).not.toHaveBeenCalled();
  });
});
