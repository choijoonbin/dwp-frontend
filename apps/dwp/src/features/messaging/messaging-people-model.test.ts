import { describe, expect, it } from 'vitest';

import {
  canLoadNextMessagingPeoplePage,
  collectMessagingPeople,
  filterMessagingPeoplePresence,
  mergeMessagingPeopleFilters,
  nextMessagingPeoplePageParam,
  readMessagingPeopleFilters,
} from './messaging-people-model';

import type {
  MessagingPeoplePage,
  MessagingPerson,
} from '@dwp-frontend/shared-utils/api/messaging-api';

const person = (
  userId: number,
  presenceState: MessagingPerson['presenceState']
): MessagingPerson => ({
  userId,
  emailAddress: `person${userId}@example.com`,
  displayName: `Person ${userId}`,
  presenceState,
});

const page = (items: MessagingPerson[]): MessagingPeoplePage => ({
  items,
  total: 4,
  hasMore: false,
  nextCursor: null,
  nextOffset: null,
  presence: {
    authority: 'LIVE',
    evaluatedAt: '2026-10-27T07:00:00Z',
    leaseTtlSeconds: 75,
    refreshAfterSeconds: 20,
  },
});

describe('messaging people directory model', () => {
  it('round-trips filters in the URL while preserving unrelated route state', () => {
    const initial = new URLSearchParams('conversation=room-1&q=old');
    const updated = mergeMessagingPeopleFilters(initial, {
      query: 'Kim',
      organization: 'Risk',
      jobTitle: 'Analyst',
      presence: 'AVAILABLE',
    });

    expect(updated.get('conversation')).toBe('room-1');
    expect(readMessagingPeopleFilters(updated)).toEqual({
      query: 'Kim',
      organization: 'Risk',
      jobTitle: 'Analyst',
      presence: 'AVAILABLE',
    });

    const cleared = mergeMessagingPeopleFilters(updated, {
      query: '',
      organization: '',
      jobTitle: '',
      presence: 'ALL',
    });
    expect(cleared.toString()).toBe('conversation=room-1');
  });

  it('deduplicates keyset pages and reapplies presence after browser masking', () => {
    const people = collectMessagingPeople([
      page([person(1, 'AVAILABLE'), person(2, 'OFFLINE')]),
      page([person(2, 'AVAILABLE'), person(3, 'UNKNOWN')]),
    ]);

    expect(people.map(({ userId }) => userId)).toEqual([1, 2, 3]);
    expect(filterMessagingPeoplePresence(people, 'AVAILABLE').map(({ userId }) => userId)).toEqual([
      1, 2,
    ]);
  });

  it('fails unknown URL presence values back to the unfiltered contract', () => {
    expect(readMessagingPeopleFilters(new URLSearchParams('presence=BUSY')).presence).toBe('ALL');
  });

  it('continues from the server cursor only after an in-flight refresh settles', () => {
    const firstPage = {
      ...page([person(1, 'AVAILABLE')]),
      hasMore: true,
      nextCursor: '30',
      nextOffset: 30,
    };

    expect(nextMessagingPeoplePageParam(firstPage)).toBe('30');
    expect(canLoadNextMessagingPeoplePage({ hasNextPage: true, isFetching: true })).toBe(false);
    expect(canLoadNextMessagingPeoplePage({ hasNextPage: true, isFetching: false })).toBe(true);
  });
});
