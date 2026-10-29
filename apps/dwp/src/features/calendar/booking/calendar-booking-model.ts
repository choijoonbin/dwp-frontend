import type {
  AuthenticatedCalendarBookablePage,
  CalendarBookingAnswer,
  CalendarBookingAppointment,
  CalendarBookingAvailability,
  CalendarBookingAvailabilitySlot,
  CalendarBookingOneTimeToken,
  CalendarBookingQuestion,
} from '@dwp-frontend/shared-utils';

export const CALENDAR_BOOKING_SEARCH_DEBOUNCE_MS = 275;
export const CALENDAR_BOOKING_PAGE_SIZE = 20;
export const CALENDAR_BOOKING_MAX_VISIBLE_ITEMS = 200;
export const CALENDAR_BOOKING_APPOINTMENT_SERVER_LIMIT = 100;
export const CALENDAR_BOOKING_MAX_AVAILABILITY_DAYS = 31;

export type CalendarBookingAccessInfo =
  | Readonly<{ kind: 'IN_PERSON'; text: string }>
  | Readonly<{ kind: 'VIDEO'; text: string; href: string }>
  | Readonly<{ kind: 'PHONE'; text: string }>;

export type CalendarBookingValidationIssue =
  | 'ACCESS_INFO_REQUIRED'
  | 'INVALID_VIDEO_URL'
  | 'REQUIRED_ANSWER_MISSING'
  | 'INVALID_SELECTION'
  | 'ANSWER_TOO_LONG'
  | 'DUPLICATE_ANSWER'
  | 'HOLD_EXPIRED'
  | 'PAGE_VERSION_CHANGED'
  | 'INVALID_SLOT';

export type CalendarBookingAnswerDraft = Readonly<Record<string, string>>;

function trimmed(value: string | null | undefined) {
  const result = value?.trim() ?? '';
  return result.length > 0 ? result : null;
}

