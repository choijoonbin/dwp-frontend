// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type * as MeetingApi from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type * as ReactI18next from 'react-i18next';
import type * as ReactRouter from 'react-router-dom';
import type {
  VideoMeetingHome,
  VideoMeetingSummary,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  defaultRegionalPreference,
  writeRegionalPreference,
} from '@dwp-frontend/shared-utils/regional-preference';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';

const runtime = vi.hoisted(() => ({
  auth: { tenantId: 1, userId: 7, identityPlane: 'TENANT', isAuthenticated: true },
  home: vi.fn(),
  instant: vi.fn(),
  schedule: vi.fn(),
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  useAuth: () => ({ user: { ...runtime.auth }, isAuthenticated: runtime.auth.isAuthenticated }),
  useToast: () => ({ success: runtime.success, error: runtime.error }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-api', async (importOriginal) => ({
  ...(await importOriginal<typeof MeetingApi>()),
  getVideoMeetingHome: runtime.home,
  createInstantVideoMeeting: runtime.instant,
  scheduleVideoMeeting: runtime.schedule,
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useNavigate: () => runtime.navigate,
}));
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactI18next>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en-US' } }),
}));
vi.mock('./meeting-home-header', () => ({
  MeetingHomeHeader: (props: {
    timeZone: string;
    disabled: boolean;
    onStart: () => void;
    onRefresh: () => void;
  }) =>
    createElement(
      'header',
      { 'data-testid': 'home-header', 'data-time-zone': props.timeZone },
      createElement(
        'button',
        { onClick: props.onStart, disabled: props.disabled },
        'Start meeting'
      ),
      createElement('button', { onClick: props.onRefresh }, 'Refresh meetings')
    ),
}));
vi.mock('./meeting-home-focus', () => ({
  MeetingHomeFocus: (props: { meeting?: VideoMeetingSummary; timeZone: string }) =>
    createElement(
      'div',
      { 'data-testid': 'home-focus', 'data-time-zone': props.timeZone },
      props.meeting?.title
    ),
}));
vi.mock('./meeting-home-timeline', () => ({ MeetingHomeTimeline: () => null }));
vi.mock('./meeting-home-results', () => ({ MeetingHomeResults: () => null }));
vi.mock('./meeting-home-work-queue', () => ({ MeetingHomeWorkQueue: () => null }));

import { MeetingHome } from './meeting-home';

function snapshot(title: string, timeZone = 'UTC'): VideoMeetingHome {
  return {
    serverNow: '2026-09-04T04:00:00Z',
    timeZone,
    activeMeeting: null,
    nextMeeting: { meetingId: title, title } as VideoMeetingSummary,
    today: [],
    recent: [],
    metrics: { meetingsToday: 0, meetingMinutesToday: 0, waitingForApproval: 0 },
    capabilities: {
      available: true,
      provider: 'LIVEKIT',
      audio: true,
      video: true,
      screenShare: true,
      chat: true,
      reactions: true,
      handRaise: true,
      captions: false,
      recordingConfigured: false,
      transcriptConfigured: false,
      aiNotesConfigured: false,
      participantList: true,
      tokenTtlSeconds: 120,
      unmuteControl: 'REQUEST_ONLY',
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

let root: Root | null = null;
let container: HTMLDivElement;
let client: QueryClient;

async function renderHome() {
  await act(async () => {
    root?.render(
      createElement(
        StrictMode,
        null,
        createElement(QueryClientProvider, { client }, createElement(MeetingHome))
      )
    );
  });
}

async function waitForText(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(container.textContent).toContain(text));
  });
}

function button(label: string) {
  const candidate = [...container.querySelectorAll('button')].find(
    (item) => item.textContent === label
  );
  if (!candidate) throw new Error(`Missing test button: ${label}`);
  return candidate;
}

