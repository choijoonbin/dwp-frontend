import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CircleStop, LoaderCircle, Mic, Square, Trash2, Upload, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import { synthesizeDwaionSpeech, transcribeDwaionVoice } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type VoiceInputState =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'recorded'
  | 'transcribing'
  | 'review'
  | 'error'
  | 'unsupported';

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

type RecordedVoice = {
  blob: Blob;
  objectUrl: string;
};

const MAX_RECORDING_MS = 45_000;

export function DwaionVoiceInputControl({
  locale,
  namespace,
  disabled = false,
  onTranscript,
}: DwaionVoiceInputControlProps) {
  const { t } = useTranslation(namespace);
  const { t: tCommon } = useTranslation('common');
  const supported = supportsVoiceRecording();
  const [state, setState] = useState<VoiceInputState>(supported ? 'idle' : 'unsupported');
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const active = useRef<ActiveRecording | null>(null);
  const recorded = useRef<RecordedVoice | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const lifecycleGeneration = useRef(0);
  const mounted = useRef(false);
  const microphoneButtonId = useId();
  const transcribeButtonId = useId();

  const clearRecordedVoice = useCallback(() => {
    const current = recorded.current;
    recorded.current = null;
    if (current) URL.revokeObjectURL(current.objectUrl);
    if (mounted.current) setRecordingUrl(null);
  }, []);

  const cancelActiveWork = useCallback(
    (reason: string) => {
      lifecycleGeneration.current += 1;
      requestController.current?.abort(reason);
      requestController.current = null;
      const current = active.current;
      active.current = null;
      if (current) releaseRecording(current);
      clearRecordedVoice();
    },
    [clearRecordedVoice]
  );

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
        const objectUrl = URL.createObjectURL(blob);
        clearRecordedVoice();
        recorded.current = { blob, objectUrl };
        setRecordingUrl(objectUrl);
        setState('recorded');
        globalThis.requestAnimationFrame(() =>
          document.getElementById(transcribeButtonId)?.focus()
        );
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
  }, [clearRecordedVoice, disabled, stop, supported, transcribeButtonId]);

  const transcribe = useCallback(async () => {
    const current = recorded.current;
    if (!current || requestController.current) return;
    const generation = lifecycleGeneration.current;
    const controller = new AbortController();
    requestController.current = controller;
    setState('transcribing');
    try {
      const result = await transcribeDwaionVoice(current.blob, locale, controller.signal);
      if (
        controller.signal.aborted ||
        !mounted.current ||
        generation !== lifecycleGeneration.current
      )
        return;
      onTranscript(result.text);
      clearRecordedVoice();
      setState('review');
    } catch {
      if (
        !controller.signal.aborted &&
        mounted.current &&
        generation === lifecycleGeneration.current
      )
        setState('error');
    } finally {
      if (requestController.current === controller) requestController.current = null;
    }
  }, [clearRecordedVoice, locale, onTranscript]);

  const discard = useCallback(() => {
    lifecycleGeneration.current += 1;
    requestController.current?.abort('voice-recording-discarded');
    requestController.current = null;
    clearRecordedVoice();
    if (mounted.current) setState(supported ? 'idle' : 'unsupported');
    globalThis.requestAnimationFrame(() => document.getElementById(microphoneButtonId)?.focus());
  }, [clearRecordedVoice, microphoneButtonId, supported]);

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
  const label = state === 'recorded' ? tCommon('actions.review') : t(`dwaionVoice.input.${state}`);

  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
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
          id={microphoneButtonId}
          label={label}
          tooltip={label}
          intent={listening ? 'danger' : state === 'review' ? 'primary' : 'default'}
          disabled={disabled || state === 'unsupported' || busy || Boolean(recordingUrl)}
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

      {recordingUrl && (
        <Box
          component="section"
          data-testid="dwaion-voice-review"
          aria-label={tCommon('actions.review')}
          sx={{ minWidth: { xs: 'min(100%, 240px)', sm: 280 } }}
        >
          <Box
            component="audio"
            controls
            controlsList="nodownload noplaybackrate"
            preload="metadata"
            src={recordingUrl}
            aria-label={tCommon('actions.review')}
            sx={{ display: 'block', width: '100%', minHeight: 44 }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<Trash2 size={16} aria-hidden="true" />}
              onClick={discard}
              sx={{ minHeight: 44, flex: 1 }}
            >
              {tCommon('actions.delete')}
            </ActionButton>
            <ActionButton
              id={transcribeButtonId}
              intent="primary"
              size="small"
              startIcon={<Upload size={16} aria-hidden="true" />}
              loading={state === 'transcribing'}
              loadingLabel={t('dwaionVoice.input.transcribing')}
              disabled={disabled}
              onClick={() => void transcribe()}
              sx={{ minHeight: 44, flex: 1 }}
            >
              {tCommon('actions.continue')}
            </ActionButton>
          </Stack>
        </Box>
      )}
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
        sx={{ width: 44, height: 44 }}
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
