import { Temporal } from 'temporal-polyfill';

import type {
  CalendarSchedulingCandidateV2,
  CalendarSchedulingEvaluationInputV2,
  CalendarSchedulingEvaluationV2,
  CalendarSchedulingHardRecheckV2,
  CalendarSchedulingIntervalStateV2,
  CalendarSchedulingParticipantAvailabilityV2,
  CalendarSchedulingParticipantInputV2,
  CalendarSchedulingWorkingScheduleV2,
} from '@dwp-frontend/shared-utils';

const PUBLIC_PERSON_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const STATUS_PRIORITY: Readonly<Record<CalendarSchedulingMatrixStatus, number>> = {
  AVAILABLE: 0,
  TENTATIVE: 1,
  BUSY: 2,
  OUT_OF_OFFICE: 3,
  UNKNOWN: 4,
};

export type CalendarSchedulingMatrixStatus = 'AVAILABLE' | CalendarSchedulingIntervalStateV2;
export type CalendarSchedulingV2State =
  'READY' | 'PARTIAL' | 'UNKNOWN' | 'STALE' | 'MISMATCH' | 'UNAVAILABLE';
export type CalendarSchedulingBlockReason =
  Exclude<CalendarSchedulingV2State, 'READY'> | 'REQUIRED_CONFLICT';

export type CalendarSchedulingParticipantSelectionV2 = Readonly<{
  participants: readonly CalendarSchedulingParticipantInputV2[];
  labels: Readonly<Record<string, string>>;
  internalCount: number;
  uncheckedCount: number;
  overflowCount: number;
}>;

export type CalendarSchedulingCandidateDecision = Readonly<{
  canApply: boolean;
  blockReason: CalendarSchedulingBlockReason | null;
  cells: readonly Readonly<{
    participant: CalendarSchedulingParticipantAvailabilityV2;
    status: CalendarSchedulingMatrixStatus;
  }>[];
  optionalConflictCount: number;
}>;

export function calendarSchedulingParticipantsV2(
  attendees: readonly Readonly<{
    personId: string;
    displayName?: string | null;
    type?: 'REQUIRED' | 'OPTIONAL' | string;
  }>[],
  limit = 19
): CalendarSchedulingParticipantSelectionV2 {
  const selected = new Map<
    string,
    { input: CalendarSchedulingParticipantInputV2; label: string }
  >();
  attendees.forEach((attendee, index) => {
    const identity = attendee.personId.trim();
    const personPublicId = PUBLIC_PERSON_ID.test(identity) ? identity : null;
    const key = (personPublicId ?? identity) || `unresolved-${index + 1}`;
    const role = attendee.type === 'OPTIONAL' ? 'OPTIONAL' : 'REQUIRED';
    const current = selected.get(key);
    if (current?.input.role === 'REQUIRED') return;
    selected.set(key, {
      input: {
        clientRef: current?.input.clientRef ?? `attendee-${index + 1}`,
        personPublicId,
        role,
      },
      label: attendee.displayName?.trim() || identity || `#${index + 1}`,
    });
  });
  const all = [...selected.values()];
  const bounded = all.slice(0, Math.max(0, limit));
  return {
    participants: bounded.map((entry) => entry.input),
    labels: Object.fromEntries(bounded.map((entry) => [entry.input.clientRef, entry.label])),
    internalCount: all.filter((entry) => entry.input.personPublicId).length,
    uncheckedCount: all.filter((entry) => !entry.input.personPublicId).length,
    overflowCount: Math.max(0, all.length - Math.max(0, limit)),
  };
}

export function calendarSchedulingFingerprintV2(input: CalendarSchedulingEvaluationInputV2) {
  return JSON.stringify({
    ...input,
    participants: [...input.participants].sort((left, right) =>
      `${left.clientRef}:${left.personPublicId ?? ''}:${left.role}`.localeCompare(
        `${right.clientRef}:${right.personPublicId ?? ''}:${right.role}`
      )
    ),
    roomCriteria: {
      ...input.roomCriteria,
      requiredFeatures: [...input.roomCriteria.requiredFeatures].sort(),
      preferredFeatures: [...input.roomCriteria.preferredFeatures].sort(),
    },
  });
}

