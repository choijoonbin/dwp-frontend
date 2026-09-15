import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import {
  approvalSignatureSourceState,
  retryApprovalSignatureRead,
} from './approval-signature-source-state';

describe('signature current-source verification', () => {
  it.each([401, 403, 404])('first %s masks cached readiness during retry hold', (status) => {
    expect(
      approvalSignatureSourceState({
        data: [{ readiness: 'READY' }],
        failureReason: new HttpError('Denied', status),
        failureCount: 1,
        isFetching: true,
      })
    ).toBe('DENIED');
    expect(retryApprovalSignatureRead(0, new HttpError('Denied', status))).toBe(false);
  });
  it.each(['AUTHORITY_RESOLUTION_UNAVAILABLE', 'TEMPORARY_UNAVAILABLE'])(
    'first 503 %s closes cached readiness without discarding readonly configuration',
    (errorCode) => {
      const error = new HttpError('Unavailable', 503, { errorCode });
      expect(
        approvalSignatureSourceState({
          data: [{ readiness: 'READY' }],
          failureReason: error,
          failureCount: 1,
          isFetching: true,
        })
      ).toBe('STALE');
      expect(retryApprovalSignatureRead(0, error)).toBe(
        errorCode !== 'AUTHORITY_RESOLUTION_UNAVAILABLE'
      );
      expect(retryApprovalSignatureRead(1, error)).toBe(false);
    }
  );
  it('marks any in-flight refetch unknown before failure and recovers only after fresh success', () => {
    expect(approvalSignatureSourceState({ data: [], isFetching: true })).toBe('STALE');
    expect(approvalSignatureSourceState({ data: [], isFetching: false, failureCount: 0 })).toBe(
      'READY'
    );
    expect(approvalSignatureSourceState({ data: [], failureCount: 1 })).toBe('STALE');
  });
  it('distinguishes initial load, empty success and unavailable without fabricating providers', () => {
    expect(
      approvalSignatureSourceState({ data: undefined, isPending: true, isFetching: true })
    ).toBe('LOADING');
    expect(
      approvalSignatureSourceState({ data: undefined, isPending: true, isFetching: false })
    ).toBe('UNAVAILABLE');
    expect(approvalSignatureSourceState({ data: [], isPending: false })).toBe('READY');
    expect(
      approvalSignatureSourceState({ data: undefined, failureReason: new Error('Offline') })
    ).toBe('UNAVAILABLE');
  });
  it('does not retry an expired source scope or trust final error with retained data', () => {
    const error = new HttpError('Expired', 409, { errorCode: 'SCOPE_CONTEXT_EXPIRED' });
    expect(approvalSignatureSourceState({ data: [], failureReason: error })).toBe('DENIED');
    expect(retryApprovalSignatureRead(0, error)).toBe(false);
    expect(approvalSignatureSourceState({ data: [], isError: true })).toBe('STALE');
  });
});
