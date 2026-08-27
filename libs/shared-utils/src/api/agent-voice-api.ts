import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

type AgentSchemas = AgentComponents['schemas'];

export type DwaionVoiceTranscription = AgentSchemas['VoiceTranscription'];

const MAX_RECORDING_BYTES = 4 * 1024 * 1024;
const MAX_SPEECH_BYTES = 8 * 1024 * 1024;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
]);

export async function transcribeDwaionVoice(
  recording: Blob,
  locale: string,
  signal?: AbortSignal
): Promise<DwaionVoiceTranscription> {
  const normalizedLocale = validateLocale(locale);
  const mediaType = recording.type.split(';', 1)[0]?.trim().toLowerCase();
  if (
    recording.size < 1 ||
    recording.size > MAX_RECORDING_BYTES ||
    !mediaType ||
    !AUDIO_TYPES.has(mediaType)
  ) {
    throw new TypeError('DWAI-ON voice recording is invalid.');
  }
  const response = await axiosInstance.post<ApiResponse<unknown>, Blob>(
    '/api/agent/v1/voice/transcriptions',
    recording,
    {
      headers: { 'X-DWP-Voice-Locale': normalizedLocale },
      signal,
      timeoutMs: 35_000,
    }
  );
  if (!isTranscription(response.data.data)) {
    throw new HttpError('DWAI-ON voice transcription response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function synthesizeDwaionSpeech(
  text: string,
  locale: string,
  signal?: AbortSignal
): Promise<Blob> {
  const normalizedText = text.trim();
  const normalizedLocale = validateLocale(locale);
  if (!normalizedText || normalizedText.length > 4_000) {
    throw new TypeError('DWAI-ON speech content is invalid.');
  }
  const response = await axiosInstance.post<Blob, AgentSchemas['VoiceSpeechRequest']>(
    '/api/agent/v1/voice/speech',
    { text: normalizedText, locale: normalizedLocale },
    { responseType: 'blob', signal, timeoutMs: 35_000 }
  );
  if (
    !(response.data instanceof Blob) ||
    response.data.size < 1 ||
    response.data.size > MAX_SPEECH_BYTES ||
    !['audio/mpeg', 'audio/mp3'].includes(response.data.type.toLowerCase())
  ) {
    throw new HttpError('DWAI-ON speech response is invalid.', 502);
  }
  return response.data;
}

function validateLocale(locale: string): string {
  const normalized = locale.trim();
  if (!LOCALE_PATTERN.test(normalized)) {
    throw new TypeError('DWAI-ON voice locale is invalid.');
  }
  return normalized;
}

function isTranscription(value: unknown): value is DwaionVoiceTranscription {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.text === 'string' &&
    record.text.trim().length > 0 &&
    record.text.length <= 4_000 &&
    typeof record.language === 'string' &&
    LOCALE_PATTERN.test(record.language)
  );
}