function stale(validUntil: string, now: number) {
  const expiresAt = Date.parse(validUntil);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

export function calendarSchedulingEvaluationStateV2(
  evaluation: CalendarSchedulingEvaluationV2 | null | undefined,
  matchesCurrentInput = true,
  now = Date.now()
): CalendarSchedulingV2State {
  if (!evaluation) return 'UNAVAILABLE';
  if (!matchesCurrentInput) return 'MISMATCH';
  if (stale(evaluation.validUntil, now)) return 'STALE';
  if (evaluation.completeness === 'UNKNOWN') return 'UNKNOWN';
  if (evaluation.completeness === 'PARTIAL') return 'PARTIAL';
  if (!evaluation.challengeToken || !evaluation.criteriaHash || !evaluation.sources.length) {
    return 'UNAVAILABLE';
  }
  if (evaluation.sources.some((source) => source.status === 'STALE')) return 'STALE';
  if (
    evaluation.sources.some(
      (source) => source.status === 'UNKNOWN' || source.status === 'UNAVAILABLE'
    ) ||
    evaluation.participants.some((participant) => participant.coverage === 'UNKNOWN')
  ) {
    return 'UNKNOWN';
  }
  if (
    evaluation.sources.some((source) => source.status === 'PARTIAL') ||
    evaluation.participants.some((participant) => participant.coverage === 'PARTIAL')
  ) {
    return 'PARTIAL';
  }
  return 'READY';
}

function overlaps(startsAt: string, endsAt: string, intervalStart: string, intervalEnd: string) {
  const values = [startsAt, endsAt, intervalStart, intervalEnd].map(Date.parse);
  return values.every(Number.isFinite) && values[0]! < values[3]! && values[2]! < values[1]!;
}

function withinWorkingSchedule(
  candidate: CalendarSchedulingCandidateV2,
  schedule: CalendarSchedulingWorkingScheduleV2 | null
) {
  if (!schedule) return null;
  try {
    const start = Temporal.Instant.from(candidate.startsAt).toZonedDateTimeISO(schedule.timeZone);
    const end = Temporal.Instant.from(candidate.endsAt).toZonedDateTimeISO(schedule.timeZone);
    if (!start.toPlainDate().equals(end.toPlainDate())) return false;
    const day = schedule.days.find((entry) => DAY_NUMBER[entry.dayOfWeek] === start.dayOfWeek);
    if (!day) return false;
    const startTime = start.toPlainTime().toString().slice(0, 5);
    const endTime = end.toPlainTime().toString().slice(0, 5);
    return day.windows.some(
      (window) => startTime >= window.startsAt.slice(0, 5) && endTime <= window.endsAt.slice(0, 5)
    );
  } catch {
    return null;
  }
}

const DAY_NUMBER = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
} as const;

export function calendarSchedulingCandidateStatusV2(
  participant: CalendarSchedulingParticipantAvailabilityV2,
  candidate: CalendarSchedulingCandidateV2
): CalendarSchedulingMatrixStatus {
  if (participant.coverage !== 'COMPLETE') return 'UNKNOWN';
  const statuses = participant.intervals
    .filter((interval) =>
      overlaps(candidate.startsAt, candidate.endsAt, interval.startsAt, interval.endsAt)
    )
    .map((interval) => interval.state)
    .sort((left, right) => STATUS_PRIORITY[right] - STATUS_PRIORITY[left]);
  if (statuses[0]) return statuses[0];
  if (participant.workingSchedule) {
    try {
      const working = withinWorkingSchedule(candidate, participant.workingSchedule);
      return working === null ? 'UNKNOWN' : working ? 'AVAILABLE' : 'OUT_OF_OFFICE';
    } catch {
      return 'UNKNOWN';
    }
  }
  return 'UNKNOWN';
}

export function calendarSchedulingCandidateDecisionV2(
  evaluation: CalendarSchedulingEvaluationV2,
  candidate: CalendarSchedulingCandidateV2,
  matchesCurrentInput = true,
  now = Date.now()
): CalendarSchedulingCandidateDecision {
  const state = calendarSchedulingEvaluationStateV2(evaluation, matchesCurrentInput, now);
  const cells = evaluation.participants.map((participant) => ({
    participant,
    status: calendarSchedulingCandidateStatusV2(participant, candidate),
  }));
  const unknown = cells.some((cell) => cell.status === 'UNKNOWN');
  const requiredConflict =
    candidate.requiredConflictRefs.length > 0 ||
    cells.some((cell) => cell.participant.role !== 'OPTIONAL' && cell.status !== 'AVAILABLE');
  const optionalConflicts = new Set(candidate.optionalConflictRefs);
  cells.forEach((cell) => {
    if (cell.participant.role === 'OPTIONAL' && cell.status !== 'AVAILABLE') {
      optionalConflicts.add(cell.participant.clientRef);
    }
  });
  const blockReason =
    state !== 'READY'
      ? state
      : candidate.completeness !== 'COMPLETE' || unknown
        ? 'UNKNOWN'
        : requiredConflict
          ? 'REQUIRED_CONFLICT'
          : null;
  return {
    canApply: blockReason === null,
    blockReason,
    cells,
    optionalConflictCount: optionalConflicts.size,
  };
}

export function calendarSchedulingHardRecheckPassedV2(
  evaluation: CalendarSchedulingEvaluationV2,
  recheck: CalendarSchedulingHardRecheckV2,
  now = Date.now()
) {
  return (
    recheck.status === 'PASS' &&
    Boolean(recheck.hardRecheckToken) &&
    recheck.evaluationId === evaluation.evaluationId &&
    recheck.criteriaHash === evaluation.criteriaHash &&
    !recheck.conflicts.some((conflict) => conflict.blocking) &&
    (!recheck.room || recheck.room.eligible) &&
    !stale(recheck.validUntil, now)
  );
}

export function calendarSchedulingCurrentCandidateV2(
  evaluation: CalendarSchedulingEvaluationV2,
  startsAt: string,
  endsAt: string
): CalendarSchedulingCandidateV2 {
  return {
    candidateId: 'CURRENT',
    startsAt,
    endsAt,
    completeness: evaluation.completeness,
    score: 0,
    reasonCodes: [],
    requiredConflictRefs: [],
    optionalConflictRefs: [],
    hardRecheckRequired: true,
  };
}
