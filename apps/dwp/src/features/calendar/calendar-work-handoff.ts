import { isAppPermissionEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  IdempotentMutationIntent,
  PermissionDTO,
} from '@dwp-frontend/shared-utils';
import {
  isExactWorkCalendarLinkReceipt,
  parseWorkCalendarEventHandoffDescription,
  parseWorkCalendarEventHandoff,
  putWorkCalendarLink,
  workCalendarEventHandoffDescription,
  type WorkCalendarEventHandoff,
  type WorkCalendarLink,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';

import { authorizedCalendarWorkReturnTarget } from './calendar-schedule-state';

const WORK_HANDOFF_RECOVERY_KEY = 'dwp.calendar.work-handoff-recovery.v1';

export type CalendarWorkHandoffRecovery = Readonly<{
  handoff: WorkCalendarEventHandoff;
  event: CalendarEvent;
  input: CreateCalendarEventInput;
  linkId: string;
}>;

export type CalendarPendingWorkEventReceipt = Readonly<{
  handoffId: string;
  intent: IdempotentMutationIntent;
  event: CalendarEvent;
}>;

/** Builds the PUT-only retry receipt only when recovery still belongs to this exact handoff. */
export function calendarWorkHandoffRecoveryReceipt(
  handoff: WorkCalendarEventHandoff | null | undefined,
  recovery: CalendarWorkHandoffRecovery | null | undefined
): CalendarPendingWorkEventReceipt | null {
  if (
    !handoff ||
    !recovery ||
    recovery.handoff.handoffId !== handoff.handoffId ||
    recovery.linkId !== handoff.handoffId
  ) {
    return null;
  }
  return {
    handoffId: handoff.handoffId,
    intent: { key: recovery.linkId, fingerprint: `recovery:${handoff.handoffId}` },
    event: recovery.event,
  };
}

export type CalendarWorkHandoffReturnTarget = Readonly<{
  path: string;
  handoffId: string;
  ownerFingerprint: string;
  expiresAt: string;
}>;

function recoveryStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function hasWorkCalendarEventHandoff(state: unknown): boolean {
  return Boolean(
    state &&
    typeof state === 'object' &&
    !Array.isArray(state) &&
    Object.hasOwn(state, 'workCalendarEventHandoff')
  );
}

/** Keeps an already-open composer bound to the security owner that authorized its Work data. */
export function isCurrentWorkCalendarHandoffOwner(
  handoff: WorkCalendarEventHandoff | null | undefined,
  ownerFingerprint: string | null
): handoff is WorkCalendarEventHandoff {
  return Boolean(ownerFingerprint && handoff?.ownerFingerprint === ownerFingerprint);
}

/** Re-evaluated at dispatch time so an outage cannot keep an expired handoff alive. */
export function authorizedWorkCalendarEventHandoff(
  state: unknown,
  permissions: readonly PermissionDTO[],
  ownerFingerprint: string | null,
  now = Date.now()
): WorkCalendarEventHandoff | null {
  if (!ownerFingerprint || !isAppPermissionEntitled('APP.WORK', 'UPDATE', permissions)) return null;
  const handoff = parseWorkCalendarEventHandoff(state, now);
  if (!handoff || handoff.ownerFingerprint !== ownerFingerprint) return null;
  const sourceUrl = authorizedCalendarWorkReturnTarget(handoff.sourceUrl, permissions);
  const returnTo = authorizedCalendarWorkReturnTarget(handoff.returnTo, permissions);
  return sourceUrl === handoff.sourceUrl && returnTo === handoff.returnTo ? handoff : null;
}

/** Return navigation stays attached to the same short-lived Work command as the composer. */
export function authorizedWorkCalendarHandoffReturnTarget(
  handoff: WorkCalendarEventHandoff | null | undefined,
  permissions: readonly PermissionDTO[],
  ownerFingerprint: string | null,
  now = Date.now()
): CalendarWorkHandoffReturnTarget | null {
  const authorized = authorizedWorkCalendarEventHandoff(
    { workCalendarEventHandoff: handoff },
    permissions,
    ownerFingerprint,
    now
  );
  if (!authorized) return null;
  return {
    path: authorized.returnTo,
    handoffId: authorized.handoffId,
    ownerFingerprint: authorized.ownerFingerprint,
    expiresAt: authorized.expiresAt,
  };
}

/** A Work link is written only after Calendar echoes the exact governed event contract. */
export function isExactWorkHandoffEventReceipt(
  event: CalendarEvent | null | undefined,
  input: CreateCalendarEventInput
): event is CalendarEvent {
  const workReference = parseWorkCalendarEventHandoffDescription(input.description);
  return Boolean(
    event &&
    workReference &&
    input.calendarId &&
    input.type === 'FOCUS' &&
    input.allDay === false &&
    input.visibility === 'PRIVATE' &&
    input.recurrence === 'NONE' &&
    input.recurrenceInterval === 1 &&
    (input.recurrenceUntil ?? null) === null &&
    input.responseRequired === false &&
    input.attendees.length === 0 &&
    (input.resourceId ?? null) === null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      event.eventId
    ) &&
    event.calendarId === input.calendarId &&
    event.title === input.title &&
    (event.description ?? null) === (input.description ?? null) &&
    event.type === 'FOCUS' &&
    event.type === input.type &&
    event.startsAt === input.startsAt &&
    event.endsAt === input.endsAt &&
    event.timeZone === input.timeZone &&
    event.allDay === false &&
    (event.location ?? null) === (input.location ?? null) &&
    (event.conferenceUrl ?? null) === (input.conferenceUrl ?? null) &&
    event.visibility === 'PRIVATE' &&
    event.recurrence === 'NONE' &&
    event.recurrenceInterval === 1 &&
    (event.recurrenceUntil ?? null) === null &&
    event.responseRequired === false &&
    event.attendees.length === 0 &&
    (event.resource ?? null) === null &&
    (event.importance ?? 'NORMAL') === (input.importance ?? 'NORMAL') &&
    event.redacted !== true &&
    event.status === 'CONFIRMED' &&
    Number.isSafeInteger(event.version) &&
    event.version >= 0
  );
}

