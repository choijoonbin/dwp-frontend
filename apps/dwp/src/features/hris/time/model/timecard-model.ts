import type { components } from '@dwp-frontend/api-contracts';

type GeneratedTimecard = components['schemas']['time_TimecardV1'];
type GeneratedTimecardCorrectionEntry = components['schemas']['time_TimecardCorrectionEntryV1'];
type GeneratedTimecardCorrectionCommand = components['schemas']['time_TimecardCorrectionCommandV1'];
type GeneratedTimecardSubmitCommand = components['schemas']['time_TimecardSubmitCommandV1'];
type GeneratedTimecardDecisionCommand = components['schemas']['time_TimecardDecisionCommandV1'];
type GeneratedTimeCommandReceipt = components['schemas']['time_TimeCommandReceiptV1'];

export const TIMECARD_STATES = [
  'OPEN',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CORRECTION_REQUIRED',
  'LOCKED',
  'CLOSED',
  'SUPERSEDED',
] as const satisfies readonly GeneratedTimecard['state'][];

export type TimecardState = GeneratedTimecard['state'];
export type TimecardDecision = GeneratedTimecardDecisionCommand['decision'];
export type TimecardCommandKind = 'CORRECT' | 'SUBMIT' | 'DECIDE';
export type TimecardReceiptStatus = GeneratedTimeCommandReceipt['status'];
export type TimecardPopulationKind = 'SELF' | 'TARGET_POPULATION';

export type Timecard = Readonly<GeneratedTimecard>;

export type TimecardSnapshot = Readonly<{
  timecard: Timecard;
  etag: string;
}>;

export type TimecardCorrectionEntry = Readonly<GeneratedTimecardCorrectionEntry>;

export type TimecardCorrectionCommand = Readonly<GeneratedTimecardCorrectionCommand>;

export type TimecardSubmitCommand = Readonly<GeneratedTimecardSubmitCommand>;

export type TimecardDecisionCommand = Readonly<GeneratedTimecardDecisionCommand>;

export type TimecardCommandRequest =
  | Readonly<{ kind: 'CORRECT'; body: TimecardCorrectionCommand }>
  | Readonly<{ kind: 'SUBMIT'; body: TimecardSubmitCommand }>
  | Readonly<{ kind: 'DECIDE'; body: TimecardDecisionCommand }>;

export type TimeCommandReceipt = Readonly<GeneratedTimeCommandReceipt>;

export type TimecardOperationScope = Readonly<{
  ready: boolean;
  contextScopeKey: string;
  decisionRevision: string;
  actorWorkerId: string;
  populationKind: TimecardPopulationKind;
  timecardPurpose: 'TIME_TIMECARD';
  receiptPurpose: 'COMMAND_STATUS';
}>;

export const TIMECARD_ORIGINATING_ACTION = Object.freeze({
  CORRECT: 'TIME_TIMECARD_CORRECT',
  SUBMIT: 'TIME_TIMECARD_SUBMIT',
  DECIDE: 'TIME_TIMECARD_DECIDE',
} as const satisfies Record<TimecardCommandKind, string>);

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CONTEXT_SCOPE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u;
const STATE_SET = new Set<string>(TIMECARD_STATES);
const RECEIPT_STATUSES = new Set<TimecardReceiptStatus>([
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const POPULATION_KINDS = new Set<TimecardPopulationKind>(['SELF', 'TARGET_POPULATION']);

function invalid(context: string): never {
  throw new Error(`Invalid canonical TIM ${context}.`);
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(context);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(context);
  return value as Record<string, unknown>;
}

function exactKeys(
  source: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  context: string
) {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(source);
  if (
    required.some((key) => !Object.hasOwn(source, key)) ||
    keys.some((key) => !allowed.has(key))
  ) {
    return invalid(context);
  }
}

function text(value: unknown, maximum: number, context: string): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    value !== value.trim() ||
    [...value].some((character) => {
      const point = character.codePointAt(0);
      return point !== undefined && (point < 0x20 || point === 0x7f);
    })
  ) {
    return invalid(context);
  }
  return value;
}

