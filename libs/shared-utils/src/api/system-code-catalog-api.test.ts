import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAdminSystemCodeSet,
  getSystemCodeSet,
  listSystemCodeSetHealth,
} from './system-code-catalog-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('system code catalog API boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the reduced runtime route for governed UI choices', async () => {
    const runtimeSet = {
      codeSetKey: 'PLATFORM.PREFERENCE.COLOR_MODE',
      schemaVersion: 1,
      values: [{ code: 'system', label: '시스템' }],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(runtimeSet));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getSystemCodeSet(runtimeSet.codeSetKey, 'ko')).resolves.toEqual(runtimeSet);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/catalog/code-sets/PLATFORM.PREFERENCE.COLOR_MODE?locale=ko',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('keeps inventory and detailed evidence on administrator routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({
          codeSetKey: 'AUTH.BUILT_IN_ROLE',
          schemaVersion: 1,
          values: [],
          bindings: [],
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await listSystemCodeSetHealth();
    await getAdminSystemCodeSet('AUTH.BUILT_IN_ROLE', 'en');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/platform/v1/admin/code-catalog/code-sets',
      '/api/platform/v1/admin/code-catalog/code-sets/AUTH.BUILT_IN_ROLE?locale=en',
    ]);
  });
});
