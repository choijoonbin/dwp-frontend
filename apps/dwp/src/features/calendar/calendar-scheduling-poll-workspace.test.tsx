// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  CalendarSchedulingPollWorkspace,
  calendarSchedulingPollNextPageParam,
  calendarSchedulingPollQueryKeys,
  mergeCalendarSchedulingPollPages,
} from './calendar-scheduling-poll-workspace';

import type { Root } from 'react-dom/client';
import type { CalendarSchedulingPollDraft } from './calendar-scheduling-poll-model';
import type {
  CalendarSchedulingPollDetails,
  CalendarSchedulingPollPage,
} from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  auth: {
    user: {
      tenantId: 41,
      userId: 77,
      personPublicId: '00ba0853-02a8-7499-b6d8-009251e6a464' as string | null,
      displayName: 'Minseo Kim',
      tenantCode: 'dwp',
      identityPlane: 'TENANT' as const,
      roles: [],
    },
    isLoading: false,
    isAuthenticated: true,
  },
  calendars: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  open: vi.fn(),
  vote: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  useAuth: () => mocks.auth,
  getCalendars: mocks.calendars,
}));

vi.mock('@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api', () => ({
  listCalendarSchedulingPolls: mocks.list,
  getCalendarSchedulingPoll: mocks.detail,
  createCalendarSchedulingPoll: mocks.create,
  openCalendarSchedulingPoll: mocks.open,
  castCalendarSchedulingPollVotes: mocks.vote,
  cancelCalendarSchedulingPoll: mocks.cancel,
  confirmCalendarSchedulingPoll: mocks.confirm,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));

const NOW = Date.parse('2026-10-28T00:00:00Z');
const POLL_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74ca';
const SECOND_POLL_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74d1';
const CANDIDATE_ONE = '019a3d6e-4be8-779c-8a6d-893fe39b74cb';
const CANDIDATE_TWO = '019a3d6e-4be8-779c-8a6d-893fe39b74cc';
const CALENDAR_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74cd';
const PERSON_ID = '00ba0853-02a8-7499-b6d8-009251e6a464';
const OTHER_PERSON_ID = '00ba0853-02a8-7499-b6d8-009251e6a466';
const PARTICIPANT_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74cf';
const CURSOR_POLL_ID = '019a3d6e-4be8-779c-8a6d-893fe39b74d0';

function pollDetails(
  state: CalendarSchedulingPollDetails['poll']['state'],
  overrides: Partial<CalendarSchedulingPollDetails['poll']> = {}
): CalendarSchedulingPollDetails {
  const agreement = state === 'AGREEMENT_REACHED' || state === 'CONFIRMED';
  return {
    poll: {
      pollId: POLL_ID,
      organizerPersonPublicId: PERSON_ID,
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
          yesCount: agreement ? 1 : 0,
          ifNeededCount: 0,
          noCount: 0,
          agreementEligible: agreement,
        },
        {
          candidateId: CANDIDATE_TWO,
          startsAt: '2026-11-04T01:00:00Z',
          endsAt: '2026-11-04T01:30:00Z',
          resourceId: null,
          yesCount: 0,
          ifNeededCount: agreement ? 1 : 0,
          noCount: 0,
          agreementEligible: agreement,
        },
      ],
      participants: [
        {
          participantId: PARTICIPANT_ID,
          personPublicId: PERSON_ID,
          externalEmail: null,
          displayName: 'Minseo Kim',
          required: true,
          externalVotingEnabled: false,
        },
      ],
      myVotes: agreement
        ? [
            { participantId: PARTICIPANT_ID, candidateId: CANDIDATE_ONE, choice: 'YES' },
            {
              participantId: PARTICIPANT_ID,
              candidateId: CANDIDATE_TWO,
              choice: 'IF_NEEDED',
            },
          ]
        : [],
      expiresAt: '2026-11-02T01:00:00Z',
      confirmedEventId: state === 'CONFIRMED' ? '019a3d6e-4be8-779c-8a6d-893fe39b74d2' : null,
      confirmedCandidateId: state === 'CONFIRMED' ? CANDIDATE_ONE : null,
      version: state === 'DRAFT' ? 0 : state === 'OPEN' ? 1 : state === 'AGREEMENT_REACHED' ? 2 : 3,
      updatedAt: '2026-10-28T00:01:00Z',
      ...overrides,
    },
    availability: [CANDIDATE_ONE, CANDIDATE_TWO].map((candidateId) => ({
      candidateId,
      availabilityState: 'AVAILABLE' as const,
      safeReasonCode: null,
      roomHoldActive: false,
    })),
    holds: [],
  };
}

function page(
  item: CalendarSchedulingPollDetails,
  options: Partial<CalendarSchedulingPollPage> = {}
): CalendarSchedulingPollPage {
  return {
    items: [item],
    nextUpdatedAt: null,
    nextPollId: null,
    hasMore: false,
    ...options,
  };
}