function uuid(value: unknown, context: string): string {
  const candidate = text(value, 36, context);
  return UUID.test(candidate) ? candidate.toLowerCase() : invalid(context);
}

function integer(value: unknown, minimum: number, maximum: number, context: string): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : invalid(context);
}

function civilDate(value: unknown, context: string): string {
  const candidate = text(value, 10, context);
  if (!CIVIL_DATE.test(candidate)) return invalid(context);
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : invalid(context);
}

function instant(value: unknown, context: string): string {
  const candidate = text(value, 50, context);
  return /^\d{4}-\d{2}-\d{2}T/u.test(candidate) && Number.isFinite(Date.parse(candidate))
    ? candidate
    : invalid(context);
}

function boundedString(value: unknown, maximum: number, context: string): string {
  if (typeof value !== 'string' || value.length > maximum) return invalid(context);
  return value;
}

function stringValue(value: unknown, context: string): string {
  return typeof value === 'string' ? value : invalid(context);
}

function opaqueEtag(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 512 ||
    value.trim().length < 1 ||
    [...value].some((character) => {
      const point = character.codePointAt(0);
      return point !== undefined && (point <= 0x1f || point === 0x7f);
    })
  ) {
    return invalid('timecard ETag');
  }
  return value;
}

export function isTimecardUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function assertTimecardOperationScope(scope: TimecardOperationScope): void {
  if (
    !scope ||
    scope.ready !== true ||
    !CONTEXT_SCOPE_KEY.test(scope.contextScopeKey) ||
    text(scope.decisionRevision, 200, 'decision revision') !== scope.decisionRevision ||
    !UUID.test(scope.actorWorkerId) ||
    !POPULATION_KINDS.has(scope.populationKind) ||
    scope.timecardPurpose !== 'TIME_TIMECARD' ||
    scope.receiptPurpose !== 'COMMAND_STATUS'
  ) {
    invalid('operation scope');
  }
}

export function parseTimecard(value: unknown): Timecard {
  const source = record(value, 'timecard response');
  exactKeys(
    source,
    [
      'timecardId',
      'workerId',
      'periodStart',
      'periodEnd',
      'state',
      'totalMinutes',
      'ledgerRevision',
      'version',
    ],
    [],
    'timecard response'
  );
  const periodStart = civilDate(source.periodStart, 'timecard period');
  const periodEnd = civilDate(source.periodEnd, 'timecard period');
  const state = text(source.state, 32, 'timecard state');
  if (periodStart > periodEnd || !STATE_SET.has(state)) return invalid('timecard response');
  return Object.freeze({
    timecardId: uuid(source.timecardId, 'timecard identity'),
    workerId: uuid(source.workerId, 'timecard worker identity'),
    periodStart,
    periodEnd,
    state: state as TimecardState,
    totalMinutes: integer(source.totalMinutes, 0, Number.MAX_SAFE_INTEGER, 'timecard total'),
    ledgerRevision: integer(
      source.ledgerRevision,
      1,
      Number.MAX_SAFE_INTEGER,
      'timecard ledger revision'
    ),
    version: integer(source.version, 0, Number.MAX_SAFE_INTEGER, 'timecard version'),
  });
}

export function parseTimecardSnapshot(value: unknown, etagValue: unknown): TimecardSnapshot {
  const timecard = parseTimecard(value);
  const etag = opaqueEtag(etagValue);
  return Object.freeze({ timecard, etag });
}

