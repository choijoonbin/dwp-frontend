import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import type { PersonalWorkPage, WorkSourceReference } from './personal-work-contracts';

export const WORK_CALENDAR_EVENT_HANDOFF_TTL_MS = 15 * 60 * 1000;
export const WORK_CALENDAR_EVENT_DESCRIPTION_HEADER = 'DWP Work';

export type WorkCalendarEventHandoff = Readonly<{
  version: 1;
  handoffId: string;
  origin: 'WORK_HUB';
  ownerFingerprint: string;
  work: WorkSourceReference;
  sourceUrl: string;
  returnTo: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  createdAt: string;
  expiresAt: string;
}>;

export type WorkCalendarEventHandoffState = Readonly<{
  workCalendarEventHandoff: WorkCalendarEventHandoff;
}>;

export type WorkCalendarLink = {
  linkId: string;
  work: WorkSourceReference;
  eventId: string;
  state: 'LINKED' | 'REMOVED';
  version: number;
  createdAt: string;
  updatedAt: string;
  calendarAvailability: 'REFERENCE_ONLY';
};
const base = '/api/platform/v1/workspace/work-hub/calendar-links';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const zonedDateTime = /(?:Z|[+-]\d{2}:\d{2})$/u;
const internalOrigin = 'https://work-calendar.internal';
const calendarDescriptionMaximum = 4_000;
const sourceSystemPattern = /^[A-Z][A-Z0-9_]*$/u;
const ownerFingerprintPattern = /^sha256:[0-9a-f]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function workReference(value: unknown): WorkSourceReference | null {
  if (!isRecord(value)) return null;
  const { sourceSystem, sourceReference, obligationKey } = value;
  if (
    typeof sourceSystem !== 'string' ||
    !sourceSystemPattern.test(sourceSystem) ||
    sourceSystem.length > 64 ||
    typeof sourceReference !== 'string' ||
    sourceReference.length === 0 ||
    sourceReference.length > 256 ||
    hasControlCharacter(sourceReference) ||
    (obligationKey !== undefined &&
      obligationKey !== null &&
      (typeof obligationKey !== 'string' ||
        obligationKey.length > 160 ||
        hasControlCharacter(obligationKey)))
  ) {
    return null;
  }
  return obligationKey === undefined
    ? { sourceSystem, sourceReference }
    : { sourceSystem, sourceReference, obligationKey };
}

function workReferenceKey(value: WorkSourceReference): string {
  return [value.sourceSystem, value.sourceReference, value.obligationKey ?? '']
    .map(encodeURIComponent)
    .join(':');
}

function referenceFromKey(value: string): WorkSourceReference | null {
  const parts = value.split(':');
  if (parts.length !== 3) return null;
  try {
    const [sourceSystem, sourceReference, obligationKey] = parts.map((part) =>
      decodeURIComponent(part)
    );
    const reference = workReference({
      sourceSystem,
      sourceReference,
      ...(obligationKey ? { obligationKey } : {}),
    });
    return reference && workReferenceKey(reference) === value ? reference : null;
  } catch {
    return null;
  }
}

/** Produces an opaque cross-product binding without placing tenant or user fields in router state. */
export async function workCalendarOwnerFingerprint(ownerScope: string): Promise<string> {
  if (!ownerScope || ownerScope.length > 64_000 || !globalThis.crypto?.subtle)
    throw new Error('A current Work owner scope is required.');
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ownerScope)
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Accepts only a canonical same-origin application path, never a browser navigation alias. */
export function workCalendarInternalPath(value: unknown, workOwned = false): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 2_048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    hasControlCharacter(value)
  ) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      hasControlCharacter(decoded)
    ) {
      return null;
    }
    const resolved = new URL(value, internalOrigin);
    const canonical = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    const workPath = resolved.pathname === '/work' || resolved.pathname.startsWith('/work/');
    return resolved.origin === internalOrigin && canonical === value && (!workOwned || workPath)
      ? canonical
      : null;
  } catch {
    return null;
  }
}

/** Work item links have one exact canonical selection and no ambient filters or fragments. */
export function workCalendarItemPath(value: unknown): string | null {
  const canonical = workCalendarInternalPath(value, true);
  if (!canonical) return null;
  const resolved = new URL(canonical, internalOrigin);
  const keys = [...resolved.searchParams.keys()];
  const selections = resolved.searchParams.getAll('work');
  return resolved.pathname === '/work/queue' &&
    !resolved.hash &&
    keys.length === 1 &&
    keys[0] === 'work' &&
    selections.length === 1 &&
    Boolean(selections[0])
    ? canonical
    : null;
}

