import { useEffect, useRef, useState } from 'react';
import {
  MeetingDeviceSession,
  meetingDeviceFailure,
  type MeetingDeviceFailure,
  type MeetingPreviewKind,
} from './meeting-device-session';
import type { MeetingDevicePreferences } from './meeting-preferences-model';

type PreviewState = 'idle' | 'requesting' | 'active';

function closeContext(context: AudioContext) {
  try {
    void Promise.resolve(context.close()).catch(() => undefined);
  } catch {
    /* Browsers may reject closing an already closed context synchronously. */
  }
}

export function useMeetingDevicePreview(revocation?: AbortSignal) {
  const session = useRef<MeetingDeviceSession | null>(null);
  const alive = useRef(false);
  const attempts = useRef({ audio: 0, video: 0, speaker: 0, inventory: 0 });
  const contexts = useRef(new Set<AudioContext>());
  const speakerCleanup = useRef<(() => void) | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<MeetingDeviceFailure | null>(null);
  const [streams, setStreams] = useState<Partial<Record<MeetingPreviewKind, MediaStream>>>({});
  const [states, setStates] = useState<Record<MeetingPreviewKind, PreviewState>>({
    audio: 'idle',
    video: 'idle',
  });
  const [speakerActive, setSpeakerActive] = useState(false);
  const [level, setLevel] = useState(0);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    alive.current = !revocation?.aborted;
    try {
      session.current =
        alive.current && navigator.mediaDevices
          ? new MeetingDeviceSession(navigator.mediaDevices)
          : null;
    } catch {
      session.current = null;
      setError('unsupported');
    }
    const release = () => {
      alive.current = false;
      attempts.current.audio++;
      attempts.current.video++;
      attempts.current.speaker++;
      attempts.current.inventory++;
      session.current?.dispose();
      session.current = null;
      speakerCleanup.current?.();
      speakerCleanup.current = null;
      contexts.current.forEach(closeContext);
      contexts.current.clear();
    };
    revocation?.addEventListener('abort', release, { once: true });
    return () => {
      revocation?.removeEventListener('abort', release);
      release();
    };
  }, [revocation]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = streams.video ?? null;
    return () => {
      element.srcObject = null;
    };
  }, [streams.video]);

  useEffect(() => {
    const stream = streams.audio;
    if (!stream) return;
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let analyser: AnalyserNode | undefined;
    let frame = 0;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      cancelAnimationFrame(frame);
      try {
        source?.disconnect();
      } catch {
        /* already detached */
      }
      try {
        analyser?.disconnect();
      } catch {
        /* already detached */
      }
      if (context) {
        contexts.current.delete(context);
        closeContext(context);
      }
    };
    const fail = (failure: unknown) => {
      if (released) return;
      release();
      session.current?.stop('audio');
      if (!alive.current) return;
      setError(meetingDeviceFailure(failure));
      setLevel(0);
      setStreams((current) => ({ ...current, audio: undefined }));
      setStates((current) => ({ ...current, audio: 'idle' }));
    };
    try {
      if (typeof AudioContext === 'undefined')
        throw new DOMException('Audio analysis unavailable', 'NotSupportedError');
      context = new AudioContext();
      contexts.current.add(context);
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser); // No speaker connection, recording or upload.
      const samples = new Uint8Array(analyser.fftSize);
      const sample = () => {
        if (released || !alive.current) return;
        try {
          analyser?.getByteTimeDomainData(samples);
          const rms = Math.sqrt(
            samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length
          );
          setLevel(Math.min(100, Math.round(rms * 400)));
          frame = requestAnimationFrame(sample);
        } catch (failure) {
          fail(failure);
        }
      };
      void context.resume().then(sample, fail);
    } catch (failure) {
      fail(failure);
    }
    return release;
  }, [streams.audio]);

  useEffect(() => {
    const cleanup: (() => void)[] = [];
    (['audio', 'video'] as const).forEach((kind) =>
      streams[kind]?.getTracks().forEach((track) => {
        const ended = () => {
          if (!alive.current) return;
          attempts.current[kind]++;
          session.current?.stop(kind);
          setStates((current) => ({ ...current, [kind]: 'idle' }));
          setStreams((current) => ({ ...current, [kind]: undefined }));
          setError('notFound');
          if (kind === 'audio') setLevel(0);
        };
        track.addEventListener('ended', ended);
        cleanup.push(() => track.removeEventListener('ended', ended));
      })
    );
    return () => cleanup.forEach((remove) => remove());
  }, [streams]);

  const stop = (kind: MeetingPreviewKind) => {
    attempts.current[kind]++;
    session.current?.stop(kind);
    if (!alive.current) return;
    setStreams((current) => ({ ...current, [kind]: undefined }));
    setStates((current) => ({ ...current, [kind]: 'idle' }));
    if (kind === 'audio') setLevel(0);
  };
  const refresh = async () => {
    if (!alive.current) return;
    if (!session.current) {
      setError('unsupported');
      return;
    }
    const attempt = ++attempts.current.inventory;
    try {
      const inventory = await session.current.enumerate();
      if (alive.current && attempts.current.inventory === attempt) setDevices(inventory);
    } catch (failure) {
      if (alive.current && attempts.current.inventory === attempt)
        setError(meetingDeviceFailure(failure));
    }
  };
  const start = async (kind: MeetingPreviewKind, preferences: MeetingDevicePreferences) => {
    if (!alive.current) return;
    if (!session.current) {
      setError('unsupported');
      return;
    }
    const attempt = ++attempts.current[kind];
    setError(null);
    setStates((current) => ({ ...current, [kind]: 'requesting' }));
    try {
      const stream = await session.current.start(
        kind,
        kind === 'audio' ? preferences.microphoneId : preferences.cameraId,
        preferences.noiseSuppression
      );
      if (!alive.current || attempts.current[kind] !== attempt || !stream) return;
      setStreams((current) => ({ ...current, [kind]: stream }));
      setStates((current) => ({ ...current, [kind]: 'active' }));
      await refresh();
    } catch (failure) {
      if (!alive.current || attempts.current[kind] !== attempt) return;
      setError(meetingDeviceFailure(failure));
      setStates((current) => ({ ...current, [kind]: 'idle' }));
    }
  };
  const stopSpeaker = () => {
    attempts.current.speaker++;
    speakerCleanup.current?.();
    speakerCleanup.current = null;
    if (alive.current) setSpeakerActive(false);
  };
  const testSpeaker = async (speakerId: string) => {
    if (!alive.current || speakerCleanup.current) return;
    const attempt = ++attempts.current.speaker;
    let context: AudioContext | undefined;
    let oscillator: OscillatorNode | undefined;
    let gain: GainNode | undefined;
    let cancel!: () => void;
    const cancelled = new Promise<void>((resolve) => {
      cancel = resolve;
    });
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      cancel();
      if (oscillator) oscillator.onended = null;
      try {
        oscillator?.stop();
      } catch {
        /* never started or already stopped */
      }
      try {
        oscillator?.disconnect();
      } catch {
        /* already detached */
      }
      try {
        gain?.disconnect();
      } catch {
        /* already detached */
      }
      if (context) {
        contexts.current.delete(context);
        closeContext(context);
      }
    };
    speakerCleanup.current = release;
    setError(null);
    setSpeakerActive(true);
    try {
      if (typeof AudioContext === 'undefined')
        throw new DOMException('Audio output unavailable', 'NotSupportedError');
      context = new AudioContext();
      contexts.current.add(context);
      const output = context as AudioContext & { setSinkId?: (id: string) => Promise<void> };
      if (speakerId !== 'default') {
        if (!output.setSinkId)
          throw new DOMException('Output selection unavailable', 'NotSupportedError');
        await Promise.race([output.setSinkId(speakerId), cancelled]);
      }
      if (released || !alive.current || attempts.current.speaker !== attempt) return;
      await Promise.race([context.resume(), cancelled]);
      if (released || !alive.current || attempts.current.speaker !== attempt) return;
      oscillator = context.createOscillator();
      gain = context.createGain();
      gain.gain.setValueAtTime(0.05, context.currentTime);
      oscillator.frequency.value = 440;
      oscillator.connect(gain);
      gain.connect(context.destination);
      const ended = new Promise<void>((resolve) => {
        if (oscillator) oscillator.onended = () => resolve();
      });
      oscillator.start();
      oscillator.stop(context.currentTime + 0.35);
      await Promise.race([ended, cancelled]);
    } catch (failure) {
      if (alive.current && attempts.current.speaker === attempt)
        setError(meetingDeviceFailure(failure));
    } finally {
      release();
      if (speakerCleanup.current === release) speakerCleanup.current = null;
      if (alive.current && attempts.current.speaker === attempt) setSpeakerActive(false);
    }
  };
  return {
    devices,
    states,
    video,
    level,
    error,
    speakerActive,
    start,
    stop,
    refresh,
    testSpeaker,
    stopSpeaker,
  };
}
