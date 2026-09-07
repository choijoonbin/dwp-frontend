// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type { VideoMeetingPersonalRoomInvitation } from '@dwp-frontend/shared-utils/api/video-meeting-personal-room-api';

const runtime = vi.hoisted(() => ({
  auth: { userId: 7, tenantId: 1, identityPlane: 'TENANT' },
  allowed: true,
  resolve: vi.fn(),
  enter: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useAuth: () => ({ isAuthenticated: true, user: runtime.auth }),
  usePermissions: () => ({ isLoaded: true, hasPermission: () => runtime.allowed }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-personal-room-api', () => ({
  resolveVideoMeetingPersonalRoomInvitation: runtime.resolve,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { MeetingPersonalRoomInvitation } from './meeting-personal-room-invitation';

const id = '88000000-0000-4000-8000-000000000001';
const invitation: VideoMeetingPersonalRoomInvitation = {
  name: 'Invited room',
  meetingId: id,
  sessionAvailable: true,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
async function render(revision = 3) {
  await act(async () =>
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client },
          createElement(MeetingPersonalRoomInvitation, {
            opaqueAlias: 'a'.repeat(32),
            revision,
            onEnterMeeting: runtime.enter,
          })
        )
      )
    )
  );
}
async function shown(value: string) {
  await act(async () => {
    await vi.waitFor(() => expect(container.textContent).toContain(value));
  });
}
async function enter() {
  await act(async () =>
    [...container.querySelectorAll('button')]
      .find((button) => button.textContent === 'personalRoomInvitation.enter')
      ?.click()
  );
}
describe('personal-room invitation explicit admission and revocation', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.auth = { userId: 7, tenantId: 1, identityPlane: 'TENANT' };
    runtime.allowed = true;
    runtime.resolve.mockReset().mockResolvedValue(invitation);
    runtime.enter.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  });
  it('reads the bound invitation but does not join automatically', async () => {
    await render();
    await shown(invitation.name);
    expect(runtime.resolve).toHaveBeenCalledWith('a'.repeat(32), 3, expect.any(AbortSignal));
    expect(runtime.enter).not.toHaveBeenCalled();
    await enter();
    expect(runtime.enter).toHaveBeenCalledExactlyOnceWith(id);
    expect(runtime.resolve).toHaveBeenLastCalledWith('a'.repeat(32), 3);
  });
  it('shows unavailable session without exposing an entry command', async () => {
    runtime.resolve.mockResolvedValue({
      name: invitation.name,
      meetingId: null,
      sessionAvailable: false,
    });
    await render();
    await shown('personalRoomInvitation.noSession');
    expect(container.textContent).not.toContain('personalRoomInvitation.enter');
    expect(runtime.enter).not.toHaveBeenCalled();
  });
  it('revalidates rotation at click time and removes the stale room name', async () => {
    await render();
    await shown(invitation.name);
    runtime.resolve.mockRejectedValue({ status: 404 });
    await enter();
    await shown('personalRoomInvitation.unavailable');
    expect(container.textContent).not.toContain(invitation.name);
    expect(runtime.enter).not.toHaveBeenCalled();
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain(invitation.name);
  });
  it('clears the name and fences late admission after GET403', async () => {
    await render();
    await shown(invitation.name);
    const pending = deferred<VideoMeetingPersonalRoomInvitation>();
    runtime.resolve.mockReturnValueOnce(pending.promise);
    await enter();
    runtime.resolve.mockRejectedValue({ status: 403 });
    await act(async () => {
      await client.refetchQueries({ queryKey: ['meetings', 'personal-room-invitation'] });
    });
    await shown('personalRoomInvitation.forbidden');
    await act(async () => pending.resolve(invitation));
    expect(runtime.enter).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain(invitation.name);
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain(invitation.name);
  });
  it.each(['userId', 'tenantId'] as const)(
    'does not enter from a stale %s request',
    async (key) => {
      await render();
      await shown(invitation.name);
      const pending = deferred<VideoMeetingPersonalRoomInvitation>();
      runtime.resolve.mockReturnValueOnce(pending.promise);
      await enter();
      runtime.auth = { ...runtime.auth, [key]: runtime.auth[key] + 1 };
      runtime.resolve.mockResolvedValue({ ...invitation, name: 'New account room' });
      await render();
      await shown('New account room');
      await act(async () => pending.resolve(invitation));
      expect(runtime.enter).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain(invitation.name);
    }
  );
  it('does not expose a name or resolve again after local permission removal', async () => {
    await render();
    await shown(invitation.name);
    const calls = runtime.resolve.mock.calls.length;
    runtime.allowed = false;
    await render();
    await shown('personalRoomInvitation.forbidden');
    expect(runtime.resolve).toHaveBeenCalledTimes(calls);
    expect(container.textContent).not.toContain(invitation.name);
  });
  it('ignores an earlier link response after the revision changes', async () => {
    const old = deferred<VideoMeetingPersonalRoomInvitation>();
    runtime.resolve.mockReturnValueOnce(old.promise);
    await render();
    runtime.resolve.mockResolvedValue({ ...invitation, name: 'New revision room' });
    await render(4);
    await shown('New revision room');
    await act(async () => old.resolve(invitation));
    expect(container.textContent).not.toContain(invitation.name);
    expect(runtime.enter).not.toHaveBeenCalled();
  });
});
