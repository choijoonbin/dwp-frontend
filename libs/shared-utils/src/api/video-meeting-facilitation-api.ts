import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-api';

export type VideoMeetingFacilitationTimerState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
export type VideoMeetingFacilitationQuestionState = 'OPEN' | 'ANSWERED' | 'DISMISSED';
export type VideoMeetingFacilitationPollState = 'DRAFT' | 'OPEN' | 'CLOSED';

export type VideoMeetingFacilitationCapabilities = {
  meetingLive: boolean;
  canAskQuestion: boolean;
  canVote: boolean;
  canModerate: boolean;
};

export type VideoMeetingFacilitationTimer = {
  state: VideoMeetingFacilitationTimerState;
  agendaItemId: string | null;
  agendaItemTitle: string | null;
  plannedSeconds: number | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  runningSince: string | null;
  version: number;
};

export type VideoMeetingFacilitationQuestion = {
  questionId: string;
  state: VideoMeetingFacilitationQuestionState;
  text: string;
  authorDisplayName: string;
  answer: string | null;
  upvoteCount: number;
  upvotedByMe: boolean;
  mine: boolean;
  canModerate: boolean;
  version: number;
  sequence: number;
  createdAt: string;
  answeredAt: string | null;
};

export type VideoMeetingFacilitationPollOption = {
  optionId: string;
  position: number;
  label: string;
  voteCount: number;
};

export type VideoMeetingFacilitationPoll = {
  pollId: string;
  state: VideoMeetingFacilitationPollState;
  question: string;
  anonymous: boolean;
  options: VideoMeetingFacilitationPollOption[];
  totalVotes: number;
  myOptionId: string | null;
  myBallotVersion: number;
  canVote: boolean;
  canModerate: boolean;
  version: number;
  sequence: number;
  openedAt: string | null;
  closedAt: string | null;
};

export type VideoMeetingFacilitationSnapshot = {
  transport: 'POLLING';
  pollingIntervalMillis: number;
  serverTime: string;
  sequence: number;
  capabilities: VideoMeetingFacilitationCapabilities;
  timer: VideoMeetingFacilitationTimer;
  questions: VideoMeetingFacilitationQuestion[];
  polls: VideoMeetingFacilitationPoll[];
};

export type VideoMeetingFacilitationCommand<T> = {
  resource: T;
  sequence: number;
  serverTime: string;
};

type JsonObject = Record<string, unknown>;

const QUESTION_STATES = new Set<VideoMeetingFacilitationQuestionState>([
  'OPEN',
  'ANSWERED',
  'DISMISSED',
]);
const POLL_STATES = new Set<VideoMeetingFacilitationPollState>(['DRAFT', 'OPEN', 'CLOSED']);
const TIMER_STATES = new Set<VideoMeetingFacilitationTimerState>([
  'IDLE',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
]);

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidSnapshot();
  return value as JsonObject;
}

function text(value: unknown, maximum: number, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || value.length > maximum) throw invalidSnapshot();
  return value;
}

function integer(value: unknown, minimum = 0, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw invalidSnapshot();
  return value as number;
}

function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw invalidSnapshot();
  return value;
}

function instant(value: unknown, nullable = false): string | null {
  const result = text(value, 100, nullable);
  if (result !== null && !Number.isFinite(Date.parse(result))) throw invalidSnapshot();
  return result;
}

function invalidSnapshot() {
  return new Error('Meeting facilitation returned an invalid snapshot.');
}

function parseQuestion(value: unknown): VideoMeetingFacilitationQuestion {
  const source = object(value);
  const state = text(source.state, 16) as VideoMeetingFacilitationQuestionState;
  if (!QUESTION_STATES.has(state)) throw invalidSnapshot();
  const answer = text(source.answer, 4_000, true);
  if ((state === 'ANSWERED') !== Boolean(answer)) throw invalidSnapshot();
  return {
    questionId: text(source.questionId, 100)!,
    state,
    text: text(source.text, 2_000)!,
    authorDisplayName: text(source.authorDisplayName, 500)!,
    answer,
    upvoteCount: integer(source.upvoteCount)!,
    upvotedByMe: flag(source.upvotedByMe),
    mine: flag(source.mine),
    canModerate: flag(source.canModerate),
    version: integer(source.version)!,
    sequence: integer(source.sequence)!,
    createdAt: instant(source.createdAt)!,
    answeredAt: instant(source.answeredAt, true),
  };
}

