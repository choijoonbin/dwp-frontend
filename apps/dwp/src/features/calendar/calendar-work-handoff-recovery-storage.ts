export const CALENDAR_WORK_HANDOFF_RECOVERY_KEY = 'dwp.calendar.work-handoff-recovery.v1';

export function calendarWorkHandoffRecoveryStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function clearCalendarWorkHandoffRecovery(handoffId?: string): void {
  const storage = calendarWorkHandoffRecoveryStorage();
  if (!storage) return;
  try {
    if (!handoffId) {
      storage.removeItem(CALENDAR_WORK_HANDOFF_RECOVERY_KEY);
      return;
    }
    const raw = storage.getItem(CALENDAR_WORK_HANDOFF_RECOVERY_KEY);
    if (!raw) return;
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as { handoff?: { handoffId?: unknown } }).handoff?.handoffId === handoffId
    ) {
      storage.removeItem(CALENDAR_WORK_HANDOFF_RECOVERY_KEY);
    }
  } catch {
    storage.removeItem(CALENDAR_WORK_HANDOFF_RECOVERY_KEY);
  }
}
