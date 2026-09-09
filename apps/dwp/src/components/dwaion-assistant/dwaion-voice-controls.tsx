import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  CircleStop,
  LoaderCircle,
  Mic,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  Volume2,
  Send,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { synthesizeDwaionSpeech, transcribeDwaionVoice } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useDwaionGovernedMutation } from '../use-dwaion-governed-mutation';

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
  reviewContainer?: HTMLElement | null;
  transcriptValue?: string;
  onTranscriptChange?: (value: string) => void;
  onDiscardTranscript?: () => void;
  onSendTranscript?: () => void;
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
const COMPACT_RADIUS = foundationTokens.radius.compact + 'px';
const CONTROL_RADIUS = foundationTokens.radius.control + 'px';
const SURFACE_RADIUS = foundationTokens.radius.surface + 'px';
const PILL_RADIUS = foundationTokens.radius.surface * 10 + 'px';

export function DwaionVoiceInputControl({
  locale,
  namespace,
  disabled = false,
  onTranscript,
  reviewContainer,
  transcriptValue,
  onTranscriptChange,
  onDiscardTranscript,
  onSendTranscript,
}: DwaionVoiceInputControlProps) {
  const governTranscription = useDwaionGovernedMutation(
    'route.dwaion.work.voice-transcribe.action'
  );
  const { t } = useTranslation(namespace);
  const { t: tCommon } = useTranslation('common');
  const supported = supportsVoiceRecording();
  const [state, setState] = useState<VoiceInputState>(supported ? 'idle' : 'unsupported');
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
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
    setTranscript(null);
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
      const result = await governTranscription((authority) =>
        transcribeDwaionVoice(current.blob, locale, controller.signal, authority)
      );
      if (
        controller.signal.aborted ||
        !mounted.current ||
        generation !== lifecycleGeneration.current
      )
        return;
      onTranscript(result.text);
      setTranscript(result.text);
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
  }, [clearRecordedVoice, governTranscription, locale, onTranscript]);

  const discard = useCallback(() => {
    lifecycleGeneration.current += 1;
    requestController.current?.abort('voice-recording-discarded');
    requestController.current = null;
    clearRecordedVoice();
    setTranscript(null);
    onDiscardTranscript?.();
    if (mounted.current) setState(supported ? 'idle' : 'unsupported');
    globalThis.requestAnimationFrame(() => document.getElementById(microphoneButtonId)?.focus());
  }, [clearRecordedVoice, microphoneButtonId, onDiscardTranscript, supported]);

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
    setTranscript(null);
    if (mounted.current) setState(supported ? 'idle' : 'unsupported');
  }, [cancelActiveWork, disabled, supported]);

  const busy = state === 'requesting' || state === 'transcribing';
  const listening = state === 'listening';
  const label = state === 'recorded' ? tCommon('actions.review') : t(`dwaionVoice.input.${state}`);
  const copy = voiceReviewCopy(locale);
  const reviewSurface = (
    <>
      {(recordingUrl || (state === 'review' && transcript)) && (
        <VoicePipeline state={state} locale={locale} />
      )}
      {recordingUrl && (
        <Box
          component="section"
          data-testid="dwaion-voice-review"
          aria-label={tCommon('actions.review')}
          sx={{
            minWidth: 0,
            p: 1.5,
            mb: reviewContainer ? 1.25 : 0,
            border: 1,
            borderColor: 'primary.light',
            borderTopWidth: 3,
            borderRadius: SURFACE_RADIUS,
            bgcolor: 'background.paper',
            boxShadow: (theme) => theme.shadows[1],
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  flex: '0 0 auto',
                }}
              />
              <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
                {state === 'transcribing' ? copy.uploading : copy.recorded}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                px: 0.75,
                py: 0.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: PILL_RADIUS,
              }}
            >
              {copy.limit}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.65 }}>
            {copy.uploadBoundary}
          </Typography>
          <Box
            component="audio"
            controls
            controlsList="nodownload noplaybackrate"
            preload="metadata"
            src={recordingUrl}
            aria-label={copy.audioReview}
            sx={{ display: 'block', width: '100%', minHeight: 44, mt: 1.1 }}
          />
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
            <ActionButton
              aria-label={tCommon('actions.delete')}
              intent="quiet"
              size="small"
              startIcon={<Trash2 size={16} aria-hidden="true" />}
              onClick={discard}
              sx={{ minHeight: 44, flex: 1 }}
            >
              {copy.discard}
            </ActionButton>
            <ActionButton
              id={transcribeButtonId}
              aria-label={tCommon('actions.continue')}
              intent="primary"
              size="small"
              startIcon={<Upload size={16} aria-hidden="true" />}
              loading={state === 'transcribing'}
              loadingLabel={t('dwaionVoice.input.transcribing')}
              disabled={disabled}
              onClick={() => void transcribe()}
              sx={{ minHeight: 44, flex: 1 }}
            >
              {copy.upload}
            </ActionButton>
          </Stack>
        </Box>
      )}

      {state === 'review' && transcript && (
        <>
          <Box
            component="section"
            data-testid="dwaion-transcript-review"
            aria-label={copy.transcriptReview}
            sx={{
              minWidth: 0,
              p: 1.5,
              mb: reviewContainer ? 1.25 : 0,
              border: 1,
              borderColor: 'success.light',
              borderRadius: SURFACE_RADIUS,
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Stack
                direction="row"
                alignItems="center"
                gap={0.75}
                minWidth={0}
                color="success.main"
              >
                <CheckCircle2 size={18} color="currentColor" aria-hidden="true" />
                <Typography
                  component="h3"
                  variant="subtitle2"
                  color="text.primary"
                  fontWeight="fontWeightBold"
                >
                  {copy.transcriptReady}
                </Typography>
              </Stack>
              <Typography variant="caption" color="success.main" fontWeight="fontWeightBold">
                {copy.transcriptMeta((transcriptValue ?? transcript).trim().length)}
              </Typography>
            </Stack>
            <FormField
              value={transcriptValue ?? transcript}
              onChange={(event) => onTranscriptChange?.(event.target.value)}
              multiline
              minRows={2}
              maxRows={4}
              inputProps={{ 'aria-label': copy.editTranscript, maxLength: 4000 }}
              sx={{ mt: 0.9, '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
            />
            <Stack direction="row" gap={0.75} alignItems="flex-start" sx={{ mt: 0.8 }}>
              <ShieldCheck size={15} aria-hidden="true" />
              <Typography variant="caption" color="text.secondary">
                {copy.reviewBeforeSend}
              </Typography>
            </Stack>
            {(onDiscardTranscript || onSendTranscript) && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.1 }}>
                <ActionButton
                  intent="secondary"
                  startIcon={<Trash2 size={16} aria-hidden="true" />}
                  onClick={discard}
                  sx={{ minHeight: 44, flex: 1 }}
                >
                  {copy.discard}
                </ActionButton>
                <ActionButton
                  intent="primary"
                  startIcon={<Send size={16} aria-hidden="true" />}
                  disabled={!onSendTranscript || !(transcriptValue ?? transcript).trim()}
                  onClick={onSendTranscript}
                  sx={{ minHeight: 44, flex: 1 }}
                >
                  {copy.send}
                </ActionButton>
              </Stack>
            )}
          </Box>
          <Box
            role="note"
            sx={{
              mb: reviewContainer ? 1.25 : 0,
              p: 1.1,
              border: 1,
              borderColor: 'warning.light',
              borderRadius: SURFACE_RADIUS,
              bgcolor: 'warning.lighter',
              color: 'warning.dark',
            }}
          >
            <Typography variant="caption">{copy.voiceNotice}</Typography>
          </Box>
        </>
      )}

      {state === 'error' && (
        <Box
          role="alert"
          sx={{
            p: 1.2,
            mb: reviewContainer ? 1.25 : 0,
            border: 1,
            borderColor: 'error.light',
            borderRadius: CONTROL_RADIUS,
            color: 'error.main',
            bgcolor: 'error.lighter',
          }}
        >
          <Typography variant="caption">{copy.error}</Typography>
        </Box>
      )}
    </>
  );

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
      {reviewContainer ? createPortal(reviewSurface, reviewContainer) : reviewSurface}
    </Stack>
  );
}