function parsePoll(value: unknown): VideoMeetingFacilitationPoll {
  const source = object(value);
  const state = text(source.state, 16) as VideoMeetingFacilitationPollState;
  if (!POLL_STATES.has(state) || !Array.isArray(source.options)) throw invalidSnapshot();
  const options = source.options.map((option): VideoMeetingFacilitationPollOption => {
    const candidate = object(option);
    return {
      optionId: text(candidate.optionId, 100)!,
      position: integer(candidate.position)!,
      label: text(candidate.label, 500)!,
      voteCount: integer(candidate.voteCount)!,
    };
  });
  const optionIds = new Set(options.map((option) => option.optionId));
  const totalVotes = integer(source.totalVotes)!;
  const myOptionId = text(source.myOptionId, 100, true);
  if (
    options.length < 2 ||
    options.length > 6 ||
    optionIds.size !== options.length ||
    options.reduce((sum, option) => sum + option.voteCount, 0) !== totalVotes ||
    (myOptionId !== null && !optionIds.has(myOptionId))
  ) {
    throw invalidSnapshot();
  }
  return {
    pollId: text(source.pollId, 100)!,
    state,
    question: text(source.question, 1_000)!,
    anonymous: flag(source.anonymous),
    options,
    totalVotes,
    myOptionId,
    myBallotVersion: integer(source.myBallotVersion)!,
    canVote: flag(source.canVote),
    canModerate: flag(source.canModerate),
    version: integer(source.version)!,
    sequence: integer(source.sequence)!,
    openedAt: instant(source.openedAt, true),
    closedAt: instant(source.closedAt, true),
  };
}

function parseTimer(value: unknown): VideoMeetingFacilitationTimer {
  const source = object(value);
  const state = text(source.state, 16) as VideoMeetingFacilitationTimerState;
  if (!TIMER_STATES.has(state)) throw invalidSnapshot();
  return {
    state,
    agendaItemId: text(source.agendaItemId, 100, true),
    agendaItemTitle: text(source.agendaItemTitle, 240, true),
    plannedSeconds: integer(source.plannedSeconds, 1, true),
    elapsedSeconds: integer(source.elapsedSeconds)!,
    remainingSeconds: integer(source.remainingSeconds, 0, true),
    runningSince: instant(source.runningSince, true),
    version: integer(source.version)!,
  };
}

function parseSnapshot(value: unknown): VideoMeetingFacilitationSnapshot {
  const source = object(value);
  const capabilitiesSource = object(source.capabilities);
  if (
    source.transport !== 'POLLING' ||
    !Number.isFinite(source.pollingIntervalMillis) ||
    (source.pollingIntervalMillis as number) < 1_000 ||
    !Array.isArray(source.questions) ||
    !Array.isArray(source.polls)
  ) {
    throw invalidSnapshot();
  }
  const capabilities = {
    meetingLive: flag(capabilitiesSource.meetingLive),
    canAskQuestion: flag(capabilitiesSource.canAskQuestion),
    canVote: flag(capabilitiesSource.canVote),
    canModerate: flag(capabilitiesSource.canModerate),
  };
  const questions = source.questions.map(parseQuestion);
  const polls = source.polls.map(parsePoll);
  if (
    questions.some((question) => question.canModerate !== capabilities.canModerate) ||
    polls.some(
      (poll) =>
        poll.canModerate !== capabilities.canModerate ||
        (poll.canVote &&
          (!capabilities.meetingLive || !capabilities.canVote || poll.state !== 'OPEN'))
    )
  ) {
    throw invalidSnapshot();
  }
  return {
    transport: 'POLLING',
    pollingIntervalMillis: integer(source.pollingIntervalMillis, 1_000)!,
    serverTime: instant(source.serverTime)!,
    sequence: integer(source.sequence)!,
    capabilities,
    timer: parseTimer(source.timer),
    questions,
    polls,
  };
}

function path(meetingId: string, suffix = '') {
  return `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/facilitation${suffix}`;
}

function commandConfig(idempotencyKey: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      idempotencyKey
    )
  ) {
    throw new Error('Meeting facilitation commands require a UUID idempotency key.');
  }
  return { headers: { 'Idempotency-Key': idempotencyKey } };
}

