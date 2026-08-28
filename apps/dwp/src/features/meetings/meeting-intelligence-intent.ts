const INTELLIGENCE_INTENT_TTL_MS = 15 * 60 * 1_000;

export type StoredIntelligenceIntent = {
  fingerprint: string;
  idempotencyKey: string;
  baselineReportId: string | null;
  expiresAt: number;
};

function intelligenceIntentStorageKey(meetingId: string): string {
  return `dwp.meeting-intelligence.intent.v1:${meetingId}`;
}

export function readStoredIntelligenceIntent(meetingId: string): StoredIntelligenceIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(intelligenceIntentStorageKey(meetingId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<StoredIntelligenceIntent>;
    if (
      typeof parsed.fingerprint !== 'string' ||
      typeof parsed.idempotencyKey !== 'string' ||
      !/^[0-9a-f-]{36}$/u.test(parsed.idempotencyKey) ||
      (parsed.baselineReportId !== null && typeof parsed.baselineReportId !== 'string') ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(intelligenceIntentStorageKey(meetingId));
      return null;
    }
    return parsed as StoredIntelligenceIntent;
  } catch {
    return null;
  }
}

export function createStoredIntelligenceIntent(
  fingerprint: string,
  baselineReportId: string | null
): StoredIntelligenceIntent {
  return {
    fingerprint,
    idempotencyKey: crypto.randomUUID(),
    baselineReportId,
    expiresAt: Date.now() + INTELLIGENCE_INTENT_TTL_MS,
  };
}

export function persistIntelligenceIntent(
  meetingId: string,
  intent: StoredIntelligenceIntent
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(intelligenceIntentStorageKey(meetingId), JSON.stringify(intent));
  } catch {
    // The in-memory ref still preserves same-page retries when browser storage is unavailable.
  }
}

export function clearIntelligenceIntent(meetingId: string, idempotencyKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = readStoredIntelligenceIntent(meetingId);
    if (stored?.idempotencyKey === idempotencyKey) {
      window.localStorage.removeItem(intelligenceIntentStorageKey(meetingId));
    }
  } catch {
    // A storage failure must not replace the authoritative server result.
  }
}
