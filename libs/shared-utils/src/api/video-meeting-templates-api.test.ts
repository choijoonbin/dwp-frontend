import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  applyVideoMeetingTemplate,
  cloneVideoMeetingTemplate,
  createVideoMeetingTemplate,
  deleteVideoMeetingTemplate,
  favoriteVideoMeetingTemplate,
  getVideoMeetingTemplate,
  getVideoMeetingTemplates,
  updateVideoMeetingTemplate,
  type VideoMeetingTemplateInput,
  type VideoMeetingTemplateScheduleDraft,
} from './video-meeting-templates-api';

const id = '88000000-0000-4000-8000-000000000001';
const key = '88000000-0000-4000-8000-000000000002';
const input: VideoMeetingTemplateInput = {
  name: 'Team decision',
  purpose: 'Agree on the next milestone',
  category: 'DECISION',
  durationMinutes: 30,
  agendaItems: [
    { title: 'Decision', description: 'Review options', role: 'Facilitator', durationMinutes: 20 },
  ],
};
const draft: VideoMeetingTemplateScheduleDraft = {
  sourceTemplateId: id,
  sourceTemplateVersion: 3,
  title: input.name,
  purpose: input.purpose,
  durationMinutes: input.durationMinutes,
  agendaItems: input.agendaItems,
  accessScope: 'INVITED',
  waitingRoomEnabled: true,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  requiresPolicyRevalidation: true,
};
function response(data: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify({ data }) } as Response;
}
function transport(data: unknown) {
  const fetch = vi
    .fn()
    .mockImplementation(async (url: string) =>
      url.includes('/csrf')
        ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
        : response(data)
    );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function lastCommand(fetch: ReturnType<typeof transport>) {
  return [...fetch.mock.calls].reverse().find(([url]) => !String(url).includes('/csrf')) as [
    string,
    RequestInit,
  ];
}
describe('meeting template public API contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('uses server scope/search/category/favorite filters and propagates cancellation', async () => {
    const data = { items: [], total: 0, page: 2, pageSize: 30 };
    const fetch = transport(data);
    const abort = new AbortController();
    await expect(
      getVideoMeetingTemplates(
        { scope: 'PERSONAL', q: '출시 & 검토', category: 'DECISION', favoritesOnly: true, page: 2 },
        abort.signal
      )
    ).resolves.toEqual(data);
    const [url, init] = lastCommand(fetch);
    const params = new URL(url, 'https://example.test').searchParams;
    expect(url.startsWith('/api/meetings/v1/templates?')).toBe(true);
    expect(Object.fromEntries(params)).toEqual({
      scope: 'PERSONAL',
      q: '출시 & 검토',
      page: '2',
      pageSize: '30',
      category: 'DECISION',
      favoritesOnly: 'true',
    });
    expect(init.method).toBe('GET');
    expect(init.signal).toBeDefined();
  });

  it('reads one exact template, not an administrator or internal route', async () => {
    const fetch = transport({ ...input, templateId: id });
    await getVideoMeetingTemplate(id);
    expect(lastCommand(fetch)[0]).toBe('/api/meetings/v1/templates/' + id);
  });

  it.each([
    ['create', () => createVideoMeetingTemplate(input, key), '/templates', 'POST', input],
    [
      'edit',
      () => updateVideoMeetingTemplate(id, input, 3, key),
      '/templates/' + id,
      'PUT',
      { expectedVersion: 3, template: input },
    ],
    [
      'clone',
      () => cloneVideoMeetingTemplate(id, 'Personal copy', 3, key),
      '/templates/' + id + '/clone',
      'POST',
      { expectedVersion: 3, name: 'Personal copy' },
    ],
    [
      'favorite',
      () => favoriteVideoMeetingTemplate(id, true, key),
      '/templates/' + id + '/favorite',
      'PUT',
      { favorite: true },
    ],
  ])(
    '%s keeps the canonical body and caller-owned idempotency key',
    async (_, execute, suffix, method, body) => {
      const fetch = transport({ ...input, templateId: id });
      await (execute as () => Promise<unknown>)();
      const [url, init] = lastCommand(fetch);
      expect(url).toBe('/api/meetings/v1' + suffix);
      expect(init.method).toBe(method);
      expect(JSON.parse(String(init.body))).toEqual(body);
      expect(init.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
    }
  );

  it('deletes with an explicit expected version and stable key', async () => {
    const fetch = transport({ resourceId: id, version: 4, deleted: true });
    await deleteVideoMeetingTemplate(id, 3, key);
    const [url, init] = lastCommand(fetch);
    expect(url).toBe('/api/meetings/v1/templates/' + id + '?expectedVersion=3');
    expect(init.method).toBe('DELETE');
    expect(init.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
  });

  it('applies as an editable safe draft and strips unexpected identity/consent credentials', async () => {
    const fetch = transport({
      ...draft,
      participantToken: 'must-not-copy',
      ownerUserId: 77,
      consent: true,
      agendaItems: [{ ...draft.agendaItems[0], ownerUserId: 77, materialToken: 'must-not-copy' }],
    });
    await expect(applyVideoMeetingTemplate(id, 3, key)).resolves.toEqual(draft);
    const [url, init] = lastCommand(fetch);
    expect(url).toBe('/api/meetings/v1/templates/' + id + '/apply');
    expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 3 });
  });

  it.each([
    { sourceTemplateId: key },
    { sourceTemplateVersion: 4 },
    { accessScope: 'INTERNAL' },
    { waitingRoomEnabled: false },
    { defaultMicrophoneEnabled: true },
    { defaultCameraEnabled: true },
    { requiresPolicyRevalidation: false },
  ])('rejects unsafe or mismatched apply draft %s', async (patch) => {
    transport({ ...draft, ...patch });
    await expect(applyVideoMeetingTemplate(id, 3, key)).rejects.toThrow('draft binding');
  });

  it.each([-1, 1.1, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid optimistic version %s before transport',
    async (version) => {
      const fetch = transport(draft);
      await expect(applyVideoMeetingTemplate(id, version, key)).rejects.toThrow('version');
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it('rejects invalid IDs and idempotency keys before transport', async () => {
    const fetch = transport(draft);
    await expect(getVideoMeetingTemplate('../admin')).rejects.toThrow('reference');
    await expect(createVideoMeetingTemplate(input, '')).rejects.toThrow('idempotency');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([401, 403, 409, 503])(
    'propagates %s without a fabricated success or local template',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, status)));
      await expect(getVideoMeetingTemplates()).rejects.toThrow();
    }
  );
});