export async function getVideoMeetingFacilitation(
  meetingId: string
): Promise<VideoMeetingFacilitationSnapshot> {
  const response = await axiosInstance.get<ApiResponse<VideoMeetingFacilitationSnapshot>>(
    path(meetingId)
  );
  return parseSnapshot(response.data.data);
}

async function post<T, B extends object>(
  meetingId: string,
  suffix: string,
  body: B,
  idempotencyKey: string,
  parseResource: (value: unknown) => T
) {
  const data = (
    await axiosInstance.post<ApiResponse<VideoMeetingFacilitationCommand<T>>, B>(
      path(meetingId, suffix),
      body,
      commandConfig(idempotencyKey)
    )
  ).data.data;
  const source = object(data);
  return {
    resource: parseResource(source.resource),
    sequence: integer(source.sequence)!,
    serverTime: instant(source.serverTime)!,
  };
}

export function askVideoMeetingQuestion(meetingId: string, text: string, idempotencyKey: string) {
  return post<VideoMeetingFacilitationQuestion, { text: string }>(
    meetingId,
    '/questions',
    { text: text.trim() },
    idempotencyKey,
    parseQuestion
  );
}

export function upvoteVideoMeetingQuestion(
  meetingId: string,
  questionId: string,
  idempotencyKey: string
) {
  return post<VideoMeetingFacilitationQuestion, Record<string, never>>(
    meetingId,
    `/questions/${encodeURIComponent(questionId)}/upvote`,
    {},
    idempotencyKey,
    parseQuestion
  );
}

export function answerVideoMeetingQuestion(
  meetingId: string,
  questionId: string,
  answer: string,
  expectedVersion: number,
  idempotencyKey: string
) {
  return post<VideoMeetingFacilitationQuestion, { answer: string; expectedVersion: number }>(
    meetingId,
    `/questions/${encodeURIComponent(questionId)}/answer`,
    { answer: answer.trim(), expectedVersion },
    idempotencyKey,
    parseQuestion
  );
}

export function dismissVideoMeetingQuestion(
  meetingId: string,
  questionId: string,
  expectedVersion: number,
  idempotencyKey: string
) {
  return post<VideoMeetingFacilitationQuestion, { expectedVersion: number }>(
    meetingId,
    `/questions/${encodeURIComponent(questionId)}/dismiss`,
    { expectedVersion },
    idempotencyKey,
    parseQuestion
  );
}

export function createVideoMeetingPoll(
  meetingId: string,
  input: { question: string; options: string[]; anonymous: boolean },
  idempotencyKey: string
) {
  return post<VideoMeetingFacilitationPoll, typeof input>(
    meetingId,
    '/polls',
    input,
    idempotencyKey,
    parsePoll
  );
}

export function transitionVideoMeetingPoll(
  meetingId: string,
  pollId: string,
  action: 'open' | 'close',
  expectedVersion: number,
  idempotencyKey: string
) {
  return post<VideoMeetingFacilitationPoll, { expectedVersion: number }>(
    meetingId,
    `/polls/${encodeURIComponent(pollId)}/${action}`,
    { expectedVersion },
    idempotencyKey,
    parsePoll
  );
}

export function voteVideoMeetingPoll(
  meetingId: string,
  pollId: string,
  optionId: string,
  expectedBallotVersion: number,
  idempotencyKey: string
) {
  return post<VideoMeetingFacilitationPoll, { optionId: string; expectedBallotVersion: number }>(
    meetingId,
    `/polls/${encodeURIComponent(pollId)}/vote`,
    { optionId, expectedBallotVersion },
    idempotencyKey,
    parsePoll
  );
}

export function transitionVideoMeetingAgendaTimer(
  meetingId: string,
  action: 'pause' | 'resume' | 'advance',
  expectedVersion: number,
  idempotencyKey: string
) {
  return post<VideoMeetingFacilitationTimer, { expectedVersion: number }>(
    meetingId,
    `/timer/${action}`,
    { expectedVersion },
    idempotencyKey,
    parseTimer
  );
}

export function startVideoMeetingAgendaTimer(
  meetingId: string,
  agendaItemId: string,
  expectedVersion: number,
  idempotencyKey: string
) {
  return post<VideoMeetingFacilitationTimer, { agendaItemId: string; expectedVersion: number }>(
    meetingId,
    '/timer/start',
    { agendaItemId, expectedVersion },
    idempotencyKey,
    parseTimer
  );
}
