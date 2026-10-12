export const WORK_CALENDAR_DOCUMENT_HANDOFF_KEY = 'dwp.calendar.work-document-handoff.v1';

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

/** Removes only the requested handoff so an old boundary cannot erase a newer tab-local command. */
export function clearWorkCalendarDocumentHandoff(
  handoffId?: string,
  storage: Storage | null = browserSessionStorage()
): void {
  if (!storage) return;
  if (!handoffId) {
    removeStoredEnvelope(storage);
    return;
  }
  try {
    const raw = storage.getItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY);
    if (!raw) return;
    const envelope: unknown = JSON.parse(raw);
    const storedHandoffId =
      typeof envelope === 'object' &&
      envelope !== null &&
      !Array.isArray(envelope) &&
      typeof (envelope as { state?: unknown }).state === 'object' &&
      (envelope as { state?: unknown }).state !== null &&
      !Array.isArray((envelope as { state?: unknown }).state)
        ? (
            (envelope as { state: { workCalendarEventHandoff?: unknown } }).state
              .workCalendarEventHandoff as { handoffId?: unknown } | undefined
          )?.handoffId
        : undefined;
    if (storedHandoffId === handoffId || typeof storedHandoffId !== 'string') {
      removeStoredEnvelope(storage);
    }
  } catch {
    removeStoredEnvelope(storage);
  }
}
