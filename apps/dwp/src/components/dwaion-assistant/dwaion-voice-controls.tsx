import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleStop, LoaderCircle, Mic, Square, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton } from '@dwp-frontend/design-system';
import { synthesizeDwaionSpeech, transcribeDwaionVoice } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type VoiceInputState =
  'idle' | 'requesting' | 'listening' | 'transcribing' | 'review' | 'error' | 'unsupported';

type DwaionVoiceInputControlProps = {
  locale: string;
  namespace: 'home' | 'work';
  disabled?: boolean;
  onTranscript: (text: string) => void;
};

type ActiveRecording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  timeout: ReturnType<typeof globalThis.setTimeout>;
};

const MAX_RECORDING_MS = 45_000;

export function DwaionVoiceInputControl({
  locale,
  namespace,
  disabled = false,
  onTranscript,
}: DwaionVoiceInputControlProps) {
  const { t } = useTranslation(namespace);
  const supported = supportsVoiceRecording();
  const [state, setState] = useState<VoiceInputState>(supported ? 'idle' : 'unsupported');
  const active = useRef<ActiveRecording | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const lifecycleGeneration = useRef(0);
  const mounted = useRef(false);

  const cancelActiveWork = useCallback((reason: string) => {
    lifecycleGeneration.current += 1;
    requestController.current?.abort(reason);
    requestController.current = null;
    const current = active.current;
    active.current = null;
    if (current) releaseRecording(current);
  }, []);

  const stop = useCallback(() => {
    const current = active.current;
    if (!current) return;
    globalThis.clearTimeout(current.timeout);
    if (current.recorder.state !== 'inactive') current.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (disabled || !supported || active.current) return;
    const generation = ++lifecycleGeneration.current;
    setState('requesting');
    let stream: MediaStream | null = null;
    let recording: ActiveRecording | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (!mounted.current || generation !== lifecycleGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = selectVoiceRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const nextRecording: ActiveRecording = {
        recorder,
        stream,
        chunks: [],
        timeout: globalThis.setTimeout(stop, MAX_RECORDING_MS),
      };
      recording = nextRecording;
      active.current = nextRecording;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) nextRecording.chunks.push(event.data);
      };
      recorder.onstop = () => {
        globalThis.clearTimeout(nextRecording.timeout);
        nextRecording.stream.getTracks().forEach((track) => track.stop());
        if (active.current === nextRecording) active.current = null;
        if (!mounted.current || generation !== lifecycleGeneration.current) return;
        const blob = new Blob(nextRecording.chunks, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        if (!blob.size) {
          setState('error');
          return;
        }
        setState('transcribing');
        const controller = new AbortController();
        requestController.current = controller;
        void transcribeDwaionVoice(blob, locale, controller.signal)
          .then((result) => {
            if (
              controller.signal.aborted ||
              !mounted.current ||
              generation !== lifecycleGeneration.current
            )
              return;
            onTranscript(result.text);
            setState('review');
          })
          .catch(() => {
            if (
              !controller.signal.aborted &&
              mounted.current &&
              generation === lifecycleGeneration.current
            )
              setState('error');
          })
          .finally(() => {
            if (requestController.current === controller) requestController.current = null;
          });
      };
      recorder.onerror = () => {
        globalThis.clearTimeout(nextRecording.timeout);
        nextRecording.stream.getTracks().forEach((track) => track.stop());
        if (active.current === nextRecording) active.current = null;
        if (mounted.current && generation === lifecycleGeneration.current) setState('error');
      };
      recorder.start(250);
      setState('listening');
    } catch {
      if (recording) {
        if (active.current === recording) active.current = null;
        releaseRecording(recording);
      } else {
        stream?.getTracks().forEach((track) => track.stop());
      }
      if (mounted.current && generation === lifecycleGeneration.current) setState('error');
    }
  }, [disabled, locale, onTranscript, stop, supported]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelActiveWork('voice-control-unmounted');
    };
  }, [cancelActiveWork]);

  useEffect(() => {
    if (!disabled) return;
    cancelActiveWork('voice-control-disabled');
    if (mounted.current) setState(supported ? 'idle' : 'unsupported');
  }, [cancelActiveWork, disabled, supported]);

  const busy = state === 'requesting' || state === 'transcribing';
  const listening = state === 'listening';
  const label = t(`dwaionVoice.input.${state}`);

  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
      {state !== 'idle' && (
        <Typography
          variant="caption"
          color={state === 'error' ? 'error.main' : 'text.secondary'}
          sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}
        >
          {label}
        </Typography>
      )}
      <ActionIconButton
        label={label}
        tooltip={label}
        intent={listening ? 'danger' : state === 'review' ? 'primary' : 'default'}
        disabled={disabled || state === 'unsupported' || busy}
        onClick={listening ? stop : () => void start()}
        sx={{ width: 44, height: 44, flex: '0 0 auto' }}
      >
        {listening ? (
          <Square size={16} fill="currentColor" aria-hidden="true" />
        ) : busy ? (
          <LoaderCircle size={18} aria-hidden="true" />
        ) : (
          <Mic size={19} aria-hidden="true" />
        )}
      </ActionIconButton>
      <Box role="status" aria-live="polite" aria-atomic="true" sx={visuallyHidden}>
        {state === 'idle' ? '' : label}
      </Box>
    </Stack>
  );
}

