import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance, HttpError } from '@dwp-frontend/shared-utils';

import { createPer008AxiosTransport } from './per008-axios-adapter';

const SCOPE = 'tenant-a:user-a:role-a';
const CORRELATION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function transport() {
  return createPer008AxiosTransport({
    contextScopeKey: SCOPE,
    signal: new AbortController().signal,
    timeoutMs: 3210,
    mutationAuthority: () => ({
      mode: 'SECURE', rolloutState: '110', contextKey: 'per008:create', contextScopeKey: SCOPE,
      expectedDecisionRevision: 'auth-1', idempotencyKey: 'per008-command-key-0001',
    }),
  });
}

describe('PER-008 shared axios adapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('applies read scope and unwraps the standard ApiResponse exactly once', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({
      data: { status: 'SUCCESS', data: { schemaVersion: '1' } },
    });
    await expect(transport()('/api/owner', { method: 'GET', headers: {} }))
      .resolves.toEqual({ status: 200, data: { schemaVersion: '1' } });
    expect(get).toHaveBeenCalledWith('/api/owner', expect.objectContaining({
      contextScopeKey: SCOPE, timeoutMs: 3210,
    }));
  });

  it('preserves status, problem code and correlation from a standard error envelope', async () => {
    vi.spyOn(axiosInstance, 'get').mockRejectedValue(new HttpError('threshold', 422, {
      status: 'ERROR', message: 'suppressed', data: null,
      errorCode: 'FEEDBACK_RELEASE_THRESHOLD_NOT_MET', correlationId: CORRELATION,
    }));
    await expect(transport()('/api/owner', { method: 'GET', headers: {} })).resolves.toEqual({
      status: 422,
      data: { code: 'FEEDBACK_RELEASE_THRESHOLD_NOT_MET', correlationId: CORRELATION, retryable: false },
    });
  });

  it('rejects authority/header drift before dispatching a governed mutation', async () => {
    const post = vi.spyOn(axiosInstance, 'post');
    await expect(transport()('/api/owner', { method: 'POST', headers: {
      'Idempotency-Key': 'different-key-0000001',
      'X-DWP-Expected-Decision-Revision': 'auth-1',
      'Content-Type': 'application/json',
    }, body: '{}' })).rejects.toThrow('PER008_GOVERNED_MUTATION_AUTHORITY_MISMATCH');
    expect(post).not.toHaveBeenCalled();
  });
});
