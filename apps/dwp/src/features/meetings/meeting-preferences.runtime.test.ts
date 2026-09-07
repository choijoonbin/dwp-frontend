// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type * as ReactI18next from 'react-i18next';
import type * as ReactRouter from 'react-router-dom';
import type { VideoMeetingPreferences } from '@dwp-frontend/shared-utils/api/video-meeting-preferences-api';

const runtime = vi.hoisted(() => ({
  auth: { tenantId: 1, userId: 7, identityPlane: 'TENANT', isAuthenticated: true },
  read: vi.fn(),
  write: vi.fn(),
  navigate: vi.fn(),
  blocker: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useAuth: () => ({ user: { ...runtime.auth }, isAuthenticated: runtime.auth.isAuthenticated }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-preferences-api', () => ({
  getVideoMeetingPreferences: runtime.read,
  updateVideoMeetingPreferences: runtime.write,
}));
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof ReactRouter>()),
  useNavigate: () => runtime.navigate,
  useBlocker: (dirty: boolean) => {
    runtime.blocker(dirty);
    return { state: 'unblocked' };
  },
}));
vi.mock('react-i18next', async (original) => ({
  ...(await original<typeof ReactI18next>()),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

import { MeetingPreferences } from './meeting-preferences';

function snapshot(displayName = 'Authorized name', version = 0): VideoMeetingPreferences {
  return {
    displayName,
    microphoneOff: true,
    cameraOff: true,
    prejoinEnabled: true,
    reminderEnabled: true,
    reminderMinutes: 10,
    recapNotifications: true,
    version,
    updatedAt: null,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let root: Root | null;
let container: HTMLDivElement;
let client: QueryClient;
let media: ReturnType<typeof vi.fn>;
let track: EventTarget & { stop: ReturnType<typeof vi.fn> };
const originalDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

async function render() {
  await act(async () =>
    root?.render(
      createElement(
        StrictMode,
        null,
        createElement(QueryClientProvider, { client }, createElement(MeetingPreferences))
      )
    )
  );
}
async function text(value: string) {
  await act(async () => {
    await vi.waitFor(() => expect(container.textContent).toContain(value));
  });
}
function button(label: string) {
  const found = [...container.querySelectorAll('button')].find(
    (item) => item.textContent === label
  );
  if (!found) throw new Error('Missing button: ' + label);
  return found;
}
async function editAccount() {
  const label = [...container.querySelectorAll('label')].find(
    (item) => item.textContent === 'preferences.join.microphoneOff'
  );
  const input = label?.querySelector('input');
  if (!input) throw new Error('Missing account preference control');
  await act(async () => input.click());
}

describe('preferences authority and storage runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.auth = { tenantId: 1, userId: 7, identityPlane: 'TENANT', isAuthenticated: true };
    runtime.read.mockReset().mockResolvedValue(snapshot());
    runtime.write.mockReset();
    runtime.navigate.mockReset();
    runtime.blocker.mockClear();
    track = Object.assign(new EventTarget(), { stop: vi.fn() });
    media = vi.fn().mockResolvedValue({ getTracks: () => [track] });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      get: () => ({
        getUserMedia: media,
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getSupportedConstraints: () => ({}),
      }),
    });
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    client.clear();
    container.remove();
    vi.restoreAllMocks();
    window.localStorage.clear();
    if (originalDevices) Object.defineProperty(navigator, 'mediaDevices', originalDevices);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('does not capture media until the explicit camera test command', async () => {
    await render();
    await text('preferences.title');
    expect(media).not.toHaveBeenCalled();
    await act(async () => button('preferences.video.start').click());
    expect(media).toHaveBeenCalledTimes(1);
    await act(async () => root?.unmount());
    root = null;
    expect(track.stop).toHaveBeenCalled();
  });

  it('survives localStorage getter denial and reports local-only save failure', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    runtime.write.mockResolvedValue(snapshot('Saved account', 1));
    await render();
    await text('preferences.title');
    await editAccount();
    await act(async () => button('preferences.save').click());
    await text('preferences.localSaveError');
    expect(runtime.write).toHaveBeenCalledTimes(1);
    expect(
      [...container.querySelectorAll('input')].some((input) => input.value === 'Saved account')
    ).toBe(true);
  });

  it('revokes media and the editor immediately when save returns forbidden', async () => {
    runtime.write.mockRejectedValue({ status: 403 });
    await render();
    await text('preferences.title');
    await act(async () => button('preferences.video.start').click());
    await editAccount();
    await act(async () => button('preferences.save').click());
    await text('preferences.loadError');
    expect(track.stop).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="meeting-preferences-workspace"]')).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects a late successful write after GET authority revocation, even after recovery', async () => {
    const pending = deferred<VideoMeetingPreferences>();
    runtime.write.mockReturnValue(pending.promise);
    await render();
    await text('preferences.title');
    await act(async () => button('preferences.video.start').click());
    await editAccount();
    await act(async () => button('preferences.save').click());
    runtime.read.mockRejectedValue({ status: 403 });
    await act(async () => {
      await client.refetchQueries({ queryKey: ['meetings', 'preferences'] });
    });
    await text('preferences.loadError');
    expect(track.stop).toHaveBeenCalled();
    runtime.read.mockResolvedValue(snapshot('Fresh authorized name', 3));
    await act(async () => button('actions.retry').click());
    await text('preferences.title');
    await act(async () => pending.resolve(snapshot('Forbidden late name', 2)));
    const caches = client
      .getQueryCache()
      .getAll()
      .map((query) => query.state.data);
    expect(JSON.stringify(caches)).toContain('Fresh authorized name');
    expect(JSON.stringify(caches)).not.toContain('Forbidden late name');
    expect(window.localStorage.length).toBe(0);
  });

  it.each(['tenantId', 'userId'] as const)(
    'discards late saves and live streams when %s changes',
    async (key) => {
      const pending = deferred<VideoMeetingPreferences>();
      runtime.write.mockReturnValue(pending.promise);
      await render();
      await text('preferences.title');
      await act(async () => button('preferences.video.start').click());
      await editAccount();
      await act(async () => button('preferences.save').click());
      runtime.auth[key]++;
      runtime.read.mockResolvedValue(snapshot('New account', 4));
      await render();
      await text('preferences.title');
      await act(async () => pending.resolve(snapshot('Old account late write', 1)));
      expect(track.stop).toHaveBeenCalled();
      expect(window.localStorage.length).toBe(0);
      expect(
        JSON.stringify(
          client
            .getQueryCache()
            .getAll()
            .map((query) => query.state.data)
        )
      ).not.toContain('Old account late write');
    }
  );
});
