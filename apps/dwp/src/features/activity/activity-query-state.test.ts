import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  isAuthoritativeActivityDenial,
  isAuthoritativeActivityRootDenial,
  usableActivityQueryData,
} from './activity-query-state';

describe('Activity query cache boundary', () => {
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
});
