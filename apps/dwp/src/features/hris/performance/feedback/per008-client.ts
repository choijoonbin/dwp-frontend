import {
  parsePer008AssignedDetail,
  parsePer008AssignedList,
  parsePer008CreateCommand,
  parsePer008Release,
  parsePer008RequestOptions,
  parsePer008RequestReceipt,
  parsePer008ResponseCommand,
  parsePer008SubmissionReceipt,
  parsePer008TeamQuery,
  parsePer008TeamProjection,
} from './per008-contract';
import {
  PER008_ROUTES,
} from './per008-model';
import type {
  Per008AssignedFeedbackDetail,
  Per008AssignedFeedbackList,
  Per008CommandContext,
  Per008CreateFeedbackRequestCommand,
  Per008FeedbackRelease,
  Per008FeedbackRequestReceipt,
  Per008FeedbackResponseCommand,
  Per008FeedbackSubmissionReceipt,
  Per008RequestOptions,
  Per008RequestSubject,
  Per008TeamProjection,
  Per008TeamQuery,
} from './per008-model';

export type Per008Transport = (
  path: string,
  init: Readonly<{ method: 'GET' | 'POST'; headers: Readonly<Record<string, string>>; body?: string }>,
  /** `data` is the unwrapped owner payload, never the standard ApiResponse envelope. */
) => Promise<Readonly<{ status: number; data: unknown }>>;

export type Per008EnvelopeTransport = (
  path: string,
  init: Readonly<{ method: 'GET' | 'POST'; headers: Readonly<Record<string, string>>; body?: string }>,
) => Promise<Readonly<{ status: number; data: unknown }>>;

export type Per008ClientErrorCode =
  | 'DENIED'
  | 'NOT_FOUND'
  | 'STALE'
  | 'SUPPRESSED'
  | 'VALIDATION'
  | 'STEP_UP_REQUIRED'
  | 'UNAVAILABLE';

export class Per008ClientError extends Error {
  readonly code: Per008ClientErrorCode;
  readonly status: number;
  readonly problem: Readonly<{ code: string; correlationId: string | null; retryable: boolean }> | null;

  constructor(code: Per008ClientErrorCode, status: number,
    problem: Readonly<{ code: string; correlationId: string | null; retryable: boolean }> | null = null) {
    super(`PER008_${code}`);
    this.name = 'Per008ClientError';
    this.code = code;
    this.status = status;
    this.problem = problem;
  }
}

