// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Shared from '@dwp-frontend/shared-utils';
import type * as MeetingApi from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type * as PreferencesApi from '@dwp-frontend/shared-utils/api/video-meeting-preferences-api';
import type { MeetingPreJoinProps } from './meeting-prejoin';
import type { MeetingDevicePreferences } from './meeting-preferences-model';

const runtime = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    user: { userId: 42, tenantId: 1, identityPlane: 'TENANT', displayName: 'Mina Kim' },
  },
  meeting: vi.fn(),
  preferences: vi.fn(),
  token: vi.fn(),
  confirm: vi.fn(),
  leave: vi.fn(),
  prejoinProps: null as MeetingPreJoinProps | null,
  liveProps: null as Record<string, unknown> | null,
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useAuth: () => runtime.auth,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-api', async (original) => ({
  ...(await original<typeof MeetingApi>()),
  getVideoMeeting: runtime.meeting,
  getVideoMeetingHome: vi.fn(),
  issueVideoMeetingToken: runtime.token,
  confirmVideoMeetingConnected: runtime.confirm,
  leaveVideoMeeting: runtime.leave,
  requestVideoMeetingJoin: vi.fn(),
  startVideoMeeting: vi.fn(),
  endVideoMeeting: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-preferences-api', async (original) => ({
  ...(await original<typeof PreferencesApi>()),
  getVideoMeetingPreferences: runtime.preferences,
}));
vi.mock('./meeting-prejoin', async () => {
  const React = await import('react');
  return {
    MeetingPreJoin: (props: MeetingPreJoinProps) => {
      runtime.prejoinProps = props;
      return React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          { type: 'button', onClick: () => props.onSpeakerDeviceChange('speaker-next') },
          'select-speaker-next'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () =>
              void props.onSubmit({
                username: props.defaults.username,
                audioEnabled: props.defaults.audioEnabled,
                videoEnabled: props.defaults.videoEnabled,
                audioDeviceId: props.defaults.audioDeviceId,
                videoDeviceId: props.defaults.videoDeviceId,
              }),
          },
          'submit-prejoin'
        )
      );
    },
  };
});
vi.mock('./live-video-meeting-room', async () => {
  const React = await import('react');
  return {
    default: (props: Record<string, unknown>) => {
      runtime.liveProps = props;
      return React.createElement('div', null, 'live-room');
    },
  };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
import { MeetingRoomExperience } from './meeting-room-experience';
import { meetingDevicePreferenceKey } from './meeting-preferences-model';

const meetingId = '88000000-0000-4000-8000-000000000301';
const meeting: MeetingApi.VideoMeetingSummary = {
  meetingId,
  meetingCode: 'ABCD-EFGH-JKMN',
  title: 'Architecture review',
  description: 'Decide the release.',
  agenda: 'Review evidence.',
  startsAt: '2027-02-01T01:00:00Z',
  endsAt: '2027-02-01T02:00:00Z',
  durationMinutes: 60,
  timeZone: 'Asia/Seoul',
  accessScope: 'INVITED',
  waitingRoomEnabled: true,
  guestAccessEnabled: false,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  lifecycleState: 'LIVE',
  organizerUserId: 42,
  organizerName: 'Mina Kim',
  attendeeCount: 1,
  myRole: 'ORGANIZER',
  canHost: true,
  canModerate: false,
  participants: [],
  decisions: [],
  followUpActions: [],
  artifacts: [],
  aiNotesAvailable: false,
  version: 3,
};
const scope = JSON.stringify([true, 'TENANT', 1, 42]);
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
async function render() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
  router = createMemoryRouter(
    [{ path: '/meetings/room/:id', element: createElement(MeetingRoomExperience, { meetingId }) }],
    { initialEntries: [`/meetings/room/${meetingId}`] }
  );
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router }))
    )
  );
  await settle();
}
async function rerender() {
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router }))
    )
  );
  await settle();
}
async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label
  );
  if (!button) throw new Error('Missing button ' + label);
  await act(async () => button.click());
  await settle();
}

