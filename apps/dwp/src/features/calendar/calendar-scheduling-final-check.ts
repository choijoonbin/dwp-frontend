import {
  evaluateCalendarSchedulingV2,
  hardRecheckCalendarSchedulingV2,
} from '@dwp-frontend/shared-utils';

import {
  calendarAvailabilityWindow,
  calendarMeetingDurationMinutes,
} from './calendar-scheduling-assistant-model';
import {
  calendarSchedulingCandidateDecisionV2,
  calendarSchedulingCurrentCandidateV2,
  calendarSchedulingHardRecheckPassedV2,
  calendarSchedulingParticipantsV2,
} from './calendar-scheduling-v2-model';

import type {
  CalendarEvent,
  CalendarResource,
  CalendarSchedulingEvaluationInputV2,
  CalendarSchedulingEvaluationV2,
  CalendarSchedulingHardRecheckInputV2,
  CalendarSchedulingHardRecheckV2,
} from '@dwp-frontend/shared-utils';

export type CalendarSchedulingFinalCheckFailure =
  | 'INVALID_RANGE'
  | 'UNRESOLVED_PARTICIPANT'
  | 'PARTICIPANT_LIMIT'
  | 'UNVERIFIED_EVIDENCE'
  | 'HARD_RECHECK_BLOCKED';

export class CalendarSchedulingFinalCheckError extends Error {
  constructor(readonly reason: CalendarSchedulingFinalCheckFailure) {
    super(reason);
    this.name = 'CalendarSchedulingFinalCheckError';
  }
}

export type CalendarSchedulingVerificationReceiptV2 = Readonly<{
  evaluationId: string;
  criteriaHash: string;
  hardRecheckToken: string;
  selectionHash: string;
  checkedAt: string;
  validUntil: string;
  selection: Readonly<{ startsAt: string; endsAt: string }>;
  roomId: string | null;
  draftFingerprint: string;
}>;

type FinalSchedulingDraft = Readonly<{
  startsAt: string;
  endsAt: string;
  timeZone: string;
  attendees: readonly Readonly<{
    personId: string;
    displayName?: string | null;
    type?: string;
  }>[];
  resource: CalendarResource | null;
  resourceId: string | null;
}>;

type SchedulingDraftFingerprintInput = Readonly<{
  startsAt: string;
  endsAt: string;
  timeZone: string;
  attendees: FinalSchedulingDraft['attendees'];
  resourceId: string | null;
}>;

type FinalCheckTransport = Readonly<{
  evaluate: (input: CalendarSchedulingEvaluationInputV2) => Promise<CalendarSchedulingEvaluationV2>;
  hardRecheck: (
    evaluationId: string,
    input: CalendarSchedulingHardRecheckInputV2
  ) => Promise<CalendarSchedulingHardRecheckV2>;
}>;

const DEFAULT_TRANSPORT: FinalCheckTransport = {
  evaluate: evaluateCalendarSchedulingV2,
  hardRecheck: hardRecheckCalendarSchedulingV2,
};

export function calendarSchedulingActorIsOrganizerV2(
  event: Pick<CalendarEvent, 'organizerPersonPublicId' | 'organizerUserId'> | null | undefined,
  actor: Readonly<{ personPublicId?: string | null; userId?: string | number | null }> | null
) {
  if (!event) return true;
  if (!actor) return false;
  if (event.organizerPersonPublicId && actor.personPublicId) {
    return event.organizerPersonPublicId === actor.personPublicId;
  }
  return (
    event.organizerUserId != null &&
    actor.userId != null &&
    String(event.organizerUserId) === String(actor.userId)
  );
}

export function calendarSchedulingVerificationReceiptV2(
  evaluation: CalendarSchedulingEvaluationV2,
  recheck: CalendarSchedulingHardRecheckV2,
  selection: Readonly<{ startsAt: string; endsAt: string }>,
  roomId: string | null,
  draftFingerprint: string,
  now = Date.now()
): CalendarSchedulingVerificationReceiptV2 | null {
  if (!calendarSchedulingHardRecheckPassedV2(evaluation, recheck, now)) return null;
  return {
    evaluationId: evaluation.evaluationId,
    criteriaHash: evaluation.criteriaHash,
    hardRecheckToken: recheck.hardRecheckToken!,
    selectionHash: recheck.selectionHash,
    checkedAt: recheck.checkedAt,
    validUntil: recheck.validUntil,
    selection,
    roomId,
    draftFingerprint,
  };
}