const creationDraft: CalendarSchedulingPollDraft = {
  title: 'Release planning',
  description: 'Choose a time',
  timeZone: 'Asia/Seoul',
  candidates: [
    {
      candidateId: CANDIDATE_ONE,
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
  expiresAt: '2026-11-02T01:00:00Z',
};

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

async function flush(rounds = 6) {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.auth.user = {
    tenantId: 41,
    userId: 77,
    personPublicId: PERSON_ID,
    displayName: 'Minseo Kim',
    tenantCode: 'dwp',
    identityPlane: 'TENANT',
    roles: [],
  };
  mocks.auth.isLoading = false;
  mocks.auth.isAuthenticated = true;
  for (const mock of [
    mocks.calendars,
    mocks.list,
    mocks.detail,
    mocks.create,
    mocks.open,
    mocks.vote,
    mocks.cancel,
    mocks.confirm,
  ]) {
    mock.mockReset();
  }
  mocks.calendars.mockResolvedValue([
    {
      calendarId: CALENDAR_ID,
      name: 'My calendar',
      capabilities: { canCreateEvents: true },
    },
  ]);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

async function renderWorkspace(
  props: Partial<React.ComponentProps<typeof CalendarSchedulingPollWorkspace>> = {}
) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <CalendarSchedulingPollWorkspace now={NOW} {...props} />
      </QueryClientProvider>
    );
  });
  await flush();
}