function exactWorkCalendarItemPath(value: unknown, work: WorkSourceReference): string | null {
  const canonical = workCalendarItemPath(value);
  if (!canonical) return null;
  const resolved = new URL(canonical, internalOrigin);
  return resolved.searchParams.get('work') === workReferenceKey(work) ? canonical : null;
}

function validDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 64 &&
    zonedDateTime.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validTimeZone(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 100 ||
    hasControlCharacter(value)
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function createWorkCalendarEventHandoff(
  input: Pick<
    WorkCalendarEventHandoff,
    | 'ownerFingerprint'
    | 'work'
    | 'sourceUrl'
    | 'returnTo'
    | 'title'
    | 'startsAt'
    | 'endsAt'
    | 'timeZone'
  >,
  now = new Date()
): WorkCalendarEventHandoff {
  const work = workReference(input.work);
  const sourceUrl = work ? exactWorkCalendarItemPath(input.sourceUrl, work) : null;
  const returnTo = workCalendarInternalPath(input.returnTo, true);
  const title = input.title.trim();
  const startsAt = Date.parse(input.startsAt);
  const endsAt = Date.parse(input.endsAt);
  if (
    !work ||
    !ownerFingerprintPattern.test(input.ownerFingerprint) ||
    !sourceUrl ||
    !returnTo ||
    !title ||
    title.length > 300 ||
    !validDateTime(input.startsAt) ||
    !validDateTime(input.endsAt) ||
    endsAt <= startsAt ||
    endsAt - startsAt > 24 * 60 * 60_000 ||
    !validTimeZone(input.timeZone) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new Error('A valid Work Calendar handoff is required.');
  }
  const createdAt = now.toISOString();
  return {
    version: 1,
    handoffId: globalThis.crypto.randomUUID(),
    origin: 'WORK_HUB',
    ownerFingerprint: input.ownerFingerprint,
    work,
    sourceUrl,
    returnTo,
    title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timeZone: input.timeZone,
    createdAt,
    expiresAt: new Date(now.getTime() + WORK_CALENDAR_EVENT_HANDOFF_TTL_MS).toISOString(),
  };
}

/** Router state is untrusted input; only a fresh, bounded Work event draft is accepted. */
export function parseWorkCalendarEventHandoff(
  state: unknown,
  now = Date.now()
): WorkCalendarEventHandoff | null {
  if (!isRecord(state)) return null;
  const value = state.workCalendarEventHandoff;
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.origin !== 'WORK_HUB' ||
    typeof value.ownerFingerprint !== 'string' ||
    !ownerFingerprintPattern.test(value.ownerFingerprint) ||
    typeof value.handoffId !== 'string' ||
    !uuid.test(value.handoffId) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title !== value.title.trim() ||
    value.title.length > 300 ||
    !validDateTime(value.startsAt) ||
    !validDateTime(value.endsAt) ||
    Date.parse(value.endsAt) <= Date.parse(value.startsAt) ||
    Date.parse(value.endsAt) - Date.parse(value.startsAt) > 24 * 60 * 60_000 ||
    !validTimeZone(value.timeZone) ||
    !validDateTime(value.createdAt) ||
    !validDateTime(value.expiresAt)
  ) {
    return null;
  }
  const sourceUrl = workCalendarItemPath(value.sourceUrl);
  const work = workReference(value.work);
  const returnTo = workCalendarInternalPath(value.returnTo, true);
  const createdAt = Date.parse(value.createdAt);
  const expiresAt = Date.parse(value.expiresAt);
  if (
    !work ||
    !sourceUrl ||
    !exactWorkCalendarItemPath(sourceUrl, work) ||
    !returnTo ||
    createdAt > now + 60_000 ||
    expiresAt <= now ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > WORK_CALENDAR_EVENT_HANDOFF_TTL_MS + 5_000
  ) {
    return null;
  }
  return {
    version: 1,
    handoffId: value.handoffId,
    origin: 'WORK_HUB',
    ownerFingerprint: value.ownerFingerprint,
    work,
    sourceUrl,
    returnTo,
    title: value.title,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    timeZone: value.timeZone,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  };
}

/**
 * Stable, locale-neutral metadata stored in Calendar.description until Calendar exposes a
 * dedicated metadata column. User-facing copy must not be added to this contract.
 */
