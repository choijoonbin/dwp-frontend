import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpTransportError, resetCsrfToken } from '@dwp-frontend/shared-utils';

import { getScopedPerformanceTalent } from './performance-talent-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('scoped performance Talent API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('uses the exact encoded Gateway path and scoped caller signal', async () => {
    const workspace = { employee: { personId: 'person-1' }, goals: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(workspace));
    vi.stubGlobal('fetch', fetchMock);
    const caller = new AbortController();

    await expect(
      getScopedPerformanceTalent('scope:self/west team', caller.signal)
    ).resolves.toEqual(workspace);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/people/v1/hr/talent?contextScopeKey=scope%3Aself%2Fwest%20team',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('propagates caller abort to the active browser request', async () => {
    const caller = new AbortController();
    let browserSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      browserSignal = init?.signal instanceof AbortSignal ? init.signal : undefined;
      return new Promise<Response>((_resolve, reject) => {
        browserSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true }
        );
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = getScopedPerformanceTalent('scope:self', caller.signal);
    await vi.waitFor(() => expect(browserSignal).toBeInstanceOf(AbortSignal));
    expect(browserSignal).not.toBe(caller.signal);

    caller.abort('scope changed');

    expect(browserSignal?.aborted).toBe(true);
    await expect(request).rejects.toEqual(expect.any(HttpTransportError));
  });
});