describe('meeting home identity, recovery and regional preferences', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.auth = { tenantId: 1, userId: 7, identityPlane: 'TENANT', isAuthenticated: true };
    runtime.home.mockReset();
    runtime.instant.mockReset();
    runtime.schedule.mockReset();
    runtime.navigate.mockReset();
    runtime.success.mockReset();
    runtime.error.mockReset();
    window.localStorage.clear();
    writeRegionalPreference(defaultRegionalPreference);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    client.clear();
    container.remove();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(['tenantId', 'userId'] as const)(
    'hides cached home content immediately when %s changes',
    async (field) => {
      runtime.home.mockResolvedValue(snapshot('Old private meeting'));
      await renderHome();
      await waitForText('Old private meeting');
      const pending = deferred<VideoMeetingHome>();
      runtime.home.mockReturnValue(pending.promise);
      runtime.auth[field] += 1;
      await renderHome();
      expect(container.textContent).not.toContain('Old private meeting');
      expect(container.querySelector('[data-testid="home-header"]')).toBeNull();
      await act(async () => pending.resolve(snapshot('New authorized meeting')));
      await waitForText('New authorized meeting');
      expect(container.textContent).not.toContain('Old private meeting');
      const activeQuery = client
        .getQueryCache()
        .getAll()
        .find((query) => query.getObserversCount() > 0);
      expect(activeQuery?.options.gcTime).toBe(0);
      expect(activeQuery?.meta?.accessSensitive).toBe(true);
    }
  );

  it.each(['tenantId', 'userId'] as const)(
    'ignores an old instant-meeting completion after %s changes',
    async (field) => {
      runtime.home.mockResolvedValue(snapshot('Old private meeting'));
      const pending = deferred<{ meetingId: string }>();
      runtime.instant.mockReturnValue(pending.promise);
      await renderHome();
      await waitForText('Old private meeting');
      await act(async () => button('Start meeting').click());
      expect(runtime.instant).toHaveBeenCalledTimes(1);
      expect(runtime.instant.mock.calls[0][0]).toMatchObject({
        waitingRoomEnabled: true,
        defaultMicrophoneEnabled: false,
        defaultCameraEnabled: false,
      });
      runtime.home.mockResolvedValue(snapshot('New authorized meeting'));
      runtime.auth[field] += 1;
      await renderHome();
      await waitForText('New authorized meeting');
      await act(async () => pending.resolve({ meetingId: 'old-scope-created-meeting' }));
      expect(runtime.navigate).not.toHaveBeenCalled();
      expect(runtime.success).not.toHaveBeenCalled();
    }
  );

  it('does not let an old in-flight home response replace the current actor snapshot', async () => {
    const oldRequest = deferred<VideoMeetingHome>();
    runtime.home.mockReturnValue(oldRequest.promise);
    await renderHome();
    runtime.auth.userId = 8;
    runtime.home.mockResolvedValue(snapshot('Current actor meeting'));
    await renderHome();
    await waitForText('Current actor meeting');
    await act(async () => oldRequest.resolve(snapshot('Late old actor meeting')));
    expect(container.textContent).toContain('Current actor meeting');
    expect(container.textContent).not.toContain('Late old actor meeting');
  });

  it('queries and displays the configured regional timezone, including preference-change events', async () => {
    writeRegionalPreference({ ...defaultRegionalPreference, timeZone: 'Asia/Seoul' });
    runtime.home.mockResolvedValue(snapshot('Regional meeting', 'UTC'));
    await renderHome();
    await waitForText('Regional meeting');
    expect(runtime.home).toHaveBeenLastCalledWith('Asia/Seoul');
    expect(
      container.querySelector('[data-testid="home-header"]')?.getAttribute('data-time-zone')
    ).toBe('Asia/Seoul');
    expect(
      container.querySelector('[data-testid="home-focus"]')?.getAttribute('data-time-zone')
    ).toBe('Asia/Seoul');
    await act(async () =>
      writeRegionalPreference({ ...defaultRegionalPreference, timeZone: 'Asia/Tokyo' })
    );
    await waitForText('Regional meeting');
    expect(runtime.home).toHaveBeenLastCalledWith('Asia/Tokyo');
    expect(
      container.querySelector('[data-testid="home-header"]')?.getAttribute('data-time-zone')
    ).toBe('Asia/Tokyo');
  });

  it('uses the system timezone for the request and server-returned timezone for system-mode display', async () => {
    runtime.home.mockResolvedValue(snapshot('System meeting', 'Europe/London'));
    await renderHome();
    await waitForText('System meeting');
    expect(runtime.home).toHaveBeenLastCalledWith(resolveSystemTimeZone('UTC'));
    expect(
      container.querySelector('[data-testid="home-header"]')?.getAttribute('data-time-zone')
    ).toBe('Europe/London');
  });

  it('hides stale snapshot and commands on refresh failure, then recovers only after a successful retry', async () => {
    runtime.home.mockResolvedValue(snapshot('Previously authorized meeting'));
    await renderHome();
    await waitForText('Previously authorized meeting');
    runtime.home.mockRejectedValue({ status: 403 });
    const priorRequests = runtime.home.mock.calls.length;
    await act(async () => {
      await client.refetchQueries({ queryKey: ['meetings', 'home', 'snapshot'] });
    });
    await waitForText('errors.loadTitle');
    expect(runtime.home.mock.calls.length).toBe(priorRequests + 1);
    expect(container.textContent).not.toContain('Previously authorized meeting');
    expect(container.querySelector('[data-testid="home-header"]')).toBeNull();
    expect(container.querySelector('[data-testid="meeting-home-stale"]')).not.toBeNull();
    runtime.home.mockResolvedValue(snapshot('Recovered authorized meeting'));
    await act(async () => button('actions.retry').click());
    await waitForText('Recovered authorized meeting');
    expect(container.querySelector('[data-testid="meeting-home-stale"]')).toBeNull();
  });
});
