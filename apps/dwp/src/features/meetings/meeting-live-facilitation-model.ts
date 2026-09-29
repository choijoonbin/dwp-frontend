import type {
  VideoMeetingFacilitationSnapshot,
  VideoMeetingFacilitationTimer,
} from '@dwp-frontend/shared-utils/api/video-meeting-facilitation-api';

export const FACILITATION_POLL_FALLBACK_MS = 3_000;

export function facilitationPollingInterval(
  snapshot: VideoMeetingFacilitationSnapshot | undefined
) {
  const value = snapshot?.pollingIntervalMillis;
  return Number.isFinite(value)
    ? Math.max(2_000, Math.min(10_000, value!))
    : FACILITATION_POLL_FALLBACK_MS;
}

export function facilitationTimerProgress(timer: VideoMeetingFacilitationTimer) {
  if (!timer.plannedSeconds || timer.plannedSeconds <= 0) return 0;
  return Math.min(100, Math.max(0, (timer.elapsedSeconds / timer.plannedSeconds) * 100));
}

export function countdownParts(seconds: number | null) {
  const bounded = Math.max(0, Math.trunc(seconds ?? 0));
  return {
    minutes: Math.floor(bounded / 60),
    seconds: bounded % 60,
  };
}

export function validPollDraft(question: string, options: readonly string[]) {
  const normalized = options.map((value) => value.trim()).filter(Boolean);
  return (
    question.trim().length > 0 && new Set(normalized.map((value) => value.toLowerCase())).size >= 2
  );
}