function isExactWorkHandoffRecoveryReceipt(
  handoff: WorkCalendarEventHandoff,
  event: CalendarEvent,
  input: CreateCalendarEventInput,
  linkId: string
): boolean {
  return (
    linkId === handoff.handoffId &&
    input.idempotencyKey === linkId &&
    input.description === workCalendarEventHandoffDescription(handoff) &&
    isExactWorkHandoffEventReceipt(event, input)
  );
}

/** Stores only a verified post-Calendar receipt, so a reload can retry the link without a POST. */
export function persistCalendarWorkHandoffRecovery(
  handoff: WorkCalendarEventHandoff,
  event: CalendarEvent,
  input: CreateCalendarEventInput,
  now = Date.now()
): boolean {
  const storage = recoveryStorage();
  const linkId = input.idempotencyKey;
  if (!storage || !isExactWorkHandoffRecoveryReceipt(handoff, event, input, linkId)) return false;
  if (!parseWorkCalendarEventHandoff({ workCalendarEventHandoff: handoff }, now)) return false;
  try {
    storage.setItem(WORK_HANDOFF_RECOVERY_KEY, JSON.stringify({ handoff, event, input, linkId }));
    return true;
  } catch {
    return false;
  }
}

/** Rehydrates only a still-authorized, owner-bound receipt; malformed and stale values are removed. */
export function readCalendarWorkHandoffRecovery(
  permissions: readonly PermissionDTO[],
  ownerFingerprint: string | null,
  permissionsLoaded: boolean,
  now = Date.now()
): CalendarWorkHandoffRecovery | null {
  const storage = recoveryStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(WORK_HANDOFF_RECOVERY_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid recovery');
    const candidate = value as Partial<CalendarWorkHandoffRecovery>;
    const parsed = parseWorkCalendarEventHandoff(
      { workCalendarEventHandoff: candidate.handoff },
      now
    );
    if (!parsed) throw new Error('Invalid recovery');
    // Auth state can briefly contain an empty permission snapshot during bootstrap. Keep the
    // receipt dormant only while that snapshot is genuinely unresolved. Once permissions are
    // authoritative, a missing/different owner or absent Work authority destroys the receipt.
    if (!permissionsLoaded) return null;
    if (!ownerFingerprint) throw new Error('Invalid recovery owner');
    if (parsed.ownerFingerprint !== ownerFingerprint) throw new Error('Invalid recovery owner');
    if (!isAppPermissionEntitled('APP.WORK', 'UPDATE', permissions)) {
      throw new Error('Invalid recovery authority');
    }
    if (
      !candidate.event ||
      !candidate.input ||
      typeof candidate.linkId !== 'string' ||
      !isExactWorkHandoffRecoveryReceipt(
        parsed,
        candidate.event as CalendarEvent,
        candidate.input as CreateCalendarEventInput,
        candidate.linkId
      )
    ) {
      throw new Error('Invalid recovery');
    }
    return {
      handoff: parsed,
      event: candidate.event as CalendarEvent,
      input: candidate.input as CreateCalendarEventInput,
      linkId: candidate.linkId,
    };
  } catch {
    storage.removeItem(WORK_HANDOFF_RECOVERY_KEY);
    return null;
  }
}

export function clearCalendarWorkHandoffRecovery(handoffId?: string): void {
  const storage = recoveryStorage();
  if (!storage) return;
  try {
    if (!handoffId) {
      storage.removeItem(WORK_HANDOFF_RECOVERY_KEY);
      return;
    }
    const raw = storage.getItem(WORK_HANDOFF_RECOVERY_KEY);
    if (!raw) return;
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as { handoff?: { handoffId?: unknown } }).handoff?.handoffId === handoffId
    ) {
      storage.removeItem(WORK_HANDOFF_RECOVERY_KEY);
    }
  } catch {
    storage.removeItem(WORK_HANDOFF_RECOVERY_KEY);
  }
}

type PutWorkCalendarLink = typeof putWorkCalendarLink;

export async function persistWorkCalendarHandoffLink(
  handoff: WorkCalendarEventHandoff,
  event: CalendarEvent,
  linkId: string,
  putLink: PutWorkCalendarLink = putWorkCalendarLink
): Promise<WorkCalendarLink> {
  const expected = { linkId, work: handoff.work, eventId: event.eventId };
  const receipt = await putLink(linkId, { work: handoff.work, eventId: event.eventId });
  if (!isExactWorkCalendarLinkReceipt(receipt, expected))
    throw new Error('The Work Calendar link receipt did not match the reviewed event.');
  return receipt;
}
