import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { setTenantId } from '../tenant-util';
import { getAuthPolicy, getLoginOptions } from './auth-policy-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
    headers: new Headers(),
  } as Response;
}

describe('authentication policy API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('keeps public login options separate from the authenticated tenant policy', async () => {
    setTenantId('7');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          localLoginAvailable: true,
          ssoLoginAvailable: false,
          preferredLoginType: 'LOCAL',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          tenantId: 7,
          defaultLoginType: 'LOCAL',
          allowedLoginTypes: ['LOCAL'],
          localLoginEnabled: true,
          ssoLoginEnabled: false,
          requireMfa: true,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getLoginOptions();
    await getAuthPolicy();

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/policy');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/me/policy');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: expect.objectContaining({ 'X-Tenant-ID': '7' }),
    });
  });
});