function VoicePipeline({ state, locale }: { state: VoiceInputState; locale: string }) {
  const korean = resolveSupportedLocale(locale) === 'ko';
  const labels = korean
    ? ['1. 명시 시작', '2. 권한 허용', '3. 녹음 완료', '4. 일괄 전사', '5. 검토·전송']
    : ['1. Start', '2. Permission', '3. Recorded', '4. Transcribed', '5. Review & send'];
  const active = state === 'review' ? 4 : state === 'transcribing' ? 3 : 2;
  return (
    <Box
      component="section"
      aria-label={korean ? '음성 대화 안전 절차' : 'Voice safe boundary'}
      sx={{
        mb: 1,
        p: 1,
        border: 1,
        borderColor: 'primary.light',
        borderRadius: SURFACE_RADIUS,
        bgcolor: 'primary.lighter',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="caption" fontWeight="fontWeightBold">
          {korean ? '음성 대화 절차' : 'Voice safe boundary'}
        </Typography>
        <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
          {korean ? '5단계 파이프라인' : '5-step pipeline'}
        </Typography>
      </Stack>
      <Box
        sx={{
          mt: 0.75,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 0.4,
        }}
      >
        {labels.map((label, index) => (
          <Box
            key={label}
            sx={{
              p: 0.55,
              borderRadius: COMPACT_RADIUS,
              bgcolor: index === active ? 'primary.main' : 'action.selected',
              color: index === active ? 'primary.contrastText' : 'text.secondary',
              textAlign: 'center',
              fontSize: 'caption.fontSize',
              lineHeight: 'caption.lineHeight',
              fontWeight: index === active ? 'fontWeightBold' : 'fontWeightMedium',
              overflowWrap: 'anywhere',
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
    </Box>
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
  const governSynthesis = useDwaionGovernedMutation('route.dwaion.work.voice-synthesize.action');
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
      const blob = await governSynthesis((authority) =>
        synthesizeDwaionSpeech(text, locale, nextController.signal, authority)
      );
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

function voiceReviewCopy(locale: string) {
  if (resolveSupportedLocale(locale) === 'ko') {
    return {
      recorded: '녹음 검토',
      uploading: '음성을 받아쓰는 중',
      limit: '최대 45초',
      uploadBoundary:
        '먼저 녹음을 확인하세요. “업로드 및 받아쓰기”를 선택할 때만 승인된 음성 처리 경로로 전송됩니다.',
      audioReview: '업로드 전 녹음 듣기',
      discard: '녹음 폐기',
      upload: '업로드 및 받아쓰기',
      transcriptReview: '받아쓰기 검토',
      transcriptReady: '받아쓰기가 준비되었습니다',
      transcriptMeta: (count: number) => `일괄 STT · ${count}자`,
      editTranscript: '전송 전 받아쓰기 수정',
      reviewBeforeSend: '아래 질문 입력란에서 텍스트를 수정한 뒤, 준비되었을 때 직접 전송하세요.',
      send: '검토 후 전송',
      voiceNotice:
        '마이크 권한을 거부하거나 받아쓰기에 실패해도 아래 키보드 입력으로 즉시 업무를 이어갈 수 있습니다.',
      error:
        '마이크 권한이나 음성 처리 경로를 확인하지 못했습니다. 키보드로 계속하거나 다시 시도하세요.',
    };
  }
  return {
    recorded: 'Review recording',
    uploading: 'Transcribing voice',
    limit: '45 seconds max',
    uploadBoundary:
      'Review the recording first. It is sent to the approved voice processing route only after you choose Upload and transcribe.',
    audioReview: 'Listen to recording before upload',
    discard: 'Discard recording',
    upload: 'Upload and transcribe',
    transcriptReview: 'Transcript review',
    transcriptReady: 'Transcript is ready',
    transcriptMeta: (count: number) => `Batch STT · ${count} characters`,
    editTranscript: 'Edit transcript before sending',
    reviewBeforeSend:
      'Edit the text in the question field below, then send it yourself when ready.',
    send: 'Review and send',
    voiceNotice:
      'If microphone access is denied or transcription fails, continue immediately with the keyboard below.',
    error:
      'Microphone access or voice processing could not be verified. Continue with the keyboard or try again.',
  };
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