type DwaionSpeechButtonProps = {
  text: string;
  locale: string;
  namespace: 'home' | 'work';
  size?: 'small' | 'medium';
};

export function DwaionSpeechButton({
  text,
  locale,
  namespace,
  size = 'small',
}: DwaionSpeechButtonProps) {
  const { t } = useTranslation(namespace);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const controller = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const mounted = useRef(false);

  const releaseAudio = useCallback(() => {
    const currentAudio = audio.current;
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.src = '';
      audio.current = null;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }, []);

  const dispose = useCallback(
    (reason: string) => {
      controller.current?.abort(reason);
      controller.current = null;
      releaseAudio();
    },
    [releaseAudio]
  );

  const reset = useCallback(() => {
    dispose('speech-stopped');
    if (mounted.current) setState('idle');
  }, [dispose]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      dispose('speech-control-unmounted');
    };
  }, [dispose]);

  const play = async () => {
    if (state === 'loading' || state === 'playing') {
      reset();
      return;
    }
    dispose('speech-replaced');
    setState('loading');
    const nextController = new AbortController();
    controller.current = nextController;
    try {
      const blob = await synthesizeDwaionSpeech(text, locale, nextController.signal);
      if (nextController.signal.aborted || !mounted.current) return;
      const url = URL.createObjectURL(blob);
      const nextAudio = new Audio(url);
      objectUrl.current = url;
      audio.current = nextAudio;
      nextAudio.onended = reset;
      nextAudio.onerror = () => {
        if (audio.current !== nextAudio) return;
        releaseAudio();
        if (mounted.current) setState('error');
      };
      await nextAudio.play();
      if (nextController.signal.aborted || !mounted.current || audio.current !== nextAudio) return;
      setState('playing');
    } catch {
      if (!nextController.signal.aborted) {
        releaseAudio();
        if (mounted.current) setState('error');
      }
    } finally {
      if (controller.current === nextController) controller.current = null;
    }
  };

  const label = t(`dwaionVoice.speech.${state}`);
  return (
    <>
      <ActionIconButton
        label={label}
        tooltip={label}
        size={size}
        intent={state === 'playing' ? 'primary' : 'default'}
        onClick={() => void play()}
      >
        {state === 'playing' ? (
          <CircleStop size={16} aria-hidden="true" />
        ) : state === 'loading' ? (
          <LoaderCircle size={16} aria-hidden="true" />
        ) : (
          <Volume2 size={16} aria-hidden="true" />
        )}
      </ActionIconButton>
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {state === 'idle' ? '' : label}
      </Box>
    </>
  );
}

export function selectVoiceRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function')
    return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
}

function releaseRecording(recording: ActiveRecording): void {
  globalThis.clearTimeout(recording.timeout);
  recording.recorder.ondataavailable = null;
  recording.recorder.onstop = null;
  recording.recorder.onerror = null;
  if (recording.recorder.state !== 'inactive') recording.recorder.stop();
  recording.stream.getTracks().forEach((track) => track.stop());
}

function supportsVoiceRecording(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  p: 0,
  m: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
