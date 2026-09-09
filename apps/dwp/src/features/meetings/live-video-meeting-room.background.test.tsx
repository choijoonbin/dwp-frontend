// @vitest-environment jsdom
import { act, createElement, useEffect, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Room, type LocalTrackPublication, type VideoCaptureOptions } from 'livekit-client';
import type * as DesignSystem from '@dwp-frontend/design-system';
import type {
  MeetingBackgroundOptions,
  MeetingBackgroundState,
} from './meeting-background-processor';

const mocks = vi.hoisted(() => ({
  factory: vi.fn(),
  room: {},
  transportMount: vi.fn(),
  transportUnmount: vi.fn(),
  participant: { name: 'Viewer', identity: 'viewer', setCameraEnabled: vi.fn() },
}));
type TransportProps = {
  children?: ReactNode;
  video?: VideoCaptureOptions | boolean;
  options?: { videoCaptureDefaults?: VideoCaptureOptions };
};
let transport: TransportProps;
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: (props: TransportProps) => {
    transport = props;
    useEffect(() => {
      mocks.transportMount();
      return () => {
        mocks.transportUnmount();
      };
    }, []);
    return createElement('div', { 'data-transport': true }, props.children);
  },
  useLocalParticipant: () => ({ localParticipant: mocks.participant }),
  useRoomContext: () => mocks.room,
  useDataChannel: () => ({ send: vi.fn(), isSending: false }),
  ConnectionQualityIndicator: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./meeting-background-processor', () => ({
  createMeetingBackgroundProcessor: mocks.factory,
}));
vi.mock('./meeting-conference', () => ({ MeetingConference: () => null }));
vi.mock('./meeting-lobby-panel', () => ({ MeetingLobbyPanel: () => null }));
vi.mock('./meeting-content-governance', () => ({ MeetingContentControl: () => null }));
vi.mock('./meeting-live-facilitation', () => ({ MeetingLiveFacilitationLauncher: () => null }));
vi.mock('@mui/material/Modal', () => ({
  default: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@dwp-frontend/design-system', async (original) => ({
  ...(await original<typeof DesignSystem>()),
  ActionButton: () => null,
  ActionIconButton: () => null,
  ConfirmDialog: () => null,
}));
import { LiveVideoMeetingRoom } from './live-video-meeting-room';

