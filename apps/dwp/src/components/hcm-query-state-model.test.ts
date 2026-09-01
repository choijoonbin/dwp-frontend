import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { resolveHcmQueryFailure } from './hcm-query-state-model';

describe('HCM query failure presentation', () => {
  it('separates permission denials from retryable service failures', () => {
    expect(resolveHcmQueryFailure(new HttpError('denied', 403))).toEqual({
      kind: 'permission',
    });
    expect(resolveHcmQueryFailure(new HttpError('unavailable', 503))).toEqual({
      kind: 'unavailable',
    });
    expect(resolveHcmQueryFailure(new HttpTransportError('TIMEOUT'))).toEqual({
      kind: 'unavailable',
    });
  });

  it('preserves a safe support reference without exposing the server message', () => {
    expect(
      resolveHcmQueryFailure(
        new HttpError('internal route authority detail', 403, {
          detail: { correlationId: 'corr-hcm-123' },
        })
      )
    ).toEqual({ kind: 'permission', reference: 'corr-hcm-123' });
  });

  it('classifies a stale scope separately and treats absent errors as healthy', () => {
    expect(resolveHcmQueryFailure(new HttpError('scope changed', 409))).toEqual({
      kind: 'context-changed',
    });
    expect(resolveHcmQueryFailure(null)).toBeNull();
  });

  it('does not describe a missing HR record as a permission denial', () => {
    expect(resolveHcmQueryFailure(new HttpError('not found', 404))).toEqual({
      kind: 'not-found',
    });
  });
});