function approvedConferenceUrl(value: string | null | undefined) {
  if (!value || value !== value.trim() || !value.startsWith('https://')) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLocaleLowerCase();
    const approvedHost =
      host === 'meet.google.com' ||
      host === 'teams.microsoft.com' ||
      host === 'teams.live.com' ||
      host === 'zoom.us' ||
      host.endsWith('.zoom.us') ||
      host === 'webex.com' ||
      host.endsWith('.webex.com');
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      (parsed.port && parsed.port !== '443') ||
      !approvedHost
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function calendarBookingAccessInfo(
  page: Pick<
    AuthenticatedCalendarBookablePage,
    'meetingMode' | 'location' | 'conferenceUrl' | 'dialInInstructions'
  >
): CalendarBookingAccessInfo | null {
  if (page.meetingMode === 'IN_PERSON') {
    const location = page.location;
    return location &&
      location === location.trim() &&
      !trimmed(page.conferenceUrl) &&
      !trimmed(page.dialInInstructions)
      ? { kind: 'IN_PERSON', text: location }
      : null;
  }
  if (page.meetingMode === 'PHONE') {
    const instructions = page.dialInInstructions;
    return instructions &&
      instructions === instructions.trim() &&
      !trimmed(page.location) &&
      !trimmed(page.conferenceUrl)
      ? { kind: 'PHONE', text: instructions }
      : null;
  }
  const url = approvedConferenceUrl(page.conferenceUrl);
  return url && !trimmed(page.location) && !trimmed(page.dialInInstructions)
    ? { kind: 'VIDEO', text: page.conferenceUrl!, href: url }
    : null;
}

export function calendarBookingAccessIssue(
  page: Pick<
    AuthenticatedCalendarBookablePage,
    'meetingMode' | 'location' | 'conferenceUrl' | 'dialInInstructions'
  >
): CalendarBookingValidationIssue | null {
  if (calendarBookingAccessInfo(page)) return null;
  return page.meetingMode === 'VIDEO' && trimmed(page.conferenceUrl)
    ? 'INVALID_VIDEO_URL'
    : 'ACCESS_INFO_REQUIRED';
}

function questionOptions(question: CalendarBookingQuestion) {
  return new Set((question.options ?? []).map((option) => option.trim()));
}

export function calendarBookingAnswers(
  questions: readonly CalendarBookingQuestion[],
  draft: CalendarBookingAnswerDraft
): Readonly<{
  answers: CalendarBookingAnswer[];
  issues: Readonly<Record<string, CalendarBookingValidationIssue>>;
}> {
  const answers: CalendarBookingAnswer[] = [];
  const issues: Record<string, CalendarBookingValidationIssue> = {};
  const seen = new Set<string>();

  for (const question of questions) {
    if (seen.has(question.key)) {
      issues[question.key] = 'DUPLICATE_ANSWER';
      continue;
    }
    seen.add(question.key);
    const value = draft[question.key]?.trim() ?? '';
    if (!value) {
      if (question.required) issues[question.key] = 'REQUIRED_ANSWER_MISSING';
      continue;
    }
    if (value.length > 2000) {
      issues[question.key] = 'ANSWER_TOO_LONG';
      continue;
    }
    if (question.type === 'SINGLE_SELECT' && !questionOptions(question).has(value)) {
      issues[question.key] = 'INVALID_SELECTION';
      continue;
    }
    if (question.type === 'CHECKBOX' && value !== 'true') {
      issues[question.key] = 'INVALID_SELECTION';
      continue;
    }
    answers.push({ key: question.key, value });
  }

  return { answers, issues };
}

function timestamp(value: string) {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function validCalendarBookingSlot(
  slot: CalendarBookingAvailabilitySlot,
  availability: Pick<CalendarBookingAvailability, 'from' | 'to'>,
  now = Date.now()
) {
  const startsAt = timestamp(slot.startsAt);
  const endsAt = timestamp(slot.endsAt);
  const from = timestamp(availability.from);
  const to = timestamp(availability.to);
  return (
    startsAt !== null &&
    endsAt !== null &&
    from !== null &&
    to !== null &&
    startsAt >= Math.max(from, now) &&
    endsAt > startsAt &&
    endsAt <= to
  );
}

export function calendarBookingSlots(
  availability: CalendarBookingAvailability,
  expectedPageId: string,
  expectedPageVersion: number,
  now = Date.now()
) {
  if (availability.pageId !== expectedPageId || availability.pageVersion !== expectedPageVersion) {
    return [];
  }
  const unique = new Map<string, CalendarBookingAvailabilitySlot>();
  for (const slot of availability.slots) {
    if (!validCalendarBookingSlot(slot, availability, now)) continue;
    unique.set(`${slot.startsAt}\u0000${slot.endsAt}`, slot);
  }
  return [...unique.values()].sort(
    (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)
  );
}

export function calendarBookingAvailabilityRange(
  start: Date,
  days = 14
): Readonly<{ from: string; to: string }> {
  const boundedDays = Math.min(
    CALENDAR_BOOKING_MAX_AVAILABILITY_DAYS,
    Math.max(1, Math.trunc(days))
  );
  const from = new Date(start);
  const to = new Date(from.getTime() + boundedDays * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function calendarBookingHoldIssue(
  hold: Readonly<{ state: string; expiresAt: string; pageId?: string; fencingToken?: number }>,
  heldPageVersion: number,
  currentPageVersion: number,
  now = Date.now(),
  expectedPageId?: string
): CalendarBookingValidationIssue | null {
  if (
    (expectedPageId && hold.pageId !== expectedPageId) ||
    (hold.fencingToken !== undefined && hold.fencingToken < 1)
  ) {
    return 'INVALID_SLOT';
  }
  if (heldPageVersion !== currentPageVersion) return 'PAGE_VERSION_CHANGED';
  if (hold.state !== 'HELD' || (timestamp(hold.expiresAt) ?? 0) <= now) return 'HOLD_EXPIRED';
  return null;
}

export function calendarBookingAppointmentIsMutable(
  appointment: CalendarBookingAppointment,
  now = Date.now()
) {
  return appointment.state === 'CONFIRMED' && (timestamp(appointment.endsAt) ?? 0) > now;
}

export function boundedCalendarBookingItems<T>(
  items: readonly T[],
  visibleCount: number,
  matches: (item: T) => boolean = () => true
) {
  const matched = items.filter(matches);
  const accepted = matched.slice(0, CALENDAR_BOOKING_MAX_VISIBLE_ITEMS);
  const count = Math.min(
    CALENDAR_BOOKING_MAX_VISIBLE_ITEMS,
    Math.max(CALENDAR_BOOKING_PAGE_SIZE, Math.trunc(visibleCount))
  );
  return {
    items: accepted.slice(0, count),
    total: matched.length,
    acceptedTotal: accepted.length,
    hasMore: accepted.length > count,
    partial: matched.length > CALENDAR_BOOKING_MAX_VISIBLE_ITEMS,
    nextVisibleCount: Math.min(accepted.length, count + CALENDAR_BOOKING_PAGE_SIZE),
  } as const;
}

/** A closure-only one-time handoff. It intentionally has no serialization API. */
export function createCalendarBookingTokenMemory() {
  let current: CalendarBookingOneTimeToken | null = null;
  return {
    consume(token: CalendarBookingOneTimeToken) {
      current = token;
    },
    take() {
      const token = current;
      current = null;
      return token;
    },
    clear() {
      current = null;
    },
  } as const;
}