type Props = ComponentProps<typeof LiveVideoMeetingRoom>;
type Owner = {
  name: string;
  destroy: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
  restart: ReturnType<typeof vi.fn>;
  event: (state: MeetingBackgroundState) => void;
  processedTrack?: MediaStreamTrack;
};
let root: Root;
let mount: HTMLDivElement;
let owners: Owner[];
let mounted: boolean;
let mediaDevicesDescriptor: PropertyDescriptor | undefined;
const props = (): Props => ({
  meeting: {
    meetingId: 'meeting-a',
    title: 'Review',
    lifecycleState: 'LIVE',
    canHost: false,
    canModerate: false,
  } as Props['meeting'],
  authorizationScope: 'tenant-a:user-a',
  credential: {
    participantToken: 'test-only',
    serverUrl: 'wss://example.invalid',
    sessionId: 'session-a',
    effectivePermissions: { reactions: false },
  } as Props['credential'],
  choices: {
    username: 'Viewer',
    audioEnabled: false,
    videoEnabled: true,
    audioDeviceId: 'default',
    videoDeviceId: 'default',
  },
  speakerDeviceId: 'default',
  noiseSuppression: true,
  backgroundMode: 'office',
  ending: false,
  onConnected: vi.fn(),
  onLeave: vi.fn(),
  onEndForEveryone: vi.fn(),
});
async function render(overrides: Partial<Props> = {}) {
  await act(async () =>
    root.render(createElement(LiveVideoMeetingRoom, { ...props(), ...overrides }))
  );
}
function fakeTrack(id: string) {
  return Object.assign(new EventTarget(), {
    id,
    kind: 'video',
    enabled: true,
    readyState: 'live',
    muted: false,
    getConstraints: () => ({}),
    getSettings: () => ({ deviceId: 'default', width: 640, height: 480 }),
    stop: vi.fn(),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MediaStreamTrack;
}
class Stream {
  private tracks: MediaStreamTrack[];
  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = [...tracks];
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video');
  }
  getAudioTracks() {
    return [];
  }
  addTrack(track: MediaStreamTrack) {
    this.tracks.push(track);
  }
  removeTrack(track: MediaStreamTrack) {
    this.tracks = this.tracks.filter((item) => item !== track);
  }
}

describe('room camera background publication privacy boundary', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    owners = [];
    mocks.participant.setCameraEnabled.mockResolvedValue(undefined);
    mocks.factory.mockImplementation((options: MeetingBackgroundOptions) => {
      const owner = {
        name: 'test-background',
        init: vi.fn(),
        restart: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
        event: (state: MeetingBackgroundState) => options.onStateChange?.(state),
      };
      owners.push(owner);
      return owner;
    });
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    mounted = true;
  });
  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    mount.remove();
    if (mediaDevicesDescriptor) {
      Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('passes the same processor to first capture and later camera defaults before connection', async () => {
    await render();
    expect(transport.video).toMatchObject({ deviceId: 'default', processor: owners[0] });
    expect((transport.video as VideoCaptureOptions).processor).toBe(
      transport.options?.videoCaptureDefaults?.processor
    );
    expect(mocks.factory).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'office', stopInputOnFailure: true })
    );
  });

  it('actual LiveKit create/init pipeline blocks publish until a processed track is ready', async () => {
    await render();
    const input = fakeTrack('raw');
    const output = fakeTrack('processed');
    vi.stubGlobal('MediaStream', Stream);
    vi.stubGlobal('MediaStreamTrack', EventTarget);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(new Stream([input])),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    let ready!: () => void;
    const pending = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const owner = owners[0];
    owner.init.mockImplementation(async ({ track }: { track: MediaStreamTrack }) => {
      expect(track).toBe(input);
      await pending;
      owner.processedTrack = output;
    });
    const room = new Room({ videoCaptureDefaults: transport.options?.videoCaptureDefaults });
    const publish = vi
      .spyOn(room.localParticipant, 'publishTrack')
      .mockImplementation(async (track) => {
        expect('mediaStreamTrack' in track && track.mediaStreamTrack).toBe(output);
        return { track } as LocalTrackPublication;
      });
    const camera = room.localParticipant.setCameraEnabled(
      true,
      transport.video as VideoCaptureOptions
    );
    await vi.waitFor(() => expect(owner.init).toHaveBeenCalledOnce());
    expect(publish).not.toHaveBeenCalled();
    ready();
    await camera;
    expect(publish).toHaveBeenCalledOnce();
    publish.mock.calls[0][0].stop();
    owner.processedTrack = undefined;
    owner.init.mockImplementation(async ({ track }: { track: MediaStreamTrack }) => {
      track.stop();
      throw new Error('PROCESSING_FAILED');
    });
    const failingRoom = new Room({ videoCaptureDefaults: transport.options?.videoCaptureDefaults });
    const rejectedPublish = vi.spyOn(failingRoom.localParticipant, 'publishTrack');
    await expect(
      failingRoom.localParticipant.setCameraEnabled(true, transport.video as VideoCaptureOptions)
    ).rejects.toThrow('PROCESSING_FAILED');
    expect(rejectedPublish).not.toHaveBeenCalled();
    expect(input.stop).toHaveBeenCalled();
    await failingRoom.disconnect();
    await room.disconnect();
    // LiveKit schedules the Safari/Firefox attachment play in a zero-delay task.
    // Drain it before restoring the media-element test implementation.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('allows raw original mode only when the setting is explicitly false', async () => {
    await render({ backgroundMode: 'original' });
    expect(transport.video).toEqual({ deviceId: 'default' });
    expect(transport.options?.videoCaptureDefaults?.processor).toBeUndefined();
    expect(mocks.factory).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 'remote'])(
    'does not silently publish raw input for invalid background setting %s',
    async (backgroundMode) => {
      await render({ backgroundMode: backgroundMode as Props['backgroundMode'] });
      expect(mount.querySelector('[data-transport]')).toBeNull();
      expect(mocks.factory).not.toHaveBeenCalled();
      expect(mount.querySelector('[role="alert"]')?.textContent).toContain(
        'preferences.video.backgroundFailed'
      );
    }
  );

  it('retains processor defaults when the camera is initially off', async () => {
    const choices = { ...props().choices, videoEnabled: false };
    await render({ choices });
    expect(transport.video).toBe(false);
    expect(transport.options?.videoCaptureDefaults?.processor).toBe(owners[0]);
  });

  it('reflects runtime input-stop failure with camera disable and a visible privacy warning', async () => {
    await render();
    const inputStop = vi.fn();
    await act(async () => {
      inputStop(); // Real processor owns this order; its unit suite exercises actual track.stop().
      owners[0].event({ state: 'failed', reason: 'PROCESSING_FAILED' });
    });
    expect(mocks.participant.setCameraEnabled).toHaveBeenCalledWith(false);
    expect(inputStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.participant.setCameraEnabled.mock.invocationCallOrder[0]
    );
    expect(mount.querySelector('[role="alert"]')?.textContent).toContain(
      'preferences.video.backgroundFailed'
    );
    expect((transport.video as VideoCaptureOptions).processor).toBe(owners[0]);
  });

  it('keeps failure warning if server camera disabling rejects without raw fallback', async () => {
    mocks.participant.setCameraEnabled.mockRejectedValue(new Error('unavailable'));
    await render();
    await act(async () => owners[0].event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(mount.querySelector('[role="alert"]')?.textContent).toContain(
      'preferences.video.backgroundFailed'
    );
    expect(transport.options?.videoCaptureDefaults?.processor).toBe(owners[0]);
  });

  it('new authorization scope cannot inherit an old processor or its late warning', async () => {
    await render();
    const old = owners[0];
    await render({ authorizationScope: 'tenant-b:user-b' });
    expect(mocks.transportMount).toHaveBeenCalledTimes(2);
    expect(mocks.transportUnmount).toHaveBeenCalledOnce();
    expect(transport.options?.videoCaptureDefaults?.processor).not.toBe(old);
    await act(async () => old.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(mocks.participant.setCameraEnabled).not.toHaveBeenCalled();
    expect(mount.querySelector('[role="alert"]')).toBeNull();
  });

  it('retains the active privacy warning when a prior scope sends a late success', async () => {
    await render();
    const old = owners[0];
    await render({ authorizationScope: 'tenant-b:user-b' });
    const current = owners[1];
    await act(async () => current.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    await act(async () => old.event({ state: 'ready' }));
    expect(mount.querySelector('[role="alert"]')?.textContent).toContain(
      'preferences.video.backgroundFailed'
    );
    expect(transport.options?.videoCaptureDefaults?.processor).toBe(current);
  });

  it('ignores stale failure after explicit original mode and after room unmount', async () => {
    await render();
    const old = owners[0];
    await render({ backgroundMode: 'original' });
    await act(async () => old.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(mocks.participant.setCameraEnabled).not.toHaveBeenCalled();
    expect(mount.querySelector('[role="alert"]')).toBeNull();
    await act(async () => root.unmount());
    mounted = false;
    await act(async () => old.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(mocks.participant.setCameraEnabled).not.toHaveBeenCalled();
    expect(mount.childElementCount).toBe(0);
  });
});
