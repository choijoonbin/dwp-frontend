import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { getHomeExperienceRevisions } from './home-experience-api';
import {
  getHomeTemplateRevisions,
  getHomeTemplates,
  getHomeViewRevisions,
} from './home-personalization-api';
import { getTenantBrandingRevisions } from './tenant-branding-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('bounded home revision API contracts', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it.each([
    [getHomeExperienceRevisions, '/api/platform/v1/admin/home-experience/revisions?limit=20'],
    [getTenantBrandingRevisions, '/api/platform/v1/admin/tenant-branding/revisions?limit=20'],
  ] as const)('preserves hasMore and limit from %s', async (read, url) => {
    const page = { items: [{ revisionId: 1 }], hasMore: true, limit: 20 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(page));
    vi.stubGlobal('fetch', fetchMock);

    await expect(read()).resolves.toEqual(page);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(url);
  });

  it('accepts bounded template and personal revision pages', async () => {
    const templatePage = { items: [], hasMore: true, limit: 100 };
    const revisionPage = { items: [], hasMore: true, limit: 50 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(templatePage))
      .mockResolvedValueOnce(jsonResponse(revisionPage))
      .mockResolvedValueOnce(jsonResponse(revisionPage));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getHomeTemplates()).resolves.toEqual(templatePage);
    await expect(getHomeTemplateRevisions('template-1')).resolves.toEqual(revisionPage);
    await expect(getHomeViewRevisions('view-1')).resolves.toEqual(revisionPage);
  });

  it.each([
    [],
    { items: [], limit: 50 },
    { items: [], hasMore: false, limit: 51 },
    { items: Array.from({ length: 2 }), hasMore: false, limit: 1 },
  ])('fails closed for an invalid bounded history envelope', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payload)));

    await expect(getHomeExperienceRevisions()).rejects.toThrow(
      'Home experience revision history response is unavailable.'
    );
  });
});