export class Per008CommandOutcomeUnknownError extends Error {
  readonly idempotencyKey: string;
  constructor(idempotencyKey: string, cause: unknown) {
    super('PER008_COMMAND_OUTCOME_UNKNOWN_REPLAY_WITH_SAME_IDEMPOTENCY_KEY', { cause });
    this.name = 'Per008CommandOutcomeUnknownError';
    this.idempotencyKey = idempotencyKey;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_HEADER = /^[\x20-\x7e]{1,256}$/;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/;

function clientInvalid(): never { throw new Error('PER008_CLIENT_INPUT_INVALID'); }
function uuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function safeHeader(value: unknown, minimum = 1): value is string {
  return typeof value === 'string' && value.length >= minimum && SAFE_HEADER.test(value) && value.trim() === value;
}
function append(params: URLSearchParams, key: string, value: string | number | undefined): void {
  if (value !== undefined) params.set(key, String(value));
}
function problem(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (typeof source.code !== 'string' || !/^[A-Z][A-Z0-9_]{1,127}$/.test(source.code)) return null;
  const correlationId = typeof source.correlationId === 'string' && UUID.test(source.correlationId)
    ? source.correlationId : null;
  return { code: source.code, correlationId, retryable: source.retryable === true } as const;
}
function responseError(status: number, data: unknown): Per008ClientError {
  const detail = problem(data);
  if (status === 401 || status === 403) return new Per008ClientError('DENIED', status, detail);
  if (status === 404) return new Per008ClientError('NOT_FOUND', status, detail);
  if (status === 409) return new Per008ClientError('STALE', status, detail);
  if (status === 422) return new Per008ClientError(
    detail?.code === 'FEEDBACK_AUDIENCE_BELOW_RELEASE_THRESHOLD' ||
      detail?.code === 'FEEDBACK_RELEASE_THRESHOLD_NOT_MET' ? 'SUPPRESSED' : 'VALIDATION', status, detail);
  if (status === 428) return new Per008ClientError('STEP_UP_REQUIRED', status, detail);
  return new Per008ClientError('UNAVAILABLE', status, detail);
}
function expectStatus(status: number, data: unknown, allowed: readonly number[]): void {
  if (!allowed.includes(status)) throw responseError(status, data);
}
function subjectQuery(subject: Per008RequestSubject): string {
  if (!uuid(subject.cycleVersionId) || !uuid(subject.subjectWorkerPublicId) ||
      !uuid(subject.subjectAssignmentPublicId)) clientInvalid();
  const params = new URLSearchParams();
  append(params, 'cycleVersionId', subject.cycleVersionId);
  append(params, 'subjectWorkerPublicId', subject.subjectWorkerPublicId);
  append(params, 'subjectAssignmentPublicId', subject.subjectAssignmentPublicId);
  return params.toString();
}
function commandHeaders(context: Per008CommandContext): Readonly<Record<string, string>> {
  if (!safeHeader(context.idempotencyKey, 16) || context.idempotencyKey.length > 128 ||
      !safeHeader(context.expectedDecisionRevision) ||
      context.stepUpChallenge !== undefined && !safeHeader(context.stepUpChallenge)) clientInvalid();
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': context.idempotencyKey,
    'X-DWP-Expected-Decision-Revision': context.expectedDecisionRevision,
    'X-Purpose-Code': 'PERFORMANCE_FEEDBACK',
    ...(context.stepUpChallenge === undefined ? {} : { 'X-DWP-Step-Up-Challenge': context.stepUpChallenge }),
  };
}
function objectId(value: string): string {
  if (!uuid(value)) clientInvalid();
  return value;
}

function appendMany(params: URLSearchParams, key: string, values?: readonly string[]): void {
  values?.forEach((value) => params.append(key, value));
}

export function per008TeamQueryString(wire: Per008TeamQuery): string {
  const query = parsePer008TeamQuery(wire);
  const params = new URLSearchParams({
    limit: String(query.limit), locale: query.locale, timeZone: query.timeZone,
    correlationId: query.correlationId,
  });
  query.sort.forEach((sort) => params.append('sort', sort));
  if (query.asOf) params.set('asOf', query.asOf);
  if (query.cursor) params.set('cursor', query.cursor);
  appendMany(params, 'filter[performanceAssignment][codes]', query.filter.performanceAssignment?.codes);
  appendMany(params, 'filter[performanceAssignment][publicIds]', query.filter.performanceAssignment?.publicIds);
  appendMany(params, 'filter[dueStatus][codes]', query.filter.dueStatus?.codes);
  if (query.filter.dueStatus?.minimumRevision != null)
    params.set('filter[dueStatus][minimumRevision]', String(query.filter.dueStatus.minimumRevision));
  appendMany(params, 'filter[limitedProfile][codes]', query.filter.limitedProfile?.codes);
  if (query.filter.limitedProfile?.minimumRevision != null)
    params.set('filter[limitedProfile][minimumRevision]', String(query.filter.limitedProfile.minimumRevision));
  if (query.filter.effectiveOn) params.set('filter[effectiveOn]', query.filter.effectiveOn);
  if (params.toString().includes('filter%5B') === false) params.set('filter', '{}');
  return params.toString();
}

export function unwrapPer008ApiResponse(envelope: unknown): unknown {
  if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope) ||
      !Object.hasOwn(envelope, 'data') || !Object.hasOwn(envelope, 'status') ||
      typeof (envelope as { status?: unknown }).status !== 'string') {
    throw new Error('PER008_API_ENVELOPE_INVALID');
  }
  return (envelope as { data: unknown }).data;
}

/** Adapts the application's standard ApiResponse envelope to the parser-facing transport. */
export function createPer008EnvelopeAdapter(transport: Per008EnvelopeTransport): Per008Transport {
  return async (path, init) => {
    const response = await transport(path, init);
    return { status: response.status, data: unwrapPer008ApiResponse(response.data) };
  };
}

