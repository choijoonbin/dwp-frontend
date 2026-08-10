import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { setTenantId } from '../tenant-util';
import { login } from './auth-api';

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('auth login API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('sends company email without the retired username field', async () => {
    setTenantId('default');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { userId: '1', tenantId: '1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await login({ email: 'employee@example.com', password: 'Valid-password-1!' });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      email: 'employee@example.com',
      password: 'Valid-password-1!',
      tenantId: 'default',
    });
    expect(String(request.body)).not.toContain('username');
  });
});
