import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { isAuthoritativeWorkplaceReadFailure } from './workplace-authority-failure';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';

describe('workplace home source state', () => {
  it.each([401, 403, 404])('discards cached data after authoritative HTTP %s', (status) => {
    const data = { confidential: 'cached value' };
    const state = workplaceHomeSourceState({
      data,
      error: new HttpError('denied', status),
      isError: true,
      isPending: false,
      required: true,
    });

    expect(state).toBe('DENIED');
    expect(workplaceHomeSourceData(state, data)).toBeUndefined();
  });

  it('keeps last-known-good data only for a recoverable transport or server failure', () => {
    const data = { verified: true };
    const state = workplaceHomeSourceState({
      data,
      error: new HttpError('temporary failure', 502),
      isError: true,
      isPending: false,
      required: true,
    });

    expect(state).toBe('STALE');
    expect(workplaceHomeSourceData(state, data)).toBe(data);
  });

  it('treats expired scope and unavailable authority as fail-closed', () => {
    expect(
      isAuthoritativeWorkplaceReadFailure(
        new HttpError('expired', 409, { reasonCode: 'SCOPE_CONTEXT_EXPIRED' })
      )
    ).toBe(true);
    expect(
      isAuthoritativeWorkplaceReadFailure(
        new HttpError('unavailable', 503, { code: 'AUTHORITY_RESOLUTION_UNAVAILABLE' })
      )
    ).toBe(true);
  });
});
