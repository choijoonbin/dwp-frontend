// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type {
  VideoMeetingPersonalRoom,
  VideoMeetingPersonalRoomSession,
} from '@dwp-frontend/shared-utils/api/video-meeting-personal-room-api';

const runtime = vi.hoisted(() => ({
  auth: { userId: 7, tenantId: 1, identityPlane: 'TENANT' },
  permissions: ['VIEW', 'CREATE', 'UPDATE'],
  read: vi.fn(),
  history: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  rotate: vi.fn(),
  start: vi.fn(),
  enter: vi.fn(),
  open: vi.fn(),
  devices: vi.fn(),
  back: vi.fn(),
  clipboard: vi.fn(),
  preferences: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useAuth: () => ({ isAuthenticated: true, user: runtime.auth }),
  usePermissions: () => ({
    isLoaded: true,
    hasPermission: (resource: string, verb: string) =>
      resource === 'APP.MEETINGS' && runtime.permissions.includes(verb),
  }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-personal-room-api', () => ({
  getVideoMeetingPersonalRoom: runtime.read,
  getVideoMeetingPersonalRoomSessions: runtime.history,
  createVideoMeetingPersonalRoom: runtime.create,
  updateVideoMeetingPersonalRoom: runtime.update,
  rotateVideoMeetingPersonalRoomInvitation: runtime.rotate,
  createVideoMeetingPersonalRoomSession: runtime.start,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-preferences-api', () => ({
  getVideoMeetingPreferences: runtime.preferences,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));
import { MeetingPersonalRoom } from './meeting-personal-room';

const id = '88000000-0000-4000-8000-000000000001';
const room: VideoMeetingPersonalRoom = {
  roomId: id,
  name: 'Private room',
  opaqueAlias: 'a'.repeat(32),
  invitationRevision: 3,
  version: 4,
  updatedAt: '2026-09-04T01:00:00Z',
  currentMeetingId: null,
};
const session: VideoMeetingPersonalRoomSession = {
  meetingId: id,
  title: room.name,
  lifecycleState: 'LOBBY',
  invitationRevision: 3,
  createdAt: room.updatedAt,
  endedAt: null,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
async function render() {
  await act(async () =>
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client },
          createElement(MeetingPersonalRoom, {
            onEnterMeeting: runtime.enter,
            onOpenMeeting: runtime.open,
            onCheckDevices: runtime.devices,
            onBack: runtime.back,
          })
        )
      )
    )
  );
}
async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}
function button(label: string) {
  const value = [...document.querySelectorAll('button')].find(
    (item) => item.textContent === label || item.getAttribute('aria-label') === label
  );
  if (!value) throw new Error('Missing button ' + label);
  return value;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
async function name(value: string) {
  const label = [...document.querySelectorAll('label')].find(
    (item) => item.textContent === 'personalRoom.name'
  );
  const input = label && document.getElementById(label.htmlFor);
  if (!(input instanceof HTMLInputElement)) throw new Error('Missing name field');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('personal-room actual component commands and authority', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.auth = { userId: 7, tenantId: 1, identityPlane: 'TENANT' };
    runtime.permissions = ['VIEW', 'CREATE', 'UPDATE'];
    Object.values(runtime).forEach((value) => {
      if (vi.isMockFunction(value)) value.mockReset();
    });
    runtime.read.mockResolvedValue(room);
    runtime.history.mockResolvedValue({ items: [], total: 0, page: 0, pageSize: 5 });
    runtime.clipboard.mockResolvedValue(undefined);
    runtime.preferences.mockResolvedValue({
      displayName: '',
      microphoneOff: true,
      cameraOff: true,
      prejoinEnabled: true,
      reminderEnabled: true,
      reminderMinutes: 10,
      recapNotifications: true,
      version: 1,
      updatedAt: '2026-09-04T00:00:00Z',
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: runtime.clipboard },
    });
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
    if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();
  });
  it('opens authorized history in meeting detail and the full list without creating a session', async () => {
    runtime.history.mockResolvedValue({
      items: [{ ...session, title: 'Prior release', lifecycleState: 'ENDED' }],
      total: 1,
      page: 0,
      pageSize: 5,
    });
    await render();
    await shown('Prior release');
    await click('Prior release');
    expect(runtime.open).toHaveBeenCalledWith(session.meetingId);
    expect(runtime.enter).not.toHaveBeenCalled();
    expect(runtime.start).not.toHaveBeenCalled();
    await click('mine.title · actions.viewAll');
    expect(runtime.back).toHaveBeenCalledOnce();
  });
  it('removes prior history navigation immediately after view permission is revoked', async () => {
    runtime.history.mockResolvedValue({
      items: [{ ...session, title: 'Protected history' }],
      total: 1,
      page: 0,
      pageSize: 5,
    });
    await render();
    await shown('Protected history');
    runtime.permissions = [];
    await render();
    expect(mount.textContent).not.toContain('Protected history');
    expect(mount.textContent).not.toContain('mine.title · actions.viewAll');
    expect(runtime.open).not.toHaveBeenCalled();
  });
  it('keeps provisioning and device checks separate from meeting creation', async () => {
    runtime.read.mockResolvedValue(null);
    await render();
    await shown('personalRoom.first.title');
    await click('personalRoom.checkDevices');
    expect(runtime.devices).toHaveBeenCalledTimes(1);
    expect(runtime.create).not.toHaveBeenCalled();
    expect(runtime.start).not.toHaveBeenCalled();
    runtime.create.mockResolvedValue(room);
    await name('Private room');
    await click('personalRoom.first.create');
    await shown(room.name);
    expect(runtime.create).toHaveBeenCalledWith(room.name, expect.any(String));
    expect(runtime.start).not.toHaveBeenCalled();
  });
  it('copies only the revision-bound same-origin link and exposes clipboard failure', async () => {
    await render();
    await shown(room.name);
    await click('personalRoom.copyLink');
    expect(runtime.clipboard).toHaveBeenCalledWith(
      window.location.origin + '/meetings/join?room=' + room.opaqueAlias + '&revision=3'
    );
    await shown('personalRoom.notices.copied');
    runtime.clipboard.mockRejectedValue(new Error('Clipboard denied'));
    await click('personalRoom.copyLink');
    await shown('personalRoom.notices.copyFailed');
  });
  it('removes stale saved device defaults after preferences access is denied', async () => {
    await render();
    await shown(room.name);
    await act(async () => {
      await vi.waitFor(() =>
        expect(
          document.querySelector<HTMLInputElement>(
            'input[aria-label="preferences.join.microphoneOff"]'
          )?.checked
        ).toBe(true)
      );
    });
    runtime.preferences.mockRejectedValue({ status: 403 });
    await act(async () => {
      await client.refetchQueries({ queryKey: ['meetings', 'personal-room-preferences'] });
    });
    await shown('stitch.personal.preferenceUnavailable');
    expect(document.querySelector('input[aria-label="preferences.join.microphoneOff"]')).toBeNull();
    expect(document.querySelector('input[aria-label="preferences.join.cameraOff"]')).toBeNull();
  });
  it('encodes the current invitation in a local QR and removes it on authority revocation', async () => {
    await render();
    await shown(room.name);
    await click('stitch.personal.qr');
    const qr = () => document.querySelector('[data-testid="personal-room-qr"]');
    const first = qr()?.querySelector('svg path:last-child')?.getAttribute('d');
    expect(first).toBeTruthy();
    expect(qr()?.textContent).toContain('&revision=3');
    runtime.read.mockResolvedValue({ ...room, invitationRevision: 4, version: 5 });
    await act(async () => {
      await client.refetchQueries({
        queryKey: ['meetings', 'personal-room'],
        predicate: (query) => query.queryKey.length === 3,
      });
    });
    await shown('&revision=4');
    expect(qr()?.textContent).toContain('&revision=4');
    expect(qr()?.querySelector('svg path:last-child')?.getAttribute('d')).not.toBe(first);
    runtime.read.mockRejectedValue({ status: 403 });
    await act(async () => {
      await client.refetchQueries({
        queryKey: ['meetings', 'personal-room'],
        predicate: (query) => query.queryKey.length === 3,
      });
    });
    await shown('personalRoom.forbidden');
    expect(qr()).toBeNull();
    expect(document.body.textContent).not.toContain(room.opaqueAlias);
  });
  it('requires confirmation before rotation and renders the new revision with the stable alias', async () => {
    runtime.rotate.mockResolvedValue({ ...room, invitationRevision: 4, version: 5 });
    await render();
    await shown(room.name);
    await click('personalRoom.rotate.action');
    expect(runtime.rotate).not.toHaveBeenCalled();
    await click('personalRoom.rotate.confirm');
    await shown('personalRoom.notices.rotated');
    expect(runtime.rotate).toHaveBeenCalledWith(4, expect.any(String));
    expect(mount.textContent).toContain('room=' + room.opaqueAlias + '&revision=4');
  });
  it('saves a renamed room against the displayed version', async () => {
    runtime.update.mockResolvedValue({ ...room, name: 'Renamed room', version: 5 });
    await render();
    await shown(room.name);
    await click('personalRoom.rename');
    await name('Renamed room');
    await click('personalRoom.saveName');
    await shown('personalRoom.notices.updated');
    expect(runtime.update).toHaveBeenCalledWith('Renamed room', 4, expect.any(String));
    expect(mount.textContent).toContain('Renamed room');
  });
  it('does not optimistically change the name on an expected-version conflict', async () => {
    runtime.update.mockRejectedValue({ status: 409 });
    await render();
    await shown(room.name);
    await click('personalRoom.rename');
    await name('Conflicting name');
    await click('personalRoom.saveName');
    await shown('personalRoom.notices.conflict');
    expect(mount.querySelector('h1')?.textContent).toBe(room.name);
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
      'personalRoom.notices.conflict'
    );
  });
  it('serializes double-start and enters only the actual returned meeting', async () => {
    const pending = deferred<VideoMeetingPersonalRoomSession>();
    runtime.start.mockReturnValue(pending.promise);
    await render();
    await shown(room.name);
    await act(async () => {
      button('personalRoom.start').click();
      button('personalRoom.start').click();
    });
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(runtime.enter).not.toHaveBeenCalled();
    await act(async () => pending.resolve(session));
    expect(runtime.enter).toHaveBeenCalledExactlyOnceWith(id);
  });
  it('reuses the same idempotency key when the same start request is retried', async () => {
    runtime.start
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce(session);
    await render();
    await shown(room.name);
    await click('personalRoom.start');
    await shown('personalRoom.notices.failed');
    await click('personalRoom.start');
    expect(runtime.start.mock.calls[0]).toEqual(runtime.start.mock.calls[1]);
    expect(runtime.enter).toHaveBeenCalledExactlyOnceWith(id);
  });
  it('uses the same session command to continue an existing session', async () => {
    runtime.read.mockResolvedValue({ ...room, currentMeetingId: id });
    runtime.start.mockResolvedValue(session);
    await render();
    await shown('personalRoom.continue');
    await click('personalRoom.continue');
    expect(runtime.start).toHaveBeenCalledWith(4, 3, expect.any(String));
    expect(runtime.enter).toHaveBeenCalledExactlyOnceWith(id);
  });
  it('fences late session success after a GET403 authority revocation', async () => {
    const pending = deferred<VideoMeetingPersonalRoomSession>();
    runtime.start.mockReturnValue(pending.promise);
    await render();
    await shown(room.name);
    await click('personalRoom.start');
    runtime.read.mockRejectedValue({ status: 403 });
    await act(async () => {
      await client.refetchQueries({
        queryKey: ['meetings', 'personal-room'],
        exact: false,
        predicate: (query) => query.queryKey.length === 3,
      });
    });
    await shown('personalRoom.forbidden');
    await act(async () => pending.resolve(session));
    expect(runtime.enter).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain(room.opaqueAlias);
    expect(
      client
        .getQueriesData({ queryKey: ['meetings', 'personal-room'] })
        .every(([, value]) => value == null)
    ).toBe(true);
  });
  it.each(['userId', 'tenantId'] as const)(
    'ignores late failure from the prior %s scope',
    async (key) => {
      const pending = deferred<VideoMeetingPersonalRoomSession>();
      runtime.start.mockReturnValue(pending.promise);
      await render();
      await shown(room.name);
      await click('personalRoom.start');
      runtime.auth = { ...runtime.auth, [key]: runtime.auth[key] + 1 };
      runtime.read.mockResolvedValue({ ...room, name: 'New account room' });
      await render();
      await shown('New account room');
      await act(async () => pending.reject({ status: 403 }));
      expect(mount.textContent).toContain('New account room');
      expect(mount.textContent).not.toContain('personalRoom.forbidden');
    }
  );
  it('shows history failure as partial without pretending there are no sessions', async () => {
    runtime.history.mockRejectedValue(new Error('Temporary history failure'));
    await render();
    await shown('personalRoom.history.error');
    expect(mount.textContent).toContain(room.name);
    expect(mount.textContent).not.toContain('personalRoom.history.emptyDescription');
  });
  it('revokes the room when history access is forbidden', async () => {
    runtime.history.mockRejectedValue({ status: 403 });
    await render();
    await shown('personalRoom.forbidden');
    expect(mount.textContent).not.toContain(room.opaqueAlias);
    expect(
      client
        .getQueriesData({ queryKey: ['meetings', 'personal-room'] })
        .every(([, value]) => value == null)
    ).toBe(true);
  });
  it('prevents commands after local permission removal and discards a pending success', async () => {
    const pending = deferred<VideoMeetingPersonalRoomSession>();
    runtime.start.mockReturnValue(pending.promise);
    await render();
    await shown(room.name);
    await click('personalRoom.start');
    runtime.permissions = [];
    await render();
    await shown('personalRoom.forbidden');
    await act(async () => pending.resolve(session));
    expect(runtime.enter).not.toHaveBeenCalled();
  });
});
