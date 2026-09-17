import { useEffect, useRef, useState } from 'react';
import type { LocalUserChoices } from '@livekit/components-react';
import type { MeetingPreJoinPreferenceDefaults } from './meeting-preferences-model';
import type { MeetingBackgroundMode } from './meeting-background-types';
import { useMeetingDevicePreview } from './use-meeting-device-preview';

/** One local capture owner shared by the stage, diagnostics and admission recap. */
export function useMeetingPrejoinSession(
  defaults: MeetingPreJoinPreferenceDefaults,
  onBackgroundModeChange?: (mode: MeetingBackgroundMode) => void
) {
  const preview = useMeetingDevicePreview();
  const [username, setUsername] = useState(defaults.username);
  const [audioDeviceId, setAudioDeviceId] = useState(defaults.audioDeviceId);
  const [videoDeviceId, setVideoDeviceId] = useState(defaults.videoDeviceId);
  const [backgroundMode, setBackgroundMode] = useState(defaults.backgroundMode);
  const initial = useRef(defaults);
  const latestPreview = useRef(preview);
  latestPreview.current = preview;
  const preferences = {
    microphoneId: audioDeviceId,
    cameraId: videoDeviceId,
    speakerId: defaults.speakerDeviceId,
    noiseSuppression: defaults.noiseSuppression,
    hdVideo: defaults.hdVideo,
    backgroundMode,
  };
  useEffect(() => {
    const current = latestPreview.current;
    const saved = initial.current;
    const selection = {
      microphoneId: saved.audioDeviceId,
      cameraId: saved.videoDeviceId,
      speakerId: saved.speakerDeviceId,
      noiseSuppression: saved.noiseSuppression,
      hdVideo: saved.hdVideo,
      backgroundMode: saved.backgroundMode,
    };
    void current.refresh();
    if (saved.audioEnabled) void current.start('audio', selection);
    if (saved.videoEnabled) void current.start('video', selection);
    return () => {
      current.stop('audio');
      current.stop('video');
      current.stopSpeaker();
    };
  }, []);
  const select = (kind: 'audio' | 'video', deviceId: string) => {
    if (kind === 'audio') setAudioDeviceId(deviceId);
    else setVideoDeviceId(deviceId);
    if (preview.states[kind] !== 'idle') {
      void preview.start(kind, {
        ...preferences,
        ...(kind === 'audio' ? { microphoneId: deviceId } : { cameraId: deviceId }),
      });
    }
  };
  const toggle = (kind: 'audio' | 'video') => {
    if (preview.states[kind] !== 'idle') preview.stop(kind);
    else void preview.start(kind, preferences);
  };
  const selectBackgroundMode = (mode: MeetingBackgroundMode) => {
    setBackgroundMode(mode);
    onBackgroundModeChange?.(mode);
    // Changing an off-camera preference never requests camera permission implicitly.
    if (preview.states.video !== 'idle')
      void preview.start('video', { ...preferences, backgroundMode: mode });
  };
  const choices: LocalUserChoices = {
    username: username.trim(),
    audioDeviceId,
    videoDeviceId,
    audioEnabled: preview.states.audio === 'active',
    videoEnabled: preview.states.video === 'active',
  };
  const stop = () => {
    preview.stop('audio');
    preview.stop('video');
    preview.stopSpeaker();
  };
  return {
    preview,
    choices,
    username,
    setUsername,
    select,
    toggle,
    backgroundMode,
    selectBackgroundMode,
    stop,
    noiseSuppression: defaults.noiseSuppression,
    requesting: preview.states.audio === 'requesting' || preview.states.video === 'requesting',
  };
}
export type MeetingPrejoinSession = ReturnType<typeof useMeetingPrejoinSession>;
