import { describe, expect, it } from 'vitest';

import {
  calendarEventSearchResults,
  normalizeCalendarEventSearchQuery,
  validateCalendarEventSearchQuery,
} from './calendar-event-search-model';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

const event = {
  eventId: 'event-1',
  startsAt: '2026-10-28T01:00:00Z',
  recurrenceId: '2026-10-28T01:00:00Z',
} as CalendarEvent;

describe('Calendar event search model', () => {
  it('matches the server NFKC, Unicode whitespace, and lower-case query contract', () => {
    expect(normalizeCalendarEventSearchQuery('  ＴＥＡＭ\u3000Sync\nReview  ')).toBe(
      'team sync review'
    );
    expect(validateCalendarEventSearchQuery('한')).toEqual({
      valid: false,
      reason: 'TOO_SHORT',
      query: '한',
    });
    expect(validateCalendarEventSearchQuery('회의')).toEqual({ valid: true, query: '회의' });
    expect(validateCalendarEventSearchQuery('a'.repeat(121))).toMatchObject({
      valid: false,
      reason: 'TOO_LONG',
    });
  });

  it('deduplicates stable occurrence identities and hides all cached rows after failure', () => {
    expect(calendarEventSearchResults([{ items: [event] }, { items: [event] }], false)).toEqual([
      event,
    ]);
    expect(calendarEventSearchResults([{ items: [event] }], true)).toEqual([]);
  });
});