describe('CalendarSchedulingPollWorkspace', () => {
  it('guards repeated or incomplete pagination and keeps the newest unique poll', () => {
    const first = pollDetails('OPEN');
    const newer = pollDetails('AGREEMENT_REACHED');
    const cursor = { afterUpdatedAt: '2026-10-28T00:01:00Z', afterPollId: CURSOR_POLL_ID };
    expect(
      calendarSchedulingPollNextPageParam(
        page(first, {
          hasMore: true,
          nextUpdatedAt: cursor.afterUpdatedAt,
          nextPollId: cursor.afterPollId,
        }),
        [null]
      )
    ).toEqual(cursor);
    expect(
      calendarSchedulingPollNextPageParam(
        page(first, {
          hasMore: true,
          nextUpdatedAt: cursor.afterUpdatedAt,
          nextPollId: cursor.afterPollId,
        }),
        [null, cursor]
      )
    ).toBeUndefined();
    expect(
      calendarSchedulingPollNextPageParam(page(first, { hasMore: true }), [null])
    ).toBeUndefined();
    expect(mergeCalendarSchedulingPollPages([page(first), page(newer)])).toHaveLength(1);
    expect(mergeCalendarSchedulingPollPages([page(first), page(newer)])[0]?.poll.version).toBe(2);
    expect(calendarSchedulingPollQueryKeys('41:77:person').list).toEqual([
      'calendar',
      'scheduling-polls',
      '41:77:person',
      'list',
    ]);
  });

  it('loads bounded pages and detail under an exact identity-scoped cache key', async () => {
    const first = pollDetails('OPEN');
    const second = pollDetails('OPEN', {
      pollId: SECOND_POLL_ID,
      title: 'Second poll',
      version: 1,
    });
    mocks.list
      .mockResolvedValueOnce(
        page(first, {
          hasMore: true,
          nextUpdatedAt: '2026-10-28T00:01:00Z',
          nextPollId: CURSOR_POLL_ID,
        })
      )
      .mockResolvedValueOnce(page(second));
    mocks.detail.mockResolvedValue(first);

    await renderWorkspace();
    expect(mocks.list).toHaveBeenNthCalledWith(
      1,
      { afterUpdatedAt: undefined, afterPollId: undefined, limit: 25 },
      expect.any(AbortSignal)
    );
    expect(mocks.detail).toHaveBeenCalledWith(POLL_ID, expect.any(AbortSignal));
    expect(
      client.getQueryCache().findAll({
        queryKey: ['calendar', 'scheduling-polls', `41:77:${PERSON_ID}`],
      })
    ).not.toHaveLength(0);

    await act(async () => button(container, 'actions.loadMore')?.click());
    await flush();
    expect(mocks.list).toHaveBeenNthCalledWith(
      2,
      {
        afterUpdatedAt: '2026-10-28T00:01:00Z',
        afterPollId: CURSOR_POLL_ID,
        limit: 25,
      },
      expect.any(AbortSignal)
    );
    expect(container.textContent).toContain('Second poll');

    const previousIdentity = `41:77:${PERSON_ID}`;
    mocks.auth.user = {
      ...mocks.auth.user,
      userId: 78,
      personPublicId: OTHER_PERSON_ID,
    };
    mocks.list.mockResolvedValueOnce(page(second));
    await renderWorkspace();
    expect(
      client.getQueryCache().findAll({
        queryKey: ['calendar', 'scheduling-polls', previousIdentity],
      })
    ).toHaveLength(0);
    expect(
      client.getQueryCache().findAll({
        queryKey: ['calendar', 'scheduling-polls', `41:78:${OTHER_PERSON_ID}`],
      })
    ).not.toHaveLength(0);
  });

  it('creates, opens, and cancels with one stable create intent and current versions', async () => {
    let server = pollDetails('DRAFT');
    mocks.list.mockImplementation(async () => page(server));
    mocks.detail.mockImplementation(async () => server);
    mocks.create.mockImplementation(async () => server);
    mocks.open.mockImplementation(async () => {
      server = pollDetails('OPEN');
      return server;
    });
    mocks.cancel.mockImplementation(async () => {
      server = pollDetails('CANCELLED', { version: 2 });
      return server;
    });
    const onCreated = vi.fn();

    await renderWorkspace({ creationDraft, onCreated });
    await act(async () => button(container, 'polls.workspace.create')?.click());
    await flush();
    expect(container.textContent).toContain('polls.creator.externalUnsupported');
    await act(async () => button(container, 'polls.creator.submit')?.click());
    await flush();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      title: 'Release planning',
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/u),
    });
    expect(onCreated).toHaveBeenCalledWith(server);

    await act(async () => button(container, 'polls.organizer.open')?.click());
    await flush();
    expect(mocks.open).toHaveBeenCalledWith(POLL_ID, 0);

    await act(async () => button(container, 'polls.organizer.cancel')?.click());
    await flush();
    expect(mocks.cancel).toHaveBeenCalledWith(POLL_ID, 1);
  });

  it('casts a complete internal vote and confirms the agreed candidate into a calendar', async () => {
    let server = pollDetails('OPEN');
    const eventsKey = ['calendar', 'events', 'test-range'] as const;
    const eventsV2Key = ['calendar', 'events-v2', 'test-range'] as const;
    client.setQueryData(eventsKey, []);
    client.setQueryData(eventsV2Key, []);
    mocks.list.mockImplementation(async () => page(server));
    mocks.detail.mockImplementation(async () => server);
    mocks.vote.mockImplementation(async () => {
      server = pollDetails('AGREEMENT_REACHED');
      return server;
    });
    mocks.confirm.mockImplementation(async () => {
      server = pollDetails('CONFIRMED');
      return server;
    });

    await renderWorkspace();
    const firstYes = container.querySelector<HTMLInputElement>(
      `input[name$="${CANDIDATE_ONE}"][value="YES"]`
    );
    const secondIfNeeded = container.querySelector<HTMLInputElement>(
      `input[name$="${CANDIDATE_TWO}"][value="IF_NEEDED"]`
    );
    await act(async () => firstYes?.click());
    await act(async () => secondIfNeeded?.click());
    await flush();
    expect(button(container, 'polls.participant.submit')?.disabled).toBe(false);

    await act(async () => button(container, 'polls.participant.submit')?.click());
    await flush();
    expect(mocks.vote).toHaveBeenCalledWith(
      POLL_ID,
      expect.objectContaining({
        votes: [
          { candidateId: CANDIDATE_ONE, choice: 'YES' },
          { candidateId: CANDIDATE_TWO, choice: 'IF_NEEDED' },
        ],
        idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      })
    );
    expect(mocks.calendars).toHaveBeenCalled();
    expect(button(container, 'polls.organizer.confirm')?.disabled).toBe(false);

    await act(async () => button(container, 'polls.organizer.confirm')?.click());
    await flush();
    expect(mocks.confirm).toHaveBeenCalledWith(
      POLL_ID,
      expect.objectContaining({
        candidateId: CANDIDATE_ONE,
        calendarId: CALENDAR_ID,
        version: 2,
        idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      })
    );
    expect(client.getQueryState(eventsKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(eventsV2Key)?.isInvalidated).toBe(true);
  });

  it('fails closed on missing identity or authoritative denial and shows recoverable outage state', async () => {
    mocks.auth.user = { ...mocks.auth.user, personPublicId: null };
    await renderWorkspace();
    expect(container.textContent).toContain('polls.workspace.denied');
    expect(mocks.list).not.toHaveBeenCalled();

    mocks.auth.user = { ...mocks.auth.user, personPublicId: PERSON_ID };
    mocks.list.mockRejectedValue(new HttpError('Forbidden', 403));
    await renderWorkspace();
    expect(container.textContent).toContain('polls.workspace.denied');
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: ['calendar', 'scheduling-polls', `41:77:${PERSON_ID}`] })
        .every((query) => query.state.data === undefined)
    ).toBe(true);

    mocks.auth.user = {
      ...mocks.auth.user,
      userId: 78,
      personPublicId: OTHER_PERSON_ID,
    };
    mocks.list.mockReset().mockRejectedValue(new HttpError('Unavailable', 503));
    await renderWorkspace();
    expect(container.textContent).toContain('polls.workspace.unavailable');
    expect(button(container, 'actions.retry')).toBeDefined();
  });
});