function parseCorrectionEntry(value: unknown, timecard: Timecard): TimecardCorrectionEntry {
  const source = record(value, 'timecard correction entry');
  exactKeys(source, ['workDate', 'payCode', 'minutes'], [], 'timecard correction entry');
  const workDate = civilDate(source.workDate, 'timecard correction date');
  if (workDate < timecard.periodStart || workDate > timecard.periodEnd) {
    return invalid('timecard correction date');
  }
  const minutes = integer(source.minutes, -1_440, 1_440, 'timecard correction minutes');
  if (minutes === 0) return invalid('timecard correction minutes');
  return Object.freeze({
    workDate,
    payCode: text(source.payCode, 64, 'timecard correction pay code'),
    minutes,
  });
}

export function parseTimecardCorrectionCommand(
  value: unknown,
  timecard: Timecard
): TimecardCorrectionCommand {
  const source = record(value, 'timecard correction command');
  exactKeys(source, ['reasonCode', 'entries'], [], 'timecard correction command');
  if (!Array.isArray(source.entries) || source.entries.length < 1 || source.entries.length > 100) {
    return invalid('timecard correction command');
  }
  const entries = source.entries.map((entry) => parseCorrectionEntry(entry, timecard));
  Object.freeze(entries);
  return Object.freeze({
    reasonCode: text(source.reasonCode, 64, 'timecard correction reason'),
    entries,
  });
}

export function parseTimecardSubmitCommand(value: unknown): TimecardSubmitCommand {
  const source = record(value, 'timecard submit command');
  exactKeys(source, [], ['reasonCode'], 'timecard submit command');
  return Object.freeze({
    ...(source.reasonCode === undefined
      ? {}
      : { reasonCode: text(source.reasonCode, 64, 'timecard submit reason') }),
  });
}

export function parseTimecardDecisionCommand(value: unknown): TimecardDecisionCommand {
  const source = record(value, 'timecard decision command');
  exactKeys(source, ['decision', 'reasonCode'], ['comment'], 'timecard decision command');
  const decision = text(source.decision, 32, 'timecard decision');
  if (!['APPROVE', 'REJECT', 'REQUIRE_CORRECTION'].includes(decision)) {
    return invalid('timecard decision');
  }
  return Object.freeze({
    decision: decision as TimecardDecision,
    reasonCode: text(source.reasonCode, 64, 'timecard decision reason'),
    ...(source.comment === undefined
      ? {}
      : { comment: boundedString(source.comment, 1_000, 'timecard decision comment') }),
  });
}

export function parseTimecardCommandRequest(
  request: TimecardCommandRequest,
  timecard: Timecard
): TimecardCommandRequest {
  if (request.kind === 'CORRECT') {
    return Object.freeze({
      kind: 'CORRECT',
      body: parseTimecardCorrectionCommand(request.body, timecard),
    });
  }
  if (request.kind === 'SUBMIT') {
    return Object.freeze({ kind: 'SUBMIT', body: parseTimecardSubmitCommand(request.body) });
  }
  if (request.kind === 'DECIDE') {
    return Object.freeze({ kind: 'DECIDE', body: parseTimecardDecisionCommand(request.body) });
  }
  return invalid('timecard command');
}

export function parseTimeCommandReceipt(value: unknown): TimeCommandReceipt {
  const source = record(value, 'timecard command receipt');
  exactKeys(
    source,
    [
      'receiptId',
      'commandType',
      'originatingAction',
      'timecardId',
      'status',
      'requestDigest',
      'acceptedAt',
      'completedAt',
      'resultRef',
    ],
    [],
    'timecard command receipt'
  );
  const status = text(source.status, 32, 'timecard receipt status');
  if (!RECEIPT_STATUSES.has(status as TimecardReceiptStatus)) {
    return invalid('timecard receipt status');
  }
  const requestDigest = text(source.requestDigest, 64, 'timecard receipt request digest');
  if (!SHA256.test(requestDigest)) return invalid('timecard receipt request digest');
  const resultRef =
    source.resultRef === null ? null : stringValue(source.resultRef, 'timecard receipt result');
  const completedAt =
    source.completedAt === null ? null : instant(source.completedAt, 'timecard receipt completion');
  return Object.freeze({
    receiptId: uuid(source.receiptId, 'timecard receipt identity'),
    commandType: text(source.commandType, 128, 'timecard receipt command type'),
    originatingAction: text(source.originatingAction, 128, 'timecard receipt action'),
    timecardId: uuid(source.timecardId, 'timecard receipt aggregate'),
    status: status as TimecardReceiptStatus,
    requestDigest,
    acceptedAt: instant(source.acceptedAt, 'timecard receipt acceptance'),
    completedAt,
    resultRef,
  });
}

