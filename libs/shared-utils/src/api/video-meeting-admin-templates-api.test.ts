import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  createVideoMeetingAdminTemplate,
  deleteVideoMeetingAdminTemplate,
  getVideoMeetingAdminTemplate,
  getVideoMeetingAdminTemplates,
  updateVideoMeetingAdminTemplate,
} from './video-meeting-admin-templates-api';

const id = '88000000-0000-4000-8000-000000000911';
const key = '88000000-0000-4000-8000-000000000912';
const input = {
  name: 'Shared decision',
  purpose: 'Agree owners',
  category: 'DECISION',
  durationMinutes: 30,
  agendaItems: [],
};
const template = {
  ...input,
  templateId: id,
  scope: 'ORGANIZATION',
  canEdit: true,
  favorite: false,
  version: 3,
  updatedAt: '2026-09-08T00:00:00Z',
};
function transport(data: unknown, status = 200) {
  const fetch = vi.fn().mockImplementation(
    async (url: string) =>
      ({
        ok: status < 400 || url.includes('/csrf'),
        status: url.includes('/csrf') ? 200 : status,
        text: async () =>
          JSON.stringify({
            data: url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : data,
          }),
      }) as Response
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function command(fetch: ReturnType<typeof transport>) {
  return [...fetch.mock.calls].reverse().find(([url]) => !String(url).includes('/csrf')) as [
    string,
    RequestInit,
  ];
}

describe('organization meeting template management API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });
  it('queries only organization scope through the authorized admin collection', async () => {
    const page = { items: [template], total: 21, page: 1, pageSize: 20 };
    const fetch = transport(page);
    const abort = new AbortController();
    await expect(
      getVideoMeetingAdminTemplates({ q: '출시 & owners', page: 1 }, abort.signal)
    ).resolves.toEqual(page);
    const [url, request] = command(fetch);
    expect(new URL(url, 'https://example.test').pathname).toBe('/api/meetings/v1/admin/templates');
    expect(Object.fromEntries(new URL(url, 'https://example.test').searchParams)).toEqual({
      scope: 'ORGANIZATION',
      q: '출시 & owners',
      page: '1',
      pageSize: '20',
    });
    expect(request.signal).toBeDefined();
  });
  it('binds detail and write receipts to the requested organization record', async () => {
    transport({ ...template, templateId: key });
    await expect(getVideoMeetingAdminTemplate(id)).rejects.toThrow('binding');
    transport({ ...template, scope: 'PERSONAL' });
    await expect(createVideoMeetingAdminTemplate(input, key)).rejects.toThrow('binding');
  });
  it('keeps create and CAS update commands distinct with caller-owned retry keys', async () => {
    const fetch = transport(template);
    await createVideoMeetingAdminTemplate(input, key);
    expect(command(fetch)[0]).toBe('/api/meetings/v1/admin/templates');
    expect(JSON.parse(String(command(fetch)[1].body))).toEqual(input);
    await updateVideoMeetingAdminTemplate(id, input, 2, key);
    const [url, request] = command(fetch);
    expect(url).toBe('/api/meetings/v1/admin/templates/' + id);
    expect(request.method).toBe('PUT');
    expect(JSON.parse(String(request.body))).toEqual({ template: input, expectedVersion: 2 });
    expect(request.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
  });
  it('requires the delete version and authoritative deletion receipt', async () => {
    const fetch = transport({ resourceId: id, version: 4, deleted: true });
    await deleteVideoMeetingAdminTemplate(id, 3, key);
    expect(command(fetch)[0]).toBe('/api/meetings/v1/admin/templates/' + id + '?expectedVersion=3');
    expect(command(fetch)[1].method).toBe('DELETE');
    transport({ resourceId: id, version: 4, deleted: false });
    await expect(deleteVideoMeetingAdminTemplate(id, 3, key)).rejects.toThrow('receipt');
  });
  it.each([-1, 1.5, Number.NaN])(
    'rejects invalid optimistic version %s before transport',
    async (version) => {
      const fetch = transport(template);
      await expect(updateVideoMeetingAdminTemplate(id, input, version, key)).rejects.toThrow(
        'version'
      );
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it('rejects invalid resource and idempotency references before transport', async () => {
    const fetch = transport(template);
    await expect(getVideoMeetingAdminTemplate('../policy')).rejects.toThrow('reference');
    await expect(createVideoMeetingAdminTemplate(input, '')).rejects.toThrow('idempotency');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409, 503])(
    'preserves status %s for access, conflict and retry UI',
    async (status) => {
      transport(null, status);
      await expect(getVideoMeetingAdminTemplates({ q: '', page: 0 })).rejects.toMatchObject({
        status,
      });
    }
  );
});
