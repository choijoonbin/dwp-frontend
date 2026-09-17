import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  approvalAdminV2CommandFailureState,
  approvalAdminV2CommandErrorState,
  approvalAdminV2CommandReady,
  approvalAdminV2SourceState,
  retryApprovalAdminV2Read,
} from './approval-admin-v2-runtime-model';

function source(overrides: Partial<Parameters<typeof approvalAdminV2SourceState>[0]> = {}) {
  return {
    data: undefined,
    error: null,
    failureReason: null,
    failureCount: 0,
    isError: false,
    isPending: false,
    isFetching: false,
    ...overrides,
  };
}

describe('Approval admin V2 source policy', () => {
  it.each([401, 403, 409, 503])('never automatically retries status %s', (status) => {
    expect(retryApprovalAdminV2Read(0, new HttpError('closed', status))).toBe(false);
  });

  it('allows only one retry for an unclassified transient failure', () => {
    expect(retryApprovalAdminV2Read(0, new Error('network'))).toBe(true);
    expect(retryApprovalAdminV2Read(1, new Error('network'))).toBe(false);
  });

  it('keeps cached records visible as stale after the first failed refresh', () => {
    expect(
      approvalAdminV2SourceState(
        source({ data: { records: ['kept'] }, failureCount: 1, failureReason: new Error('down') }),
        true,
        () => false
      )
    ).toBe('stale');
  });

  it('distinguishes forbidden, conflict, unavailable and empty states', () => {
    const classify = (status: number) =>
      approvalAdminV2SourceState(
        source({ isError: true, error: new HttpError('closed', status) }),
        true,
        () => false
      );
    expect(classify(403)).toBe('forbidden');
    expect(classify(409)).toBe('conflict');
    expect(classify(503)).toBe('unavailable');
    expect(approvalAdminV2SourceState(source({ data: { records: [] } }), true, () => true)).toBe(
      'empty'
    );
  });

  it('enables a supported command only from a ready scoped source', () => {
    expect(approvalAdminV2CommandReady('ready', true, { commandReady: true })).toBe(true);
    expect(approvalAdminV2CommandReady('ready', false, { commandReady: true })).toBe(false);
    expect(approvalAdminV2CommandReady('ready', true, { commandReady: false })).toBe(false);
    expect(approvalAdminV2CommandReady('stale', true, { commandReady: true })).toBe(false);
  });

  it.each([
    [403, 'forbidden'],
    [409, 'conflict'],
    [503, 'unavailable'],
  ] as const)('fails command status %s closed as %s', (status, expected) => {
    expect(approvalAdminV2CommandFailureState(new HttpError('closed', status))).toBe(expected);
  });

  it('classifies a post-dispatch 503 as an unknown outcome without inventing rejection', () => {
    const unavailable = new HttpError('unknown outcome', 503);
    expect(approvalAdminV2CommandErrorState(unavailable, true)).toBe('commandUncertain');
    expect(approvalAdminV2CommandErrorState(unavailable, false)).toBe('authorityUnavailable');
    expect(approvalAdminV2CommandErrorState(new HttpError('conflict', 409), true)).toBe(
      'commandConflict'
    );
  });
});
