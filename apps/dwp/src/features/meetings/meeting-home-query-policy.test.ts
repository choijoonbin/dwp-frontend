import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { meetingHomeQueryRetryDelay, retryMeetingHomeQuery } from './meeting-home-query-policy';

describe('meeting home query retry policy', () => {
  it.each(['NETWORK', 'TIMEOUT'] as const)(
    'retries %s transport failures at most twice',
    (reason) => {
      const error = new HttpTransportError(reason);
      expect(retryMeetingHomeQuery(0, error)).toBe(true);
      expect(retryMeetingHomeQuery(1, error)).toBe(true);
      expect(retryMeetingHomeQuery(2, error)).toBe(false);
    }
  );

  it('does not retry an aborted request', () => {
    expect(retryMeetingHomeQuery(0, new HttpTransportError('ABORT'))).toBe(false);
  });

  it.each([502, 503, 504])('retries transient HTTP %i failures at most twice', (status) => {
    const error = new HttpError('Temporarily unavailable', status);
    expect(retryMeetingHomeQuery(0, error)).toBe(true);
    expect(retryMeetingHomeQuery(1, error)).toBe(true);
    expect(retryMeetingHomeQuery(2, error)).toBe(false);
  });

  it('does not retry authority-resolution unavailability identified by the Meeting error contract', () => {
    const error = new HttpError('Authority unavailable', 503, {
      status: 'ERROR',
      errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
    });
    expect(retryMeetingHomeQuery(0, error)).toBe(false);
  });

  it('does not infer an authority failure from an uncontracted nested error code', () => {
    const error = new HttpError('Temporarily unavailable', 503, {
      data: { errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' },
    });
    expect(retryMeetingHomeQuery(0, error)).toBe(true);
  });

  it.each([
    new HttpError('Unauthorized', 401),
    new HttpError('Forbidden', 403),
    new HttpError('Internal error', 500),
    new HttpError('Not implemented', 501),
    new HttpError('Version not supported', 505),
    new Error('Unexpected binding failure'),
    { status: 503 },
  ])('does not retry non-transient or untyped failures', (error) => {
    expect(retryMeetingHomeQuery(0, error)).toBe(false);
  });

  it('uses bounded one-second and two-second retry delays', () => {
    expect(meetingHomeQueryRetryDelay(0)).toBe(1_000);
    expect(meetingHomeQueryRetryDelay(1)).toBe(2_000);
    expect(meetingHomeQueryRetryDelay(2)).toBe(2_000);
  });
});
