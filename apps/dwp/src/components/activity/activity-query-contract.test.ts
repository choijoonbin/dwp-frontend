import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  ACTIVITY_RUNNING_REFRESH_INTERVAL_MS,
  activityDetailRefetchOnWindowFocus,
  activityDetailRefreshInterval,
  activityDetailStaleTime,
  isAuthoritativeActivityDenial,
  isAuthoritativeActivityRootDenial,
  usableActivityQueryData,
} from './activity-query-contract';

describe('Activity query contract', () => {
  const data = { title: 'last verified value' };

  it('preserves successful data across transient refresh failure', () => {
    expect(
      usableActivityQueryData({
        data,
        isError: true,
        error: new HttpError('temporarily unavailable', 503),
      })
    ).toBe(data);
  });

  it.each([401, 403, 404])('immediately hides cached data after authoritative %s', (status) => {
    const error = new HttpError('no longer available', status);
    expect(isAuthoritativeActivityDenial(error)).toBe(true);
    expect(usableActivityQueryData({ data, isError: true, error })).toBeUndefined();
  });

  it('keeps route-local 404 separate from the shared root authorization boundary', () => {
    expect(isAuthoritativeActivityRootDenial(new HttpError('signed out', 401))).toBe(true);
    expect(isAuthoritativeActivityRootDenial(new HttpError('access revoked', 403))).toBe(true);
    expect(isAuthoritativeActivityRootDenial(new HttpError('event removed', 404))).toBe(false);
  });

  it('polls active event detail and leaves terminal detail immutable', () => {
    expect(activityDetailRefreshInterval({ state: 'running' })).toBe(
      ACTIVITY_RUNNING_REFRESH_INTERVAL_MS
    );
    expect(activityDetailStaleTime({ state: 'running' })).toBe(15_000);
    expect(activityDetailRefetchOnWindowFocus({ state: 'running' })).toBe(true);
    expect(activityDetailRefreshInterval({ state: 'completed' })).toBe(false);
    expect(activityDetailStaleTime({ state: 'completed' })).toBe(Infinity);
    expect(activityDetailRefetchOnWindowFocus({ state: 'completed' })).toBe(false);
  });
});
