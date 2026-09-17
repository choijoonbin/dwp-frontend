import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, ShieldCheck } from 'lucide-react';
import { ActionButton, ContentDialog, InlineFeedback } from '@dwp-frontend/design-system';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useWorkplaceAssistantCopy } from './workplace-assistant-copy';

type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };
type SpeechEvent = Event & { resultIndex: number; results: SpeechResultList };
type SpeechErrorEvent = Event & { error: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function isWorkplaceSpeechRecognitionSupported() {
  return speechRecognitionConstructor() !== null;
}

function mergeTranscript(base: string, spoken: string) {
  return [base.trim(), spoken.trim()].filter(Boolean).join(' ');
}

export function WorkplaceAssistantVoiceInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const copy = useWorkplaceAssistantCopy();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [consented, setConsented] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isWorkplaceSpeechRecognitionSupported();

  useEffect(
    () => () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      }
      recognitionRef.current = null;
    },
    []
  );

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const start = () => {
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setError(copy.voiceUnsupported);
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
    }
    const recognition = new Recognition();
    baseTextRef.current = value;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? '';
      }
      onChange(mergeTranscript(baseTextRef.current, transcript));
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(copy.text(copy.voiceError, { reason: event.error }));
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError(copy.voiceErrorGeneric);
    }
  };

  const activate = () => {
    if (listening) {
      stop();
      return;
    }
    if (!supported) {
      setError(copy.voiceUnsupported);
      return;
    }
    if (!consented) {
      setConsentOpen(true);
      return;
    }
    start();
  };
  const closeConsent = () => {
    setConsentOpen(false);
    setConsented(false);
  };

  return (
    <Stack spacing={0.75} alignItems="flex-start">
      <ActionButton
        intent={listening ? 'danger' : 'quiet'}
        size="small"
        startIcon={listening ? <MicOff size={16} /> : <Mic size={16} />}
        disabled={disabled}
        aria-pressed={listening}
        onClick={activate}
      >
        {listening ? copy.voiceStop : copy.voiceStart}
      </ActionButton>
      <Typography
        variant="caption"
        color={error ? 'error' : 'text.secondary'}
        role="status"
        aria-live="polite"
      >
        {error ?? (listening ? copy.voiceListening : copy.voiceEditable)}
      </Typography>
      <ContentDialog
        open={consentOpen}
        title={copy.voiceConsentTitle}
        description={copy.voiceConsentDescription}
        closeLabel={copy.voiceCancel}
        maxWidth="xs"
        onClose={closeConsent}
        titleStart={<ShieldCheck size={20} />}
        footerContent={
          <>
            <ActionButton intent="quiet" onClick={closeConsent}>
              {copy.voiceCancel}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Mic size={16} />}
              disabled={!consented}
              onClick={() => {
                setConsentOpen(false);
                start();
              }}
            >
              {copy.voiceBegin}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={1.5}>
          <InlineFeedback severity="info">{copy.voicePrivacy}</InlineFeedback>
          <FormControlLabel
            control={
              <Checkbox
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
              />
            }
            label={copy.voiceConsent}
          />
        </Stack>
      </ContentDialog>
    </Stack>
  );
}
