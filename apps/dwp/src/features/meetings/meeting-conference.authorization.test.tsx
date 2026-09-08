// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoMeetingEffectivePermissions } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type * as RoomContext from './meeting-room-context-panel';

const runtime = vi.hoisted(() => ({
  mobile: false,
  revoking: false,
  tracks: [],
  layout: { pin: { dispatch: vi.fn() } },
  renderedPanels: [] as { panel: string; revoking: boolean }[],
  overlayChanged: vi.fn(),
}));

vi.mock('@mui/material/useMediaQuery', () => ({ default: () => runtime.mobile }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@livekit/components-react', () => {
  const childrenOnly = ({ children }: { children?: ReactNode }) => children;
  return {
    CarouselLayout: childrenOnly,
    FocusLayout: () => null,
    FocusLayoutContainer: childrenOnly,
    GridLayout: childrenOnly,
    LayoutContextProvider: childrenOnly,
    MediaDeviceMenu: () => null,
    ParticipantTile: () => null,
    RoomAudioRenderer: () => null,
    StartMediaButton: () => null,
    ConnectionStateToast: () => null,
    isTrackReference: () => false,
    useCreateLayoutContext: () => runtime.layout,
    useLocalParticipantPermissions: () => ({ canPublish: false }),
    usePersistentUserChoices: () => ({
      saveAudioInputEnabled: vi.fn(),
      saveVideoInputEnabled: vi.fn(),
      saveAudioInputDeviceId: vi.fn(),
      saveVideoInputDeviceId: vi.fn(),
    }),
    usePinnedTracks: () => [],
    useTracks: () => runtime.tracks,
    useTrackToggle: () => ({ enabled: false, buttonProps: { disabled: false } }),
  };
});
vi.mock('./meeting-leave-control', () => ({ MeetingLeaveControl: () => null }));
vi.mock('./meeting-room-stage-context', () => ({
  MeetingRoomLiveSummary: () => null,
  MeetingStageWaiting: () => createElement('div', null, 'waiting for governed media'),
}));
vi.mock('./meeting-live-facilitation', () => ({ MeetingLiveFacilitation: () => null }));
// Keep the real permission predicate and real rail, replacing only its unrelated API body.
vi.mock('./meeting-room-context-panel', async (original) => ({
  ...(await original<typeof RoomContext>()),
  MeetingRoomContextPanel: ({ kind }: { kind: string }) =>
    createElement('aside', { 'data-testid': `context-${kind}` }, kind),
}));
vi.mock('./meeting-participants-panel', () => ({
  MeetingParticipantsPanel: () => {
    runtime.renderedPanels.push({ panel: 'participants', revoking: runtime.revoking });
    return createElement(
      'aside',
      { 'data-testid': 'authorized-participants' },
      'PRIVATE_PARTICIPANT'
    );
  },
}));
vi.mock('./meeting-collaboration-runtime', () => ({
  MeetingCollaborationRuntime: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: 'chat' | 'floor';
    onTabChange: (tab: 'chat' | 'floor') => void;
  }) => {
    runtime.renderedPanels.push({ panel: activeTab, revoking: runtime.revoking });
    return createElement(
      'aside',
      { 'data-testid': `authorized-${activeTab}` },
      `PRIVATE_${activeTab}`,
      createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'request-floor-from-collaboration',
          onClick: () => onTabChange('floor'),
        },
        'request floor'
      )
    );
  },
}));

import { MeetingConference } from './meeting-conference';

const granted: VideoMeetingEffectivePermissions = {
  microphone: true,
  camera: true,
  screenShare: true,
  participantList: true,
  chat: true,
  reactions: true,
  handRaise: true,
};
const cases = [
  { panel: 'participants', permission: 'participantList' },
  { panel: 'chat', permission: 'chat' },
  { panel: 'floor', permission: 'handRaise' },
] as const;

let root: Root;
let mount: HTMLDivElement;

