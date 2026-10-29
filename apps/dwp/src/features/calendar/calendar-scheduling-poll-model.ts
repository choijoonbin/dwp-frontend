import type {
  CalendarSchedulingPollDetails,
  CalendarSchedulingPollParticipantInput,
  CalendarSchedulingPollVoteChoice,
  CastCalendarSchedulingPollVotesInput,
  CreateCalendarSchedulingPollInput,
} from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';
import {
  formatDate,
  resolveCanonicalTimeZone,
  resolveSupportedLocale,
} from '@dwp-frontend/shared-i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const OFFSET_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type CalendarSchedulingPollDraft = Readonly<{
  title: string;
  description: string;
  timeZone: string;
  candidates: CreateCalendarSchedulingPollInput['candidates'];
  participants: readonly CalendarSchedulingPollParticipantInput[];
  expiresAt: string;
}>;

export type CalendarSchedulingPollValidationCode =
  | 'TITLE_REQUIRED'
  | 'TITLE_TOO_LONG'
  | 'DESCRIPTION_TOO_LONG'
  | 'TIME_ZONE_INVALID'
  | 'CANDIDATE_COUNT'
  | 'CANDIDATE_ID_INVALID'
  | 'CANDIDATE_DUPLICATE'
  | 'CANDIDATE_RANGE_INVALID'
  | 'CANDIDATE_RANGE_DUPLICATE'
  | 'CANDIDATE_NOT_FUTURE'
  | 'CANDIDATE_TOO_FAR'
  | 'CANDIDATE_DURATION'
  | 'RESOURCE_ID_INVALID'
  | 'PARTICIPANT_COUNT'
  | 'PARTICIPANT_ID_INVALID'
  | 'PARTICIPANT_DUPLICATE'
  | 'PARTICIPANT_NAME_REQUIRED'
  | 'PARTICIPANT_NAME_TOO_LONG'
  | 'REQUIRED_PARTICIPANT_MISSING'
  | 'EXPIRES_AT_INVALID'
  | 'EXPIRES_AT_RANGE';

export type CalendarSchedulingPollValidationIssue = Readonly<{
  code: CalendarSchedulingPollValidationCode;
  index?: number;
}>;

export type CalendarSchedulingPollDraftValidation = Readonly<{
  valid: boolean;
  issues: readonly CalendarSchedulingPollValidationIssue[];
}>;

export type CalendarSchedulingPollActorRole =
  'ORGANIZER' | 'PARTICIPANT' | 'ORGANIZER_PARTICIPANT' | 'NONE';

export type CalendarSchedulingPollActions = Readonly<{
  role: CalendarSchedulingPollActorRole;
  isOrganizer: boolean;
  isParticipant: boolean;
  expired: boolean;
  canOpen: boolean;
  canVote: boolean;
  canCancel: boolean;
  canConfirm: boolean;
  eligibleCandidateIds: readonly string[];
}>;

export type CalendarSchedulingPollVoteChoices = Readonly<
  Record<string, CalendarSchedulingPollVoteChoice | undefined>
>;

function isCanonicalTimeZone(value: string) {
  return (
    value.length > 0 &&
    value.length <= 80 &&
    value === value.trim() &&
    resolveCanonicalTimeZone(value) === value
  );
}

