import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BASE_PATH = '/api/platform/v1/calendar/scheduling-polls';
const VOTE_CHOICES = new Set<CalendarSchedulingPollVoteChoice>(['YES', 'IF_NEEDED', 'NO']);

export type CalendarSchedulingPollState =
  'DRAFT' | 'OPEN' | 'AGREEMENT_REACHED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export type CalendarSchedulingPollVoteChoice = 'YES' | 'IF_NEEDED' | 'NO';
export type CalendarSchedulingPollHoldKind = 'PEOPLE_SOFT' | 'ROOM_HARD';
export type CalendarSchedulingPollHoldState = 'ACTIVE' | 'CONSUMED' | 'RELEASED' | 'EXPIRED';
export type CalendarSchedulingPollAvailabilityState =
  'AVAILABLE' | 'ROOM_UNAVAILABLE' | 'HOLD_EXPIRED';

export type CalendarSchedulingPollCandidateInput = Readonly<{
  candidateId: string;
  startsAt: string;
  endsAt: string;
  resourceId: string | null;
}>;

/** External voting has no verified product boundary yet, so creation is internal-person only. */
export type CalendarSchedulingPollParticipantInput = Readonly<{
  personPublicId: string;
  externalEmail: null;
  displayName: string;
  required: boolean;
}>;

export type CreateCalendarSchedulingPollInput = Readonly<{
  title: string;
  description: string | null;
  timeZone: string;
  candidates: readonly CalendarSchedulingPollCandidateInput[];
  participants: readonly CalendarSchedulingPollParticipantInput[];
  expiresAt: string;
  idempotencyKey: string;
}>;

export type CalendarSchedulingPollCandidate = Readonly<{
  candidateId: string;
  startsAt: string;
  endsAt: string;
  resourceId: string | null;
  yesCount: number;
  ifNeededCount: number;
  noCount: number;
  agreementEligible: boolean;
}>;

export type CalendarSchedulingPollParticipant = Readonly<{
  participantId: string;
  personPublicId: string | null;
  externalEmail: string | null;
  displayName: string;
  required: boolean;
  externalVotingEnabled: boolean;
}>;

export type CalendarSchedulingPollVote = Readonly<{
  participantId: string;
  candidateId: string;
  choice: CalendarSchedulingPollVoteChoice;
}>;

export type CalendarSchedulingPoll = Readonly<{
  pollId: string;
  organizerPersonPublicId: string;
  state: CalendarSchedulingPollState;
  title: string;
  description: string | null;
  timeZone: string;
  candidates: readonly CalendarSchedulingPollCandidate[];
  participants: readonly CalendarSchedulingPollParticipant[];
  myVotes: readonly CalendarSchedulingPollVote[];
  expiresAt: string;
  confirmedEventId: string | null;
  confirmedCandidateId: string | null;
  version: number;
  updatedAt: string;
}>;

export type CalendarSchedulingPollHold = Readonly<{
  holdId: string;
  pollId: string;
  candidateId: string;
  kind: CalendarSchedulingPollHoldKind;
  state: CalendarSchedulingPollHoldState;
  personPublicId: string | null;
  resourceId: string | null;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  fencingToken: number;
}>;

export type CalendarSchedulingPollCandidateEvidence = Readonly<{
  candidateId: string;
  availabilityState: CalendarSchedulingPollAvailabilityState;
  safeReasonCode: string | null;
  roomHoldActive: boolean;
}>;

export type CalendarSchedulingPollDetails = Readonly<{
  poll: CalendarSchedulingPoll;
  availability: readonly CalendarSchedulingPollCandidateEvidence[];
  holds: readonly CalendarSchedulingPollHold[];
}>;

export type CalendarSchedulingPollPage = Readonly<{
  items: readonly CalendarSchedulingPollDetails[];
  nextUpdatedAt: string | null;
  nextPollId: string | null;
  hasMore: boolean;
}>;

export type ListCalendarSchedulingPollsInput = Readonly<{
  afterUpdatedAt?: string | null;
  afterPollId?: string | null;
  limit?: number;
}>;

export type CastCalendarSchedulingPollVotesInput = Readonly<{
  votes: readonly Readonly<{
    candidateId: string;
    choice: CalendarSchedulingPollVoteChoice;
  }>[];
  comment: string | null;
  idempotencyKey: string;
}>;

export type ConfirmCalendarSchedulingPollInput = Readonly<{
  candidateId: string;
  calendarId: string;
  idempotencyKey: string;
  version: number;
}>;

function requireUuid(value: string, field: string) {
  if (!UUID.test(value)) {
    throw new Error(`Calendar scheduling poll ${field} must be a canonical UUID.`);
  }
}

function requireVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error('Calendar scheduling poll version must be a non-negative safe integer.');
  }
}

function pollPath(pollId: string) {
  requireUuid(pollId, 'pollId');
  return `${BASE_PATH}/${pollId}`;
}

function privateReadConfig(signal?: AbortSignal) {
  return { signal, headers: { 'Cache-Control': 'no-cache' } };
}

function validateCreateInput(input: CreateCalendarSchedulingPollInput) {
  requireUuid(input.idempotencyKey, 'idempotencyKey');
  for (const candidate of input.candidates) {
    requireUuid(candidate.candidateId, 'candidateId');
    if (candidate.resourceId) requireUuid(candidate.resourceId, 'resourceId');
  }
  for (const participant of input.participants) {
    requireUuid(participant.personPublicId, 'participant personPublicId');
    if (participant.externalEmail !== null) {
      throw new Error('External Calendar scheduling poll voting is not enabled.');
    }
  }
}

