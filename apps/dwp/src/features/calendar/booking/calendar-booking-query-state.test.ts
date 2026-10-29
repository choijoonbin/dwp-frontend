import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  calendarBookingMutationAllowed,
  calendarBookingQueryState,
  calendarBookingShouldPurge,
  calendarBookingVisibleData,
  combineCalendarBookingQueryStates,
  isCalendarBookingAuthorityFailure,
  isCalendarBookingVersionConflict,
  retryCalendarBookingRead,
} from './calendar-booking-query-state';

const options = { enabled: true, empty: (data: unknown[]) => data.length === 0 };

describe('calendar booking query state', () => {
  it('represents loading, empty, ready and partial explicitly', () => {
    expect(
      calendarBookingQueryState(
        { data: undefined, error: null, isError: false, isPending: true },
        options
      )
    ).toBe('LOADING');
    expect(
      calendarBookingQueryState(
        { data: [], error: null, isError: false, isPending: false },
        options
      )
    ).toBe('EMPTY');
    expect(
      calendarBookingQueryState(
        { data: [1], error: null, isError: false, isPending: false },
        options
      )
    ).toBe('READY');
    expect(
      calendarBookingQueryState(
        { data: [1], error: null, isError: false, isPending: false },
        { ...options, partial: () => true }
      )
    ).toBe('PARTIAL');
  });

  it.each([
    new HttpError('signed out', 401),
    new HttpError('forbidden', 403),
    new HttpError('missing', 404),
    new HttpError('scope expired', 409, { reasonCode: 'SCOPE_CONTEXT_EXPIRED' }),
    new HttpError('resolver down', 503, { errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
  ])('treats authority loss as denied and purge-worthy', (error) => {
    expect(isCalendarBookingAuthorityFailure(error)).toBe(true);
    const state = calendarBookingQueryState(
      { data: [1], error, isError: true, isPending: false },
      options
    );
    expect(state).toBe('DENIED');
    expect(calendarBookingShouldPurge(state)).toBe(true);
    expect(calendarBookingVisibleData(state, [1])).toBeUndefined();
  });

  it('shows recoverable cached reads as stale but disallows writes', () => {
    const error = new HttpTransportError('NETWORK');
    const state = calendarBookingQueryState(
      { data: [1], error, isError: true, isPending: false },
      options
    );
    expect(state).toBe('STALE');
    expect(calendarBookingVisibleData(state, [1])).toEqual([1]);
    expect(calendarBookingMutationAllowed([state])).toBe(false);
    expect(retryCalendarBookingRead(0, error)).toBe(true);
    expect(retryCalendarBookingRead(1, error)).toBe(false);
  });

  it('fails writes closed for partial, stale, denied, version mismatch and disabled sources', () => {
    expect(calendarBookingMutationAllowed(['READY', 'EMPTY'])).toBe(true);
    expect(calendarBookingMutationAllowed(['READY', 'PARTIAL'])).toBe(false);
    expect(calendarBookingMutationAllowed(['READY'], false)).toBe(false);
    expect(calendarBookingShouldPurge('DISABLED')).toBe(true);
  });

  it('combines dependent reads with fail-closed precedence and treats one empty source as ready', () => {
    expect(combineCalendarBookingQueryStates(['READY', 'EMPTY'])).toBe('READY');
    expect(combineCalendarBookingQueryStates(['EMPTY', 'EMPTY'])).toBe('EMPTY');
    expect(combineCalendarBookingQueryStates(['READY', 'STALE', 'LOADING'])).toBe('STALE');
    expect(combineCalendarBookingQueryStates(['READY', 'DENIED', 'UNAVAILABLE'])).toBe('DENIED');
  });

  it('separates ordinary optimistic conflicts from authority conflicts', () => {
    const version = new HttpError('changed', 409, { code: 'VERSION_CONFLICT' });
    const scope = new HttpError('expired', 409, { code: 'SCOPE_CONTEXT_EXPIRED' });
    expect(isCalendarBookingVersionConflict(version)).toBe(true);
    expect(isCalendarBookingAuthorityFailure(version)).toBe(false);
    expect(isCalendarBookingVersionConflict(scope)).toBe(false);
    expect(isCalendarBookingAuthorityFailure(scope)).toBe(true);
  });
});
