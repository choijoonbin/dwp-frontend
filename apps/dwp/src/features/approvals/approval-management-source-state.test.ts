import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  approvalManagementSourceState,
  retryApprovalManagementRead,
} from './approval-management-source-state';

const source = {
  data: { version: 1 },
  error: null,
  failureReason: null,
  failureCount: 0,
  isError: false,
  isPending: false,
};

describe('approval management source state', () => {
  it('immediately fences cached writes during the first retry failure', () => {
    expect(approvalManagementSourceState(source)).toBe('READY');
    expect(
      approvalManagementSourceState({
        ...source,
        failureCount: 1,
        failureReason: new HttpError('unavailable', 503),
      })
    ).toBe('STALE');
    expect(
      approvalManagementSourceState({
        ...source,
        failureReason: new HttpError('unavailable', 503),
      })
    ).toBe('STALE');
  });
  it('does not keep cached data ready after authority revocation', () => {
    for (const status of [401, 403, 404]) {
      const error = new HttpError('denied', status);
      expect(
        approvalManagementSourceState({ ...source, failureCount: 1, failureReason: error })
      ).toBe('DENIED');
      expect(retryApprovalManagementRead(0, error)).toBe(false);
    }
    expect(
      approvalManagementSourceState({
        ...source,
        failureCount: 1,
        failureReason: new HttpError('authority', 503, {
          errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
        }),
      })
    ).toBe('DENIED');
  });
  it('distinguishes missing sources from stale retained snapshots', () => {
    expect(approvalManagementSourceState({ ...source, data: undefined, isPending: true })).toBe(
      'LOADING'
    );
    expect(approvalManagementSourceState({ ...source, data: undefined, isError: true })).toBe(
      'UNAVAILABLE'
    );
    expect(approvalManagementSourceState({ ...source, isError: true })).toBe('STALE');
  });
});
