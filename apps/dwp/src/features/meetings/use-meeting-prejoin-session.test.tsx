// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useMeetingDevicePreview } from './use-meeting-device-preview';
import type { MeetingPreJoinPreferenceDefaults } from './meeting-preferences-model';
const runtime = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  stopSpeaker: vi.fn(),
  refresh: vi.fn(),
  backgroundChange: vi.fn(),
  states: { audio: 'idle', video: 'idle' } as Record<
    'audio' | 'video',
    'idle' | 'active' | 'requesting'
  >,
}));
vi.mock('./use-meeting-device-preview', () => ({
  useMeetingDevicePreview: () =>
    ({
      start: runtime.start,
      stop: runtime.stop,
      stopSpeaker: runtime.stopSpeaker,
      refresh: runtime.refresh,
      states: runtime.states,
    }) as unknown as ReturnType<typeof useMeetingDevicePreview>,
}));
import {
  useMeetingPrejoinSession,
  type MeetingPrejoinSession,
} from './use-meeting-prejoin-session';
const defaults: MeetingPreJoinPreferenceDefaults = {
  username: 'Mina',
  audioEnabled: true,
  videoEnabled: true,
  audioDeviceId: 'saved-mic',
  videoDeviceId: 'saved-camera',
  speakerDeviceId: 'saved-speaker',
  noiseSuppression: false,
  backgroundMode: 'original',
};
let root: Root;
let mount: HTMLDivElement;
let session: MeetingPrejoinSession;
function Harness() {
  session = useMeetingPrejoinSession(defaults, runtime.backgroundChange);
  return createElement('span', null, session.choices.username);
}
async function render() {
  await act(async () => root.render(createElement(Harness)));
}
describe('prejoin local device session handoff', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    runtime.states = { audio: 'idle', video: 'idle' };
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    await render();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
  });
  it('applies saved device IDs and noise suppression to the actual local capture owner', () => {
    expect(runtime.start).toHaveBeenCalledWith('audio', {
      microphoneId: 'saved-mic',
      cameraId: 'saved-camera',
      speakerId: 'saved-speaker',
      noiseSuppression: false,
      backgroundMode: 'original',
    });
    expect(runtime.start).toHaveBeenCalledWith(
      'video',
      expect.objectContaining({ cameraId: 'saved-camera', noiseSuppression: false })
    );
  });
  it('never advertises requested or failed devices as enabled entry media', async () => {
    expect(session.choices.audioEnabled).toBe(false);
    runtime.states = { audio: 'requesting', video: 'idle' };
    await render();
    expect(session.requesting).toBe(true);
    expect(session.choices.audioEnabled).toBe(false);
    runtime.states = { audio: 'active', video: 'idle' };
    await render();
    expect(session.choices.audioEnabled).toBe(true);
    expect(session.choices.videoEnabled).toBe(false);
  });
  it('changing an active selection restarts capture with the selected ID while preserving the saved noise setting', async () => {
    runtime.states = { audio: 'active', video: 'idle' };
    await render();
    await act(async () => session.select('audio', 'usb-mic'));
    expect(runtime.start).toHaveBeenLastCalledWith(
      'audio',
      expect.objectContaining({ microphoneId: 'usb-mic', noiseSuppression: false })
    );
    expect(session.choices.audioDeviceId).toBe('usb-mic');
  });
  it('an off-device selection does not request permission until the explicit toggle', async () => {
    runtime.start.mockClear();
    await act(async () => session.select('video', 'usb-camera'));
    expect(runtime.start).not.toHaveBeenCalled();
    await act(async () => session.toggle('video'));
    expect(runtime.start).toHaveBeenCalledWith(
      'video',
      expect.objectContaining({ cameraId: 'usb-camera' })
    );
  });
  it('releases input, camera and speaker previews before the caller acquires publication media', () => {
    session.stop();
    expect(runtime.stop).toHaveBeenCalledWith('audio');
    expect(runtime.stop).toHaveBeenCalledWith('video');
    expect(runtime.stopSpeaker).toHaveBeenCalled();
  });
  it('persists office independently of camera permission, then applies it to the next actual start', async () => {
    runtime.start.mockClear();
    await act(async () => session.selectBackgroundMode('office'));
    expect(runtime.backgroundChange).toHaveBeenCalledWith('office');
    expect(runtime.start).not.toHaveBeenCalled();
    expect(session.backgroundMode).toBe('office');
    await act(async () => session.toggle('video'));
    expect(runtime.start).toHaveBeenLastCalledWith(
      'video',
      expect.objectContaining({ backgroundMode: 'office' })
    );
  });
  it('restarts an active camera through the preview owner when the selected privacy effect changes', async () => {
    runtime.states.video = 'active';
    await render();
    await act(async () => session.selectBackgroundMode('blur'));
    expect(runtime.start).toHaveBeenLastCalledWith(
      'video',
      expect.objectContaining({ backgroundMode: 'blur' })
    );
    expect(runtime.backgroundChange).toHaveBeenCalledWith('blur');
  });
});
