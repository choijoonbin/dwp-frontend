import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  calendarReadSourceData,
  calendarReadSourceState,
  combineCalendarReadSourceStates,
  isAuthoritativeCalendarReadFailure,
  isRecoverableCalendarReadFailure,
  retryRecoverableCalendarRead,
} from './calendar-read-source-state';

function failedSnapshot(error: unknown, data: string | undefined = 'cached calendar') {
  return {
    data,
    error,
    failureCount: 1,
    failureReason: error,
    isError: true,
    isPending: false,
  };
}

describe('Calendar read-source authority policy', () => {
  it.each([
    new HttpError('signed out', 401),
    new HttpError('forbidden', 403),
    new HttpError('hidden resource', 404),
    new HttpError('stale revision', 409, { errorCode: 'DECISION_REVISION_CONFLICT' }),
    new HttpError('expired scope', 409, { reasonCode: 'SCOPE_CONTEXT_EXPIRED' }),
    new HttpError('authority unavailable', 503, {
      code: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
    }),
  ])('purges cached calendar data after authoritative failure %#', (error) => {
    expect(isAuthoritativeCalendarReadFailure(error)).toBe(true);
    const state = calendarReadSourceState(failedSnapshot(error));
    expect(state).toBe('DENIED');
    expect(calendarReadSourceData(state, 'cached calendar')).toBeUndefined();
    expect(retryRecoverableCalendarRead(0, error)).toBe(false);
  });

  it.each([
    new HttpError('service unavailable', 503),
    new HttpError('rate limited', 429),
    new HttpTransportError('NETWORK'),
  ])('keeps last-known data read-only for recoverable failure %#', (error) => {
    const state = calendarReadSourceState(failedSnapshot(error));
    expect(state).toBe('STALE');
    expect(calendarReadSourceData(state, 'cached calendar')).toBe('cached calendar');
    expect(isRecoverableCalendarReadFailure(error)).toBe(true);
    expect(retryRecoverableCalendarRead(0, error)).toBe(true);
    expect(retryRecoverableCalendarRead(1, error)).toBe(false);
  });

  it.each([
    new HttpError('invalid range', 400),
    new HttpError('unrelated conflict', 409, { errorCode: 'EVENT_VERSION_CONFLICT' }),
    new HttpError('invalid filter', 422),
    new Error('unexpected client failure'),
  ])('hides cached data without retry for deterministic read failure %#', (error) => {
    expect(isAuthoritativeCalendarReadFailure(error)).toBe(false);
    expect(isRecoverableCalendarReadFailure(error)).toBe(false);
    const state = calendarReadSourceState(failedSnapshot(error));
    expect(state).toBe('UNAVAILABLE');
    expect(calendarReadSourceData(state, 'cached calendar')).toBeUndefined();
    expect(retryRecoverableCalendarRead(0, error)).toBe(false);
  });

  it('distinguishes initial loading and unavailable states without inventing data', () => {
    expect(
      calendarReadSourceState({
        data: undefined,
        error: null,
        isError: false,
        isPending: true,
      })
    ).toBe('LOADING');
    expect(
      calendarReadSourceState({
        data: undefined,
        error: new HttpTransportError('TIMEOUT'),
        failureCount: 1,
        isError: true,
        isPending: false,
      })
    ).toBe('UNAVAILABLE');
  });

  it('combines multiple calendar sources with fail-closed priority', () => {
    expect(combineCalendarReadSourceStates(['READY', 'STALE'])).toBe('STALE');
    expect(combineCalendarReadSourceStates(['LOADING', 'READY'])).toBe('LOADING');
    expect(combineCalendarReadSourceStates(['STALE', 'DENIED'])).toBe('DENIED');
    expect(combineCalendarReadSourceStates(['READY', 'UNAVAILABLE'])).toBe('UNAVAILABLE');
  });
});