async function render(permissions: VideoMeetingEffectivePermissions) {
  await act(async () =>
    root.render(
      createElement(MeetingConference, {
        meetingId: '88000000-0000-4000-8000-000000000606',
        authorizationScope: 'TENANT:1:42:revision-7',
        permissions,
        canModerate: true,
        meetingLive: true,
        onDeviceError: vi.fn(),
        onLeaveError: vi.fn(),
        onOverlayPanelChange: runtime.overlayChanged,
      })
    )
  );
}

async function click(selector: string) {
  const button = mount.querySelector<HTMLButtonElement>(selector);
  expect(button, `expected a reachable real control: ${selector}`).not.toBeNull();
  await act(async () => button!.click());
}

async function openFromRail(panel: string) {
  if (runtime.mobile) await click('[data-control="agenda"]');
  const controls =
    panel === 'participants' ? 'meeting-participants-panel' : 'meeting-collaboration-panel';
  const tab = [
    ...mount.querySelectorAll<HTMLButtonElement>(`[role="tab"][aria-controls="${controls}"]`),
  ].find((element) => element.textContent === `room.rail.tabs.${panel}`);
  expect(tab, `real rail destination ${panel}`).toBeDefined();
  await act(async () => tab!.click());
  expect(mount.querySelector(`[data-testid="authorized-${panel}"]`)).not.toBeNull();
}

describe('MeetingConference credential authorization fence', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.mobile = false;
    runtime.revoking = false;
    runtime.renderedPanels.length = 0;
    runtime.overlayChanged.mockReset();
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
  });

  for (const { panel, permission } of cases) {
    it(`does not expose denied ${panel} through the actual rail or toolbar even for a moderator`, async () => {
      await render({ ...granted, [permission]: false });
      expect(mount.querySelector('[data-testid="context-agenda"]')).not.toBeNull();
      expect(mount.querySelector(`[data-control="${panel}"]`)).toBeNull();
      expect(
        [...mount.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)
      ).not.toContain(`room.rail.tabs.${panel}`);
      expect(runtime.renderedPanels.some((entry) => entry.panel === panel)).toBe(false);
    });

    for (const mobile of [false, true]) {
      it(`synchronously unmounts open ${panel} when revoked in ${mobile ? 'mobile' : 'desktop'} and does not restore it on regrant`, async () => {
        runtime.mobile = mobile;
        await render(granted);
        await openFromRail(panel);
        runtime.renderedPanels.length = 0;
        runtime.revoking = true;
        await render({ ...granted, [permission]: false });

        // A passive-effect-only close would render private content once with revoked credentials.
        expect(runtime.renderedPanels.filter((entry) => entry.revoking)).toEqual([]);
        expect(mount.querySelector(`[data-testid="authorized-${panel}"]`)).toBeNull();
        expect(mount.querySelector('.dwp-meeting-room-rail')).toBeNull();
        expect(mount.querySelector('.dwp-meeting-conference__stage')?.hasAttribute('inert')).toBe(
          false
        );
        expect(runtime.overlayChanged).toHaveBeenLastCalledWith(false);

        runtime.revoking = false;
        await render(granted);
        expect(mount.querySelector(`[data-testid="authorized-${panel}"]`)).toBeNull();
        expect(mount.querySelector('.dwp-meeting-room-rail')).toBeNull();
      });
    }
  }

  it('rejects a denied floor request delivered by an already-open collaboration panel', async () => {
    await render({ ...granted, handRaise: false });
    await openFromRail('chat');
    await click('[data-testid="request-floor-from-collaboration"]');
    expect(mount.querySelector('[data-testid="authorized-chat"]')).not.toBeNull();
    expect(mount.querySelector('[data-testid="authorized-floor"]')).toBeNull();
    expect(runtime.renderedPanels.some(({ panel }) => panel === 'floor')).toBe(false);
  });
});