export function workCalendarEventHandoffDescription(
  handoff: Pick<WorkCalendarEventHandoff, 'work' | 'sourceUrl'>
): string {
  const work = workReference(handoff.work);
  const sourceUrl = work ? exactWorkCalendarItemPath(handoff.sourceUrl, work) : null;
  if (!work || !sourceUrl)
    throw new Error('A canonical Work reference and item link are required.');
  const description = `${WORK_CALENDAR_EVENT_DESCRIPTION_HEADER}\nReference: ${workReferenceKey(work)}\nSource: ${sourceUrl}`;
  if (description.length > calendarDescriptionMaximum)
    throw new Error('The Work Calendar description exceeds its API contract.');
  return description;
}

/** Reads only the exact metadata envelope emitted by Work; arbitrary notes never become links. */
export function parseWorkCalendarEventHandoffDescription(
  value: unknown
): Pick<WorkCalendarEventHandoff, 'work' | 'sourceUrl'> | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > calendarDescriptionMaximum)
    return null;
  const lines = value.split('\n');
  if (
    lines.length !== 3 ||
    lines[0] !== WORK_CALENDAR_EVENT_DESCRIPTION_HEADER ||
    !lines[1]?.startsWith('Reference: ') ||
    !lines[2]?.startsWith('Source: ')
  ) {
    return null;
  }
  const work = referenceFromKey(lines[1].slice('Reference: '.length));
  const sourceUrl = work
    ? exactWorkCalendarItemPath(lines[2].slice('Source: '.length), work)
    : null;
  if (!work || !sourceUrl) return null;
  const parsed = { work, sourceUrl };
  return workCalendarEventHandoffDescription(parsed) === value ? parsed : null;
}

export function isExactWorkCalendarLinkReceipt(
  value: WorkCalendarLink | null | undefined,
  expected: Readonly<{ linkId: string; work: WorkSourceReference; eventId: string }>
): value is WorkCalendarLink {
  const work = workReference(expected.work);
  return Boolean(
    value &&
    uuid.test(expected.linkId) &&
    uuid.test(expected.eventId) &&
    work &&
    value.linkId === expected.linkId &&
    value.eventId === expected.eventId &&
    value.state === 'LINKED' &&
    value.calendarAvailability === 'REFERENCE_ONLY' &&
    Number.isSafeInteger(value.version) &&
    value.version >= 0 &&
    value.work.sourceSystem === work.sourceSystem &&
    value.work.sourceReference === work.sourceReference &&
    (value.work.obligationKey ?? null) === (work.obligationKey ?? null)
  );
}

function linkPath(linkId: string) {
  if (!uuid.test(linkId)) throw new Error('A stable UUID link identifier is required.');
  return `${base}/${linkId}`;
}

export async function getWorkCalendarLinks(
  page = 0,
  size = 100,
  signal?: AbortSignal
): Promise<PersonalWorkPage<WorkCalendarLink>> {
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    page > 10_000 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 100
  )
    throw new Error('Invalid link page.');
  const path = `${base}?page=${page}&size=${size}`;
  const response = signal
    ? await axiosInstance.get<ApiResponse<PersonalWorkPage<WorkCalendarLink>>>(path, { signal })
    : await axiosInstance.get<ApiResponse<PersonalWorkPage<WorkCalendarLink>>>(path);
  return response.data.data;
}

/** PUT uses the stable link ID as command identity, including after an uncertain response. */
export async function putWorkCalendarLink(
  linkId: string,
  input: { work: WorkSourceReference; eventId: string },
  signal?: AbortSignal
): Promise<WorkCalendarLink> {
  if (!uuid.test(input.eventId)) throw new Error('A Calendar event reference is required.');
  const path = linkPath(linkId);
  const response = signal
    ? await axiosInstance.put<ApiResponse<WorkCalendarLink>, typeof input>(path, input, { signal })
    : await axiosInstance.put<ApiResponse<WorkCalendarLink>, typeof input>(path, input);
  return response.data.data;
}

/** Only removes the personal relationship; the Calendar event is unchanged. */
export async function removeWorkCalendarLink(
  linkId: string,
  version: number,
  signal?: AbortSignal
): Promise<WorkCalendarLink> {
  if (!Number.isSafeInteger(version) || version < 0)
    throw new Error('A non-negative link version is required.');
  const path = `${linkPath(linkId)}?version=${version}`;
  const response = signal
    ? await axiosInstance.delete<ApiResponse<WorkCalendarLink>>(path, { signal })
    : await axiosInstance.delete<ApiResponse<WorkCalendarLink>>(path);
  return response.data.data;
}
