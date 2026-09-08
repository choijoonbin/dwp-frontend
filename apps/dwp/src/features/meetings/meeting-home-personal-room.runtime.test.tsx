// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoMeetingPersonalRoom } from '@dwp-frontend/shared-utils/api/video-meeting-personal-room-api';

const runtime = vi.hoisted(() => ({ read: vi.fn(), copy: vi.fn(), navigate: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-personal-room-api', () => ({
  getVideoMeetingPersonalRoom: runtime.read,
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => runtime.navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { MeetingHomePersonalRoom } from './meeting-home-personal-room';

const room: VideoMeetingPersonalRoom = {
  roomId: '88000000-0000-4000-8000-000000000001',
  name: 'Private meeting room',
  opaqueAlias: 'abcdefabcdefabcdefabcdefabcdefab',
  invitationRevision: 3,
  version: 4,
  updatedAt: '2026-09-07T01:00:00Z',
  currentMeetingId: null,
};
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
async function render(scope = 'tenant1:user7', enabled = true) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MeetingHomePersonalRoom, { key: scope, scope, enabled })
      )
    )
  );
}
async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(mount.textContent).toContain(text));
  });
}
async function copy() {
  const button = [...mount.querySelectorAll('button')].find(
    (item) => item.textContent === 'home.homePolish.copySecureLink'
  );
  if (!button) throw new Error('Missing copy action');
  await act(async () => button.click());
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
describe('home personal room current owner invitation', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.read.mockReset().mockResolvedValue(room);
    runtime.copy.mockReset().mockResolvedValue(undefined);
    runtime.navigate.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: runtime.copy },
    });
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
  });
  it('copies only after a fresh owner read and exposes no name in the secure URL', async () => {
    await render();
    await shown(room.name);
    await copy();
    await shown('home.homePolish.copied');
    expect(runtime.read).toHaveBeenCalledTimes(2);
    expect(runtime.read.mock.calls.every(([signal]) => signal instanceof AbortSignal)).toBe(true);
    expect(runtime.copy).toHaveBeenCalledExactlyOnceWith(
      `${window.location.origin}/meetings/join?room=${room.opaqueAlias}&revision=3`
    );
    expect(runtime.copy.mock.calls[0][0]).not.toContain(room.name);
  });
  it.each([
    { invitationRevision: 4 },
    { version: 5 },
    { opaqueAlias: '11111111111111111111111111111111' },
    { roomId: '88000000-0000-4000-8000-000000000099' },
  ])('refuses a stale invitation after current read changes: %j', async (change) => {
    await render();
    await shown(room.name);
    runtime.read.mockResolvedValue({ ...room, ...change });
    await copy();
    await shown('home.homePolish.changed');
    expect(runtime.copy).not.toHaveBeenCalled();
  });
  it('conceals room data and cannot copy after current authorization fails', async () => {
    await render();
    await shown(room.name);
    runtime.read.mockRejectedValue(new Error('Forbidden'));
    await copy();
    await shown('home.homePolish.copyFailed');
    await act(async () => {
      await vi.waitFor(() => expect(mount.textContent).not.toContain(room.name));
    });
    expect(runtime.copy).not.toHaveBeenCalled();
  });
  it('aborts an in-flight copy on identity replacement and ignores its late success', async () => {
    await render();
    await shown(room.name);
    const old = deferred<VideoMeetingPersonalRoom>();
    runtime.read.mockReturnValueOnce(old.promise).mockResolvedValue(null);
    await copy();
    const signal = runtime.read.mock.calls[1][0] as AbortSignal;
    await render('tenant2:user7');
    await act(async () => old.resolve(room));
    expect(signal.aborted).toBe(true);
    expect(runtime.copy).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain(room.name);
  });
  it('never reads or copies without an enabled current identity', async () => {
    await render('logged-out', false);
    expect(runtime.read).not.toHaveBeenCalled();
    expect(runtime.copy).not.toHaveBeenCalled();
  });
  it('also aborts copy when authority is revoked without replacing the identity key', async () => {
    await render();
    await shown(room.name);
    const pending = deferred<VideoMeetingPersonalRoom>();
    runtime.read.mockReturnValue(pending.promise);
    await copy();
    const signal = runtime.read.mock.calls[1][0] as AbortSignal;
    await render('tenant1:user7', false);
    await act(async () => pending.resolve(room));
    expect(signal.aborted).toBe(true);
    expect(runtime.copy).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain(room.name);
  });
  it('hides cached identity data immediately while current access is revalidated', async () => {
    await render();
    await shown(room.name);
    const pending = deferred<VideoMeetingPersonalRoom | null>();
    runtime.read.mockReturnValue(pending.promise);
    let refresh!: Promise<void>;
    await act(async () => {
      refresh = client.invalidateQueries({ queryKey: ['meetings', 'home', 'personal-room'] });
    });
    await act(async () => {
      await vi.waitFor(() => expect(mount.textContent).not.toContain(room.name));
    });
    await act(async () => pending.resolve(null));
    await refresh;
    expect(mount.textContent).not.toContain(room.name);
    expect(runtime.copy).not.toHaveBeenCalled();
  });
});