describe('meeting room saved device handoff', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    runtime.auth = {
      isAuthenticated: true,
      user: { userId: 42, tenantId: 1, identityPlane: 'TENANT', displayName: 'Mina Kim' },
    };
    runtime.prejoinProps = null;
    runtime.liveProps = null;
    runtime.meeting.mockResolvedValue(meeting);
    runtime.preferences.mockResolvedValue({
      displayName: 'Meeting Mina',
      microphoneOff: false,
      cameraOff: false,
      prejoinEnabled: true,
      reminderEnabled: true,
      reminderMinutes: 10,
      recapNotifications: true,
      version: 1,
      updatedAt: '2026-09-04T00:00:00Z',
    });
    runtime.token.mockResolvedValue({
      meetingId,
      sessionId: '88000000-0000-4000-8000-000000000302',
      provider: 'LIVEKIT',
      serverUrl: 'wss://meeting.invalid',
      participantToken: 'test-token',
      participantRole: 'ORGANIZER',
      expiresAt: '2027-02-01T01:05:00Z',
      effectivePermissions: {
        microphone: true,
        camera: true,
        screenShare: true,
        participantList: true,
        chat: true,
        reactions: true,
        handRaise: true,
      },
    });
    const saved: MeetingDevicePreferences = {
      microphoneId: 'removed-mic',
      cameraId: 'camera-current',
      speakerId: 'speaker-current',
      noiseSuppression: false,
    };
    localStorage.setItem(meetingDevicePreferenceKey(scope), JSON.stringify(saved));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'audioinput', deviceId: 'mic-current', label: 'Current microphone' },
          { kind: 'videoinput', deviceId: 'camera-current', label: 'Current camera' },
          { kind: 'audiooutput', deviceId: 'speaker-current', label: 'Current speaker' },
        ]),
      },
    });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    router?.dispose();
    client?.clear();
    mount?.remove();
    localStorage.clear();
  });

  it('reconciles proven-stale IDs and carries effective choices through prejoin into LiveKit', async () => {
    await render();
    await click('room.deviceCheck');
    expect(runtime.prejoinProps?.defaults).toMatchObject({
      username: 'Meeting Mina',
      audioEnabled: true,
      videoEnabled: true,
      audioDeviceId: 'default',
      videoDeviceId: 'camera-current',
      speakerDeviceId: 'speaker-current',
      noiseSuppression: false,
    });
    expect(JSON.parse(localStorage.getItem(meetingDevicePreferenceKey(scope))!)).toMatchObject({
      microphoneId: 'default',
      cameraId: 'camera-current',
      speakerId: 'speaker-current',
    });
    await click('submit-prejoin');
    expect(runtime.liveProps?.choices).toMatchObject({
      audioDeviceId: 'default',
      videoDeviceId: 'camera-current',
    });
    expect(runtime.liveProps).toMatchObject({
      speakerDeviceId: 'speaker-current',
      noiseSuppression: false,
    });

    await act(async () => {
      (runtime.liveProps?.onSpeakerDeviceFallback as (() => void) | undefined)?.();
    });
    await settle();
    expect(JSON.parse(localStorage.getItem(meetingDevicePreferenceKey(scope))!)).toMatchObject({
      microphoneId: 'default',
      cameraId: 'camera-current',
      speakerId: 'default',
      noiseSuppression: false,
    });
    expect(runtime.liveProps).toMatchObject({ speakerDeviceId: 'default' });
  });

  it('waits for account preferences before mounting prejoin and uses the resolved choices', async () => {
    let resolvePreferences!: (value: PreferencesApi.VideoMeetingPreferences) => void;
    runtime.preferences.mockReturnValue(
      new Promise<PreferencesApi.VideoMeetingPreferences>((resolve) => {
        resolvePreferences = resolve;
      })
    );

    await render();
    const deviceCheck = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'room.deviceCheck'
    );
    expect((deviceCheck as HTMLButtonElement | undefined)?.disabled).toBe(true);
    expect(deviceCheck?.getAttribute('aria-busy')).toBe('true');
    expect(runtime.prejoinProps).toBeNull();
    expect(navigator.mediaDevices.enumerateDevices).not.toHaveBeenCalled();

    await act(async () => {
      resolvePreferences({
        displayName: 'Resolved Account Name',
        microphoneOff: false,
        cameraOff: false,
        prejoinEnabled: true,
        reminderEnabled: true,
        reminderMinutes: 10,
        recapNotifications: true,
        version: 2,
        updatedAt: '2026-09-04T00:01:00Z',
      });
    });
    await settle();
    await click('room.deviceCheck');

    expect(runtime.prejoinProps?.defaults).toMatchObject({
      username: 'Resolved Account Name',
      audioEnabled: true,
      videoEnabled: true,
    });
    expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalledTimes(1);
  });

  it('persists a prejoin output choice and binds the same speaker to the live room', async () => {
    await render();
    await click('room.deviceCheck');
    await click('select-speaker-next');

    expect(runtime.prejoinProps?.defaults.speakerDeviceId).toBe('speaker-next');
    expect(JSON.parse(localStorage.getItem(meetingDevicePreferenceKey(scope))!)).toMatchObject({
      speakerId: 'speaker-next',
    });

    await click('submit-prejoin');
    expect(runtime.liveProps).toMatchObject({ speakerDeviceId: 'speaker-next' });
  });

  it('ignores a late output fallback from a prior account scope', async () => {
    await render();
    await click('room.deviceCheck');
    await click('submit-prejoin');
    const oldFallback = runtime.liveProps?.onSpeakerDeviceFallback as () => void;
    const nextScope = JSON.stringify([true, 'TENANT', 1, 43]);
    const nextPreferences: MeetingDevicePreferences = {
      microphoneId: 'default',
      cameraId: 'default',
      speakerId: 'speaker-next',
      noiseSuppression: true,
    };
    localStorage.setItem(meetingDevicePreferenceKey(nextScope), JSON.stringify(nextPreferences));
    runtime.auth = {
      isAuthenticated: true,
      user: { userId: 43, tenantId: 1, identityPlane: 'TENANT', displayName: 'Next User' },
    };
    await act(async () => {
      client.setQueryData(['meetings', meetingId, 'detail', scope], { ...meeting, version: 4 });
    });
    await rerender();

    await act(async () => oldFallback());
    await settle();

    expect(JSON.parse(localStorage.getItem(meetingDevicePreferenceKey(scope))!)).toMatchObject({
      speakerId: 'speaker-current',
    });
    expect(JSON.parse(localStorage.getItem(meetingDevicePreferenceKey(nextScope))!)).toMatchObject({
      speakerId: 'speaker-next',
    });
  });
});
