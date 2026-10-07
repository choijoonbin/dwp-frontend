import { afterEach, describe, expect, it, vi } from 'vitest';

import { getHrisSystemSnapshot } from '../api/hris-system-api';

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HRIS system owner transport', () => {
  it('puts the fixed system discriminator on the wire before the opaque scope', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ tenantId: 7 }))
      .mockResolvedValueOnce(response({ tenantId: 7 }));
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    await getHrisSystemSnapshot('scope:hcm/settings-west', signal);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/hris/product-access/snapshot?view=system&contextScopeKey=scope%3Ahcm%2Fsettings-west',
      '/api/platform/v1/hris/configuration/projection?view=system&contextScopeKey=scope%3Ahcm%2Fsettings-west',
    ]);
    expect(
      fetchMock.mock.calls.every(([, init]) => (init as RequestInit).signal instanceof AbortSignal)
    ).toBe(true);
  });
});
