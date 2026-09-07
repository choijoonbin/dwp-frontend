import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  createVideoMeetingPersonalRoom,
  createVideoMeetingPersonalRoomSession,
  getVideoMeetingPersonalRoom,
  getVideoMeetingPersonalRoomSessions,
  resolveVideoMeetingPersonalRoomInvitation,
  rotateVideoMeetingPersonalRoomInvitation,
  updateVideoMeetingPersonalRoom,
} from './video-meeting-personal-room-api';

const id = '88000000-0000-4000-8000-000000000001';
const room = {
  roomId: id,
  name: 'Personal room',
  opaqueAlias: 'a'.repeat(32),
  invitationRevision: 3,
  version: 4,
  updatedAt: '2026-09-04T01:00:00Z',
  currentMeetingId: null,
};
const session = {
  meetingId: id,
  title: 'Personal room',
  lifecycleState: 'LOBBY',
  invitationRevision: 3,
  createdAt: room.updatedAt,
  endedAt: null,
};
const response = (data: unknown, status = 200) =>
  ({ ok: status < 400, status, text: async () => JSON.stringify({ data }) }) as Response;
const csrf = () => response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
afterEach(() => {
  vi.unstubAllGlobals();
  resetCsrfToken();
});

describe('personal room API owner and invitation boundaries', () => {
  it('uses the current owner route and drops undeclared server data', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ ...room, tenantId: 999, mediaToken: 'never-consume' }));
    vi.stubGlobal('fetch', fetcher);
    expect(await getVideoMeetingPersonalRoom()).toEqual(room);
    expect(fetcher.mock.calls[0][0]).toBe('/api/meetings/v1/personal-room');
  });
  it.each([200, 404])('treats an absent room (%s) as unprovisioned', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, status)));
    expect(await getVideoMeetingPersonalRoom()).toBeNull();
  });
  it('does not turn authorization failure into an empty room', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, 403)));
    await expect(getVideoMeetingPersonalRoom()).rejects.toMatchObject({ status: 403 });
  });
  it('accepts the real clean-boot successful envelope with omitted null data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ status: 'SUCCESS', success: true, timestamp: '2026-09-04T01:00:00' }),
      } as Response)
    );
    expect(await getVideoMeetingPersonalRoom()).toBeNull();
  });
  it.each([
    { status: 'ERROR', success: false },
    { status: 'ERROR', success: false, data: null },
    { status: 'SUCCESS' },
  ])('does not infer an empty room from an unverified or failure envelope', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
      } as Response)
    );
    await expect(getVideoMeetingPersonalRoom()).rejects.toThrow(
      'Invalid personal meeting room contract.'
    );
  });
  it.each([
    ['create', 'POST', '/personal-room', { name: 'My room' }],
    ['update', 'PUT', '/personal-room', { name: 'My room', expectedVersion: 4 }],
    ['rotate', 'POST', '/personal-room/rotate-invitation', { expectedVersion: 4 }],
    ['start', 'POST', '/personal-room/sessions', { expectedVersion: 4, invitationRevision: 3 }],
  ] as const)(
    'sends only the %s command allowlist with its stable key',
    async (kind, method, path, body) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(csrf())
        .mockResolvedValueOnce(response(kind === 'start' ? session : room));
      vi.stubGlobal('fetch', fetcher);
      if (kind === 'create') await createVideoMeetingPersonalRoom(' My room ', id);
      if (kind === 'update') await updateVideoMeetingPersonalRoom(' My room ', 4, id);
      if (kind === 'rotate') await rotateVideoMeetingPersonalRoomInvitation(4, id);
      if (kind === 'start') await createVideoMeetingPersonalRoomSession(4, 3, id);
      const [url, options] = fetcher.mock.calls[1] as [string, RequestInit];
      expect(url).toBe('/api/meetings/v1' + path);
      expect(options.method).toBe(method);
      expect(JSON.parse(String(options.body))).toEqual(body);
      expect(new Headers(options.headers).get('Idempotency-Key')).toBe(id);
    }
  );
  it('validates invitation shape without carrying media authority fields', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response({ name: 'Room', meetingId: id, sessionAvailable: true, token: 'never-consume' })
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await resolveVideoMeetingPersonalRoomInvitation(room.opaqueAlias, 3)).toEqual({
      name: 'Room',
      meetingId: id,
      sessionAvailable: true,
    });
    expect(fetcher.mock.calls[0][0]).toBe(
      '/api/meetings/v1/personal-rooms/' + room.opaqueAlias + '/invitation?revision=3'
    );
  });
  it('rejects contradictory invitation availability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ name: 'Room', meetingId: null, sessionAvailable: true }))
    );
    await expect(resolveVideoMeetingPersonalRoomInvitation(room.opaqueAlias, 3)).rejects.toThrow(
      'Invalid personal meeting room contract.'
    );
  });
  it('reads the real paginated session projection', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ items: [session], total: 6, page: 1, pageSize: 5 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await getVideoMeetingPersonalRoomSessions(1, 5)).toEqual({
      items: [session],
      total: 6,
      page: 1,
      pageSize: 5,
    });
    expect(fetcher.mock.calls[0][0]).toBe(
      '/api/meetings/v1/personal-room/sessions?page=1&pageSize=5'
    );
  });
  it.each([
    () => createVideoMeetingPersonalRoom('', id),
    () => createVideoMeetingPersonalRoom('x'.repeat(161), id),
    () => updateVideoMeetingPersonalRoom('Room', -1, id),
    () => rotateVideoMeetingPersonalRoomInvitation(1.5, id),
    () => createVideoMeetingPersonalRoomSession(1, 0, id),
    () => createVideoMeetingPersonalRoom('Room', 'bad'),
    () => getVideoMeetingPersonalRoomSessions(-1),
    () => getVideoMeetingPersonalRoomSessions(0, 101),
    () => resolveVideoMeetingPersonalRoomInvitation('../other-tenant', 1),
  ])('rejects malformed commands before any network request', async (execute) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(execute()).rejects.toThrow('Invalid personal meeting room contract.');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    { ...room, opaqueAlias: 'bad' },
    { ...room, version: -1 },
    { ...room, currentMeetingId: 'secret-content' },
  ])('rejects malformed room responses without echoing content', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(value)));
    await expect(getVideoMeetingPersonalRoom()).rejects.toThrow(
      'Invalid personal meeting room contract.'
    );
  });
});