export async function listCalendarSchedulingPolls(
  input: ListCalendarSchedulingPollsInput = {},
  signal?: AbortSignal
): Promise<CalendarSchedulingPollPage> {
  const hasUpdatedAt = Boolean(input.afterUpdatedAt);
  const hasPollId = Boolean(input.afterPollId);
  if (hasUpdatedAt !== hasPollId) {
    throw new Error('Both Calendar scheduling poll cursor fields are required together.');
  }
  if (input.afterUpdatedAt && !Number.isFinite(Date.parse(input.afterUpdatedAt))) {
    throw new Error('Calendar scheduling poll cursor time must be a valid timestamp.');
  }
  if (input.afterPollId) requireUuid(input.afterPollId, 'cursor pollId');
  if (
    input.limit !== undefined &&
    (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50)
  ) {
    throw new Error('Calendar scheduling poll page size must be between 1 and 50.');
  }

  const query = new URLSearchParams();
  if (input.afterUpdatedAt) query.set('afterUpdatedAt', input.afterUpdatedAt);
  if (input.afterPollId) query.set('afterPollId', input.afterPollId);
  if (input.limit !== undefined) query.set('limit', String(input.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<CalendarSchedulingPollPage>>(
    `${BASE_PATH}${suffix}`,
    privateReadConfig(signal)
  );
  return response.data.data;
}

export async function getCalendarSchedulingPoll(
  pollId: string,
  signal?: AbortSignal
): Promise<CalendarSchedulingPollDetails> {
  const response = await axiosInstance.get<ApiResponse<CalendarSchedulingPollDetails>>(
    pollPath(pollId),
    privateReadConfig(signal)
  );
  return response.data.data;
}

export async function createCalendarSchedulingPoll(
  input: CreateCalendarSchedulingPollInput,
  signal?: AbortSignal
): Promise<CalendarSchedulingPollDetails> {
  validateCreateInput(input);
  const response = await axiosInstance.post<
    ApiResponse<CalendarSchedulingPollDetails>,
    CreateCalendarSchedulingPollInput
  >(BASE_PATH, input, privateReadConfig(signal));
  return response.data.data;
}

export async function openCalendarSchedulingPoll(
  pollId: string,
  version: number,
  signal?: AbortSignal
): Promise<CalendarSchedulingPollDetails> {
  requireVersion(version);
  const response = await axiosInstance.post<
    ApiResponse<CalendarSchedulingPollDetails>,
    { state: 'OPEN'; version: number }
  >(`${pollPath(pollId)}/open`, { state: 'OPEN', version }, privateReadConfig(signal));
  return response.data.data;
}

export async function castCalendarSchedulingPollVotes(
  pollId: string,
  input: CastCalendarSchedulingPollVotesInput,
  signal?: AbortSignal
): Promise<CalendarSchedulingPollDetails> {
  requireUuid(input.idempotencyKey, 'idempotencyKey');
  if (!input.votes.length || input.votes.length > 20) {
    throw new Error('Calendar scheduling poll votes must contain between 1 and 20 choices.');
  }
  const candidateIds = new Set<string>();
  for (const vote of input.votes) {
    requireUuid(vote.candidateId, 'candidateId');
    if (!VOTE_CHOICES.has(vote.choice)) {
      throw new Error('Calendar scheduling poll vote choice is invalid.');
    }
    if (candidateIds.has(vote.candidateId)) {
      throw new Error('Calendar scheduling poll votes must target unique candidates.');
    }
    candidateIds.add(vote.candidateId);
  }
  if (input.comment && input.comment.length > 1_000) {
    throw new Error('Calendar scheduling poll vote comment cannot exceed 1000 characters.');
  }
  const response = await axiosInstance.post<
    ApiResponse<CalendarSchedulingPollDetails>,
    CastCalendarSchedulingPollVotesInput
  >(`${pollPath(pollId)}/votes`, input, privateReadConfig(signal));
  return response.data.data;
}

export async function cancelCalendarSchedulingPoll(
  pollId: string,
  version: number,
  signal?: AbortSignal
): Promise<CalendarSchedulingPollDetails> {
  requireVersion(version);
  const response = await axiosInstance.post<
    ApiResponse<CalendarSchedulingPollDetails>,
    { state: 'CANCELLED'; version: number }
  >(`${pollPath(pollId)}/cancel`, { state: 'CANCELLED', version }, privateReadConfig(signal));
  return response.data.data;
}

export async function confirmCalendarSchedulingPoll(
  pollId: string,
  input: ConfirmCalendarSchedulingPollInput,
  signal?: AbortSignal
): Promise<CalendarSchedulingPollDetails> {
  requireUuid(input.candidateId, 'candidateId');
  requireUuid(input.calendarId, 'calendarId');
  requireUuid(input.idempotencyKey, 'idempotencyKey');
  requireVersion(input.version);
  const response = await axiosInstance.post<
    ApiResponse<CalendarSchedulingPollDetails>,
    ConfirmCalendarSchedulingPollInput
  >(`${pollPath(pollId)}/confirm`, input, privateReadConfig(signal));
  return response.data.data;
}