export function calendarSchedulingAssistedDraftFingerprintV2(
  input: SchedulingDraftFingerprintInput
) {
  const selection = calendarSchedulingParticipantsV2(input.attendees);
  return JSON.stringify({
    participants: [...selection.participants]
      .map((participant) => ({
        personPublicId: participant.personPublicId,
        role: participant.role,
      }))
      .sort((left, right) =>
        `${left.personPublicId ?? ''}:${left.role}`.localeCompare(
          `${right.personPublicId ?? ''}:${right.role}`
        )
      ),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timeZone: input.timeZone,
    roomId: input.resourceId,
  });
}

export async function verifyCalendarSchedulingFinalV2(
  input: FinalSchedulingDraft,
  transport: FinalCheckTransport = DEFAULT_TRANSPORT,
  now: () => number = Date.now
): Promise<CalendarSchedulingVerificationReceiptV2> {
  const durationMinutes = calendarMeetingDurationMinutes(input.startsAt, input.endsAt);
  const searchWindow = calendarAvailabilityWindow(input.startsAt, input.timeZone);
  if (!durationMinutes || !searchWindow) {
    throw new CalendarSchedulingFinalCheckError('INVALID_RANGE');
  }

  const selection = calendarSchedulingParticipantsV2(input.attendees);
  if (selection.uncheckedCount > 0) {
    throw new CalendarSchedulingFinalCheckError('UNRESOLVED_PARTICIPANT');
  }
  if (selection.overflowCount > 0) {
    throw new CalendarSchedulingFinalCheckError('PARTICIPANT_LIMIT');
  }

  const evaluationInput: CalendarSchedulingEvaluationInputV2 = {
    participants: [...selection.participants],
    searchWindow,
    candidateSlot: { startsAt: input.startsAt, endsAt: input.endsAt },
    durationMinutes,
    searchTimeZone: input.timeZone,
    roomCriteria: {
      ...(input.resource?.site ? { site: input.resource.site } : {}),
      ...(input.resource?.floor ? { floor: input.resource.floor } : {}),
      minimumCapacity: input.attendees.length + 1,
      requiredFeatures: input.resource?.features ?? [],
      preferredFeatures: input.resource ? [] : ['VIDEO'],
      approvalPreference: input.resource?.approvalRequired
        ? 'REQUIRE_APPROVAL'
        : input.resource
          ? 'REQUIRE_NO_APPROVAL'
          : 'PREFER_NO_APPROVAL',
    },
  };
  const evaluation = await transport.evaluate(evaluationInput);
  const candidate = calendarSchedulingCurrentCandidateV2(evaluation, input.startsAt, input.endsAt);
  const decision = calendarSchedulingCandidateDecisionV2(evaluation, candidate, true, now());
  if (!decision.canApply) {
    throw new CalendarSchedulingFinalCheckError('UNVERIFIED_EVIDENCE');
  }

  const roomId = input.resourceId;
  const recheck = await transport.hardRecheck(evaluation.evaluationId, {
    challengeToken: evaluation.challengeToken,
    criteriaHash: evaluation.criteriaHash,
    selection: { startsAt: input.startsAt, endsAt: input.endsAt },
    roomId,
  });
  const receipt = calendarSchedulingVerificationReceiptV2(
    evaluation,
    recheck,
    { startsAt: input.startsAt, endsAt: input.endsAt },
    roomId,
    calendarSchedulingAssistedDraftFingerprintV2({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timeZone: input.timeZone,
      attendees: input.attendees,
      resourceId: roomId,
    }),
    now()
  );
  if (!receipt) {
    throw new CalendarSchedulingFinalCheckError('HARD_RECHECK_BLOCKED');
  }
  return receipt;
}
