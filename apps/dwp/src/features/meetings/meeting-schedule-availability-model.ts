import type { CalendarSchedulingEvaluationInput } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { MeetingScheduleDraft } from './meeting-schedule-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type MeetingCalendarCriteria = {
  key: string;
  input: CalendarSchedulingEvaluationInput;
  people: { id: string; name: string }[];
};

export function meetingCalendarCriteria(
  draft: MeetingScheduleDraft,
  actor: { personPublicId?: string | null; displayName: string } | null
): MeetingCalendarCriteria | null {
  const startsAt = Date.parse(draft.startsAt ?? '');
  if (
    !actor?.personPublicId ||
    !uuid.test(actor.personPublicId) ||
    !Number.isFinite(startsAt) ||
    !Number.isInteger(draft.durationMinutes) ||
    draft.durationMinutes < 1 ||
    draft.durationMinutes > 1440 ||
    draft.participants.some((person) => !person.personPublicId || !uuid.test(person.personPublicId))
  )
    return null;
  const people = [
    ...new Map([
      [actor.personPublicId, { id: actor.personPublicId, name: actor.displayName }],
      ...draft.participants.map(
        (person) =>
          [
            person.personPublicId!,
            {
              id: person.personPublicId!,
              name: person.displayName,
            },
          ] as const
      ),
    ]).values(),
  ];
  if (people.length > 20) return null;
  const from = new Date(startsAt).toISOString();
  const to = new Date(startsAt + draft.durationMinutes * 60_000).toISOString();
  const input = {
    personIds: people.map((person) => person.id).sort(),
    from,
    to,
    roomStartsAt: from,
    roomEndsAt: to,
    durationMinutes: draft.durationMinutes,
    timeZone: draft.timeZone,
  };
  return { input, people, key: JSON.stringify(input) };
}

export type MeetingCalendarObservation = {
  generatedAt: string;
  validUntil: string;
  participantCount: number;
  conflictingPeople: { id: string; name: string }[];
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid calendar evaluation');
  return value as Record<string, unknown>;
}

/** Keep native Calendar evidence bounded to every requested identity and its 30-second lifetime. */
export function readMeetingCalendarObservation(
  value: unknown,
  criteria: MeetingCalendarCriteria,
  now = Date.now()
): MeetingCalendarObservation {
  const evaluation = record(value);
  const generatedAt =
    typeof evaluation.generatedAt === 'string' ? Date.parse(evaluation.generatedAt) : NaN;
  const validUntil =
    typeof evaluation.validUntil === 'string' ? Date.parse(evaluation.validUntil) : NaN;
  if (
    typeof evaluation.evaluationId !== 'string' ||
    !uuid.test(evaluation.evaluationId) ||
    typeof evaluation.criteriaHash !== 'string' ||
    !/^[0-9a-f]{64}$/iu.test(evaluation.criteriaHash) ||
    evaluation.completeness !== 'COMPLETE' ||
    !Number.isFinite(generatedAt) ||
    !Number.isFinite(validUntil) ||
    generatedAt > now + 5_000 ||
    validUntil <= now ||
    validUntil <= generatedAt ||
    validUntil - generatedAt > 30_000 ||
    !Array.isArray(evaluation.sources) ||
    evaluation.sources.length !== 1
  )
    throw new Error('Calendar evaluation is incomplete or expired');
  const source = record(evaluation.sources[0]);
  if (source.sourceType !== 'DWP_NATIVE' || source.status !== 'HEALTHY') {
    throw new Error('Calendar source is unavailable');
  }
  const availability = record(evaluation.availability);
  if (
    availability.generatedAt !== evaluation.generatedAt ||
    !Array.isArray(availability.participants)
  ) {
    throw new Error('Calendar evidence is not bound to its observation');
  }
  const remaining = new Map(criteria.people.map((person) => [person.id, person]));
  const conflictingPeople: MeetingCalendarObservation['conflictingPeople'] = [];
  for (const candidate of availability.participants) {
    const participant = record(candidate);
    const person =
      typeof participant.personPublicId === 'string'
        ? remaining.get(participant.personPublicId)
        : null;
    if (
      !person ||
      !Number.isSafeInteger(participant.busyMinutes) ||
      (participant.busyMinutes as number) < 0
    ) {
      throw new Error('Calendar participant coverage is invalid');
    }
    remaining.delete(person.id);
    if ((participant.busyMinutes as number) > 0) conflictingPeople.push(person);
  }
  if (remaining.size) throw new Error('Calendar participant coverage is incomplete');
  return {
    generatedAt: evaluation.generatedAt as string,
    validUntil: evaluation.validUntil as string,
    participantCount: criteria.people.length,
    conflictingPeople,
  };
}
