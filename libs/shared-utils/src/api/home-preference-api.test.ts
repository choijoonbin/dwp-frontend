import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { setTenantId } from '../tenant-util';
import {
  APPROVAL_HOME_SURFACE_KEY,
  getApprovalHomePreference,
  updateApprovalHomePreference,
} from './home-preference-api';

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('approval home preference API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads only the fixed approval-home surface and does not send a client route key', async () => {
    setTenantId('11');
    const data = { schemaVersion: 5, surfaceKey: APPROVAL_HOME_SURFACE_KEY, version: 3 };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getApprovalHomePreference('scope-self')).resolves.toEqual(data);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/platform/v1/home-preferences/surfaces/${APPROVAL_HOME_SURFACE_KEY}?contextScopeKey=scope-self`
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request).toMatchObject({ method: 'GET', body: undefined });
    expect(request.headers).not.toHaveProperty('X-DWP-Route-Contract-Key');
  });

  it('binds layout and optimistic version to the fixed approval-home update', async () => {
    setTenantId('11');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { schemaVersion: 5, surfaceKey: APPROVAL_HOME_SURFACE_KEY, version: 8 },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    const layout = { appLayout: null, presentation: 'focused' as const, widgets: [] };

    await updateApprovalHomePreference(layout, 7, {
      mode: 'LEGACY_COMPATIBILITY',
      rolloutState: '100',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/platform/v1/home-preferences/surfaces/${APPROVAL_HOME_SURFACE_KEY}`
    );
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.method).toBe('PUT');
    expect(JSON.parse(String(request.body))).toEqual({ layout, version: 7 });
    expect(request.headers).not.toHaveProperty('X-DWP-Route-Contract-Key');
  });
});