/** Seven exact, owner-bound browser operations. Session and CSRF handling remain host concerns. */
export function createPer008Client(transport: Per008Transport) {
  return {
    async loadTeamPerformance(query: Per008TeamQuery): Promise<Per008TeamProjection> {
      const response = await transport(`${PER008_ROUTES.teamPerformance}?${per008TeamQueryString(query)}`,
        { method: 'GET', headers: {} });
      expectStatus(response.status, response.data, [200]);
      return parsePer008TeamProjection(response.data);
    },

    async loadRequestOptions(subject: Per008RequestSubject): Promise<Per008RequestOptions> {
      const response = await transport(`${PER008_ROUTES.requestOptions}?${subjectQuery(subject)}`,
        { method: 'GET', headers: {} });
      expectStatus(response.status, response.data, [200]);
      const options = parsePer008RequestOptions(response.data);
      if (options.cycleVersionId !== subject.cycleVersionId ||
          options.subjectWorkerPublicId !== subject.subjectWorkerPublicId ||
          options.subjectAssignmentPublicId !== subject.subjectAssignmentPublicId) clientInvalid();
      return options;
    },

    async createFeedbackRequest(command: Per008CreateFeedbackRequestCommand, context: Per008CommandContext):
      Promise<Per008FeedbackRequestReceipt> {
      const parsed = parsePer008CreateCommand(command);
      let response: Awaited<ReturnType<Per008Transport>>;
      try {
        response = await transport(PER008_ROUTES.createRequest, {
          method: 'POST', headers: commandHeaders(context), body: JSON.stringify(parsed),
        });
      } catch (error) { throw new Per008CommandOutcomeUnknownError(context.idempotencyKey, error); }
      expectStatus(response.status, response.data, [200, 201, 202]);
      return parsePer008RequestReceipt(response.data);
    },

    async loadMyAssignments(cursor?: string): Promise<Per008AssignedFeedbackList> {
      if (cursor !== undefined && !CURSOR.test(cursor)) clientInvalid();
      const params = new URLSearchParams();
      append(params, 'cursor', cursor);
      const suffix = params.size === 0 ? '' : `?${params.toString()}`;
      const response = await transport(`${PER008_ROUTES.mine}${suffix}`, { method: 'GET', headers: {} });
      expectStatus(response.status, response.data, [200]);
      return parsePer008AssignedList(response.data);
    },

    async loadAssignment(feedbackAssignmentId: string): Promise<Per008AssignedFeedbackDetail> {
      const id = objectId(feedbackAssignmentId);
      const response = await transport(PER008_ROUTES.assignment(id), { method: 'GET', headers: {} });
      expectStatus(response.status, response.data, [200]);
      const detail = parsePer008AssignedDetail(response.data);
      if (detail.feedbackAssignmentId !== id) clientInvalid();
      return detail;
    },

    async submitResponse(feedbackAssignmentId: string, command: Per008FeedbackResponseCommand,
      context: Per008CommandContext): Promise<Per008FeedbackSubmissionReceipt> {
      const id = objectId(feedbackAssignmentId);
      const parsed = parsePer008ResponseCommand(command);
      let response: Awaited<ReturnType<Per008Transport>>;
      try {
        response = await transport(PER008_ROUTES.submitResponse(id), {
          method: 'POST', headers: commandHeaders(context), body: JSON.stringify(parsed),
        });
      } catch (error) { throw new Per008CommandOutcomeUnknownError(context.idempotencyKey, error); }
      expectStatus(response.status, response.data, [200, 201, 202]);
      const receipt = parsePer008SubmissionReceipt(response.data);
      if (receipt.assignmentId !== id) clientInvalid();
      return receipt;
    },

    async loadRelease(feedbackRequestId: string): Promise<Per008FeedbackRelease> {
      const id = objectId(feedbackRequestId);
      const response = await transport(PER008_ROUTES.release(id), { method: 'GET', headers: {} });
      expectStatus(response.status, response.data, [200]);
      const release = parsePer008Release(response.data);
      if (release.feedbackRequestId !== id) clientInvalid();
      return release;
    },
  };
}

export type Per008Client = ReturnType<typeof createPer008Client>;
