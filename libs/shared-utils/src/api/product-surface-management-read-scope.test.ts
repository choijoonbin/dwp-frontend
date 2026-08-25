import { afterEach, describe, expect, it, vi } from 'vitest';

import { listAdminAnnouncements } from './announcement-api';
import {
  getAdminServiceCatalog,
  getServiceManagementCatalog,
  getServiceOperationsQueue,
  getServiceOperationsRequest,
} from './service-center-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('Product Surface management GET scope', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('binds communications management reads to the selected opaque scope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(
      listAdminAnnouncements('scope:communications/non-default', controller.signal)
    ).resolves.toEqual([]);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/admin/announcements?contextScopeKey=scope%3Acommunications%2Fnon-default'
    );
    const requestSignal = (fetchMock.mock.calls[0]?.[1] as RequestInit).signal;
    expect(requestSignal).toBeInstanceOf(AbortSignal);
  });

  it('binds every services management read and preserves existing query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const scope = 'scope:services/non-default';

    await getAdminServiceCatalog(scope, controller.signal);
    await getServiceManagementCatalog(scope, controller.signal);
    await getServiceOperationsQueue('IN_PROGRESS', scope, controller.signal);
    await getServiceOperationsRequest('request-7', scope, controller.signal);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/services/catalog?contextScopeKey=scope%3Aservices%2Fnon-default',
      '/api/platform/v1/services/catalog?view=management&contextScopeKey=scope%3Aservices%2Fnon-default',
      '/api/platform/v1/admin/services/requests?status=IN_PROGRESS&contextScopeKey=scope%3Aservices%2Fnon-default',
      '/api/platform/v1/admin/services/requests/request-7?contextScopeKey=scope%3Aservices%2Fnon-default',
    ]);
    const requestSignals = fetchMock.mock.calls.map((call) => (call[1] as RequestInit).signal);
    requestSignals.forEach((signal) => expect(signal).toBeInstanceOf(AbortSignal));
  });

  it('keeps unscoped management URLs stable except for the required catalog view', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await listAdminAnnouncements();
    await getAdminServiceCatalog();
    await getServiceManagementCatalog();
    await getServiceOperationsQueue();
    await getServiceOperationsRequest('request-8');

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/announcements',
      '/api/platform/v1/admin/services/catalog',
      '/api/platform/v1/services/catalog?view=management',
      '/api/platform/v1/admin/services/requests',
      '/api/platform/v1/admin/services/requests/request-8',
    ]);
  });
});
