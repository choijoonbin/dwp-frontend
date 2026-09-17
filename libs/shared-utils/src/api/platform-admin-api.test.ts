import { afterEach, describe, expect, it, vi } from 'vitest';

import { listHomeStudioAuditEvents } from './platform-admin-api';

describe('Home Studio audit API boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the tenant-scoped server-filtered audit endpoint with bounded pagination', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: { content: [], page: 2, size: 25, totalElements: 0, totalPages: 0 },
        }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(listHomeStudioAuditEvents(2, 25)).resolves.toMatchObject({ page: 2, size: 25 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/admin/home-experience/audit-events?page=2&size=25'
    );
  });
});
