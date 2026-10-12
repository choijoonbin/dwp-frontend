import {
  parseWorkCalendarEventHandoff,
  type WorkCalendarEventHandoffState,
} from './work-hub-calendar-api';
import { WORK_CALENDAR_DOCUMENT_HANDOFF_KEY } from './work-calendar-document-handoff-cleanup';

export {
  clearWorkCalendarDocumentHandoff,
  WORK_CALENDAR_DOCUMENT_HANDOFF_KEY,
} from './work-calendar-document-handoff-cleanup';

type WorkCalendarDocumentHandoffEnvelope = Readonly<{
  version: 1;
  destination: 'CALENDAR_SCHEDULE';
  state: WorkCalendarEventHandoffState;
}>;

function browserSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function removeStoredEnvelope(storage: Storage): void {
  try {
    storage.removeItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY);
  } catch {
    // Storage cleanup is best-effort when the browser revokes storage access mid-navigation.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Records one tab-scoped handoff without exposing Work identity or draft data in the URL. */
export function persistWorkCalendarDocumentHandoff(
  state: WorkCalendarEventHandoffState,
  now = Date.now(),
  storage: Storage | null = browserSessionStorage()
): boolean {
  if (!storage) return false;
  const handoff = parseWorkCalendarEventHandoff(state, now);
  if (!handoff) return false;
  const envelope: WorkCalendarDocumentHandoffEnvelope = {
    version: 1,
    destination: 'CALENDAR_SCHEDULE',
    state: { workCalendarEventHandoff: handoff },
  };
  try {
    storage.setItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    // Do not let an older command survive when the browser rejects the replacement.
    removeStoredEnvelope(storage);
    return false;
  }
}

/** Indicates that Calendar must wait for owner and permission validation before opening a draft. */
export function hasWorkCalendarDocumentHandoff(
  storage: Storage | null = browserSessionStorage()
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY) !== null;
  } catch {
    return false;
  }
}

/** Reads structurally valid, fresh transport data without yet treating it as authorized. */
export function readWorkCalendarDocumentHandoff(
  now = Date.now(),
  storage: Storage | null = browserSessionStorage()
): WorkCalendarEventHandoffState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY);
    if (!raw) return null;
    const envelope: unknown = JSON.parse(raw);
    if (
      !isRecord(envelope) ||
      envelope.version !== 1 ||
      envelope.destination !== 'CALENDAR_SCHEDULE' ||
      !isRecord(envelope.state)
    ) {
      throw new Error('Invalid Work Calendar document handoff');
    }
    const handoff = parseWorkCalendarEventHandoff(envelope.state, now);
    if (!handoff) throw new Error('Invalid Work Calendar document handoff');
    return { workCalendarEventHandoff: handoff };
  } catch {
    removeStoredEnvelope(storage);
    return null;
  }
}