export function assertTimecardReceiptBinding(
  receipt: TimeCommandReceipt,
  kind: TimecardCommandKind,
  timecardId: string
): void {
  if (
    receipt.originatingAction !== TIMECARD_ORIGINATING_ACTION[kind] ||
    receipt.timecardId !== timecardId.toLowerCase()
  ) {
    invalid('timecard receipt binding');
  }
}

const RECEIPT_PROGRESS: Readonly<Record<TimecardReceiptStatus, readonly TimecardReceiptStatus[]>> =
  {
    ACCEPTED: ['ACCEPTED', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'RESULT_UNKNOWN'],
    RUNNING: ['RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'RESULT_UNKNOWN'],
    RESULT_UNKNOWN: ['RESULT_UNKNOWN', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED'],
    SUCCEEDED: ['SUCCEEDED'],
    REJECTED: ['REJECTED'],
    FAILED: ['FAILED'],
  };

export function assertTimecardReceiptProgression(
  previous: TimeCommandReceipt,
  next: TimeCommandReceipt
): void {
  if (
    previous.receiptId !== next.receiptId ||
    previous.commandType !== next.commandType ||
    previous.originatingAction !== next.originatingAction ||
    previous.timecardId !== next.timecardId ||
    previous.requestDigest !== next.requestDigest ||
    previous.acceptedAt !== next.acceptedAt ||
    !RECEIPT_PROGRESS[previous.status].includes(next.status) ||
    (previous.completedAt !== null && previous.completedAt !== next.completedAt) ||
    (previous.resultRef !== null && previous.resultRef !== next.resultRef)
  ) {
    invalid('timecard receipt replay');
  }
}

export function timecardCommandAllowed(
  kind: TimecardCommandKind,
  timecard: Timecard,
  scope: TimecardOperationScope
): boolean {
  if (!scope.ready) return false;
  if (kind === 'CORRECT') {
    return ['OPEN', 'REJECTED', 'CORRECTION_REQUIRED'].includes(timecard.state);
  }
  if (kind === 'SUBMIT') return timecard.state === 'OPEN' && scope.populationKind === 'SELF';
  return (
    timecard.state === 'SUBMITTED' &&
    scope.populationKind === 'TARGET_POPULATION' &&
    scope.actorWorkerId.toLowerCase() !== timecard.workerId
  );
}

export function timecardStateAfterCommand(
  state: TimecardState,
  request: TimecardCommandRequest
): TimecardState | null {
  if (request.kind === 'CORRECT' && ['OPEN', 'REJECTED', 'CORRECTION_REQUIRED'].includes(state)) {
    return 'OPEN';
  }
  if (request.kind === 'SUBMIT' && state === 'OPEN') return 'SUBMITTED';
  if (request.kind === 'DECIDE' && state === 'SUBMITTED') {
    return request.body.decision === 'APPROVE'
      ? 'APPROVED'
      : request.body.decision === 'REJECT'
        ? 'REJECTED'
        : 'CORRECTION_REQUIRED';
  }
  return null;
}

export function sumCorrectionMinutes(entries: readonly TimecardCorrectionEntry[]): number {
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  return Number.isSafeInteger(total) ? total : invalid('timecard correction total');
}

export function formatTimecardMinutes(minutes: number): string {
  if (!Number.isSafeInteger(minutes) || minutes < 0) return '—';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}