function finiteTimestamp(value: string) {
  if (!OFFSET_DATE_TIME.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calendarSchedulingPollDraftValidation(
  draft: CalendarSchedulingPollDraft,
  now = Date.now()
): CalendarSchedulingPollDraftValidation {
  const issues: CalendarSchedulingPollValidationIssue[] = [];
  const add = (code: CalendarSchedulingPollValidationCode, index?: number) =>
    issues.push(index === undefined ? { code } : { code, index });
  const title = draft.title.trim();
  if (!title) add('TITLE_REQUIRED');
  if (title.length > 240) add('TITLE_TOO_LONG');
  if (draft.description.length > 2_000) add('DESCRIPTION_TOO_LONG');
  if (!isCanonicalTimeZone(draft.timeZone)) add('TIME_ZONE_INVALID');

  if (draft.candidates.length < 1 || draft.candidates.length > 20) add('CANDIDATE_COUNT');
  const candidateIds = new Set<string>();
  const candidateRanges = new Set<string>();
  const candidateStarts: number[] = [];
  draft.candidates.forEach((candidate, index) => {
    if (!UUID.test(candidate.candidateId)) add('CANDIDATE_ID_INVALID', index);
    else if (candidateIds.has(candidate.candidateId)) add('CANDIDATE_DUPLICATE', index);
    candidateIds.add(candidate.candidateId);
    if (candidate.resourceId && !UUID.test(candidate.resourceId)) add('RESOURCE_ID_INVALID', index);

    const startsAt = finiteTimestamp(candidate.startsAt);
    const endsAt = finiteTimestamp(candidate.endsAt);
    if (startsAt === null || endsAt === null || endsAt <= startsAt) {
      add('CANDIDATE_RANGE_INVALID', index);
      return;
    }
    candidateStarts.push(startsAt);
    const rangeKey = `${startsAt}/${endsAt}`;
    if (candidateRanges.has(rangeKey)) add('CANDIDATE_RANGE_DUPLICATE', index);
    candidateRanges.add(rangeKey);
    if (startsAt <= now) add('CANDIDATE_NOT_FUTURE', index);
    if (startsAt > now + 365 * DAY) add('CANDIDATE_TOO_FAR', index);
    const duration = endsAt - startsAt;
    if (duration < 5 * MINUTE || duration > 480 * MINUTE) add('CANDIDATE_DURATION', index);
  });

  if (draft.participants.length < 1 || draft.participants.length > 100) {
    add('PARTICIPANT_COUNT');
  }
  const participantIds = new Set<string>();
  let hasRequiredParticipant = false;
  draft.participants.forEach((participant, index) => {
    if (!UUID.test(participant.personPublicId)) add('PARTICIPANT_ID_INVALID', index);
    else if (participantIds.has(participant.personPublicId)) add('PARTICIPANT_DUPLICATE', index);
    participantIds.add(participant.personPublicId);
    const displayName = participant.displayName.trim();
    if (!displayName) add('PARTICIPANT_NAME_REQUIRED', index);
    if (displayName.length > 160) add('PARTICIPANT_NAME_TOO_LONG', index);
    hasRequiredParticipant ||= participant.required;
  });
  if (!hasRequiredParticipant) add('REQUIRED_PARTICIPANT_MISSING');

  const expiresAt = finiteTimestamp(draft.expiresAt);
  if (expiresAt === null) add('EXPIRES_AT_INVALID');
  else {
    const firstCandidate = candidateStarts.length ? Math.min(...candidateStarts) : null;
    if (
      expiresAt <= now ||
      expiresAt > now + 90 * DAY ||
      (firstCandidate !== null && expiresAt > firstCandidate)
    ) {
      add('EXPIRES_AT_RANGE');
    }
  }
  return { valid: issues.length === 0, issues };
}

export function calendarSchedulingPollCreateInput(
  draft: CalendarSchedulingPollDraft,
  idempotencyKey: string,
  now = Date.now()
): CreateCalendarSchedulingPollInput {
  const validation = calendarSchedulingPollDraftValidation(draft, now);
  if (!validation.valid) {
    throw new Error(
      `Calendar scheduling poll draft is invalid: ${validation.issues
        .map((issue) => issue.code)
        .join(', ')}`
    );
  }
  if (!UUID.test(idempotencyKey)) {
    throw new Error('Calendar scheduling poll idempotencyKey must be a canonical UUID.');
  }
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    timeZone: draft.timeZone,
    candidates: draft.candidates.map((candidate) => ({ ...candidate })),
    participants: draft.participants.map((participant) => ({
      ...participant,
      externalEmail: null,
      displayName: participant.displayName.trim(),
    })),
    expiresAt: draft.expiresAt,
    idempotencyKey,
  };
}

function activeCandidateIds(details: CalendarSchedulingPollDetails) {
  const evidence = new Map(
    details.availability.map((value) => [value.candidateId, value] as const)
  );
  return details.poll.candidates
    .filter((candidate) => {
      const candidateEvidence = evidence.get(candidate.candidateId);
      return Boolean(
        candidate.agreementEligible &&
        candidateEvidence?.availabilityState === 'AVAILABLE' &&
        (!candidate.resourceId || candidateEvidence.roomHoldActive)
      );
    })
    .map((candidate) => candidate.candidateId);
}

export function calendarSchedulingPollActions(
  details: CalendarSchedulingPollDetails,
  actorPersonPublicId: string | null | undefined,
  now = Date.now()
): CalendarSchedulingPollActions {
  const validActor = Boolean(actorPersonPublicId && UUID.test(actorPersonPublicId));
  const organizer = validActor && details.poll.organizerPersonPublicId === actorPersonPublicId;
  const participant = Boolean(
    validActor &&
    details.poll.participants.some(
      (value) =>
        value.personPublicId === actorPersonPublicId &&
        value.externalEmail === null &&
        !value.externalVotingEnabled
    )
  );
  const expiresAt = finiteTimestamp(details.poll.expiresAt);
  const expired = expiresAt === null || expiresAt <= now;
  const mutable = !expired;
  const eligibleCandidateIds = mutable ? activeCandidateIds(details) : [];
  return {
    role:
      organizer && participant
        ? 'ORGANIZER_PARTICIPANT'
        : organizer
          ? 'ORGANIZER'
          : participant
            ? 'PARTICIPANT'
            : 'NONE',
    isOrganizer: organizer,
    isParticipant: participant,
    expired,
    canOpen:
      organizer &&
      mutable &&
      (details.poll.state === 'DRAFT' || details.poll.state === 'AGREEMENT_REACHED'),
    canVote:
      participant &&
      mutable &&
      (details.poll.state === 'OPEN' || details.poll.state === 'AGREEMENT_REACHED'),
    canCancel:
      organizer && mutable && ['DRAFT', 'OPEN', 'AGREEMENT_REACHED'].includes(details.poll.state),
    canConfirm:
      organizer &&
      mutable &&
      details.poll.state === 'AGREEMENT_REACHED' &&
      eligibleCandidateIds.length > 0,
    eligibleCandidateIds,
  };
}

export function calendarSchedulingPollInitialVoteChoices(
  details: CalendarSchedulingPollDetails
): CalendarSchedulingPollVoteChoices {
  const candidateIds = new Set(details.poll.candidates.map((candidate) => candidate.candidateId));
  return Object.fromEntries(
    details.poll.myVotes
      .filter((vote) => candidateIds.has(vote.candidateId))
      .map((vote) => [vote.candidateId, vote.choice])
  );
}

export function calendarSchedulingPollVotesComplete(
  details: CalendarSchedulingPollDetails,
  choices: CalendarSchedulingPollVoteChoices
) {
  return (
    details.poll.candidates.length > 0 &&
    details.poll.candidates.every((candidate) => Boolean(choices[candidate.candidateId]))
  );
}

export function calendarSchedulingPollVoteInput(
  details: CalendarSchedulingPollDetails,
  actorPersonPublicId: string,
  choices: CalendarSchedulingPollVoteChoices,
  comment: string,
  idempotencyKey: string,
  now = Date.now()
): CastCalendarSchedulingPollVotesInput {
  const actions = calendarSchedulingPollActions(details, actorPersonPublicId, now);
  if (!actions.canVote || !calendarSchedulingPollVotesComplete(details, choices)) {
    throw new Error('Calendar scheduling poll is not available for a complete internal vote.');
  }
  if (comment.length > 1_000) {
    throw new Error('Calendar scheduling poll vote comment cannot exceed 1000 characters.');
  }
  if (!UUID.test(idempotencyKey)) {
    throw new Error('Calendar scheduling poll idempotencyKey must be a canonical UUID.');
  }
  return {
    votes: details.poll.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      choice: choices[candidate.candidateId]!,
    })),
    comment: comment.trim() || null,
    idempotencyKey,
  };
}

export function formatCalendarSchedulingPollDateTime(
  value: string,
  timeZone: string,
  language: string
) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !isCanonicalTimeZone(timeZone)) return null;
  try {
    return formatDate(
      date,
      {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      },
      resolveSupportedLocale(language)
    );
  } catch {
    return null;
  }
}
