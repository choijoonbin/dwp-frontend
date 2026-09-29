import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { Temporal } from 'temporal-polyfill';

export type TimeCardStatus = 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED';
export type TimeDataOrigin = 'SOURCE' | 'MANUAL' | 'REFERENCE';
export type TimeEntryType = 'WORK' | 'BREAK' | 'ON_CALL' | 'TRAINING' | 'CORRECTION';
export type TimeWorkMode = 'OFFICE' | 'REMOTE' | 'FIELD' | 'HYBRID';
export type TimeExceptionSeverity = 'INFO' | 'WARNING' | 'BLOCKING';
export type TimeExceptionState = 'OPEN' | 'RESOLVED' | 'WAIVED';

export type TimeCardDisplay = Readonly<{
  timeCardId: string;
  periodStart: string;
  periodEnd: string;
  status: TimeCardStatus;
  scheduledMinutes: number;
  recordedMinutes: number;
  exceptionCount: number;
  dataOrigin: TimeDataOrigin;
  version: number;
}>;

export type TimeEntryDisplay = Readonly<{
  timeEntryId: string;
  workDate: string;
  entryType: TimeEntryType;
  minutes: number;
  workMode?: TimeWorkMode | null;
  note?: string | null;
  version: number;
}>;

export type TimeExceptionDisplay = Readonly<{
  exceptionId: string;
  exceptionCode: string;
  severity: TimeExceptionSeverity;
  occurredOn: string;
  message: string;
  lifecycleState: TimeExceptionState;
  resolutionNote?: string | null;
}>;

export type TimeWorkspaceDisplay = Readonly<{
  card: TimeCardDisplay | null;
  entries: readonly TimeEntryDisplay[];
  exceptions: readonly TimeExceptionDisplay[];
}>;

export type TimeEntryCommandRequest = Readonly<{
  minutes: number;
  workMode: TimeWorkMode;
  note?: string;
  cardVersion: number;
}>;

export type TimeCalendarDay = Readonly<{
  date: string;
  isoDayOfWeek: number;
}>;

export type TimeCalendarPeriod = Readonly<{
  state: 'MONDAY_TO_SUNDAY' | 'NON_STANDARD' | 'INVALID';
  dates: readonly TimeCalendarDay[];
}>;

export type TimeDateCommandState = Readonly<{
  editable: boolean;
  reason:
    | 'CONNECTED_SCHEDULE'
    | 'EXISTING_ENTRY'
    | 'REFERENCE_DATA'
    | 'CARD_NOT_OPEN'
    | 'OUTSIDE_PERIOD'
    | 'OUTSIDE_CONNECTED_SCHEDULE'
    | 'SCHEDULE_UNAVAILABLE';
}>;

export type TimeCommandFailure = Readonly<{
  kind: 'CONFLICT' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'UNKNOWN_OUTCOME' | 'ABORTED' | 'REJECTED';
  preserveDraft: true;
  requiresRefresh: boolean;
  retryAllowed: boolean;
}>;

const CARD_STATUSES = new Set<TimeCardStatus>([
  'OPEN',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'LOCKED',
]);
const DATA_ORIGINS = new Set<TimeDataOrigin>(['SOURCE', 'MANUAL', 'REFERENCE']);
const ENTRY_TYPES = new Set<TimeEntryType>(['WORK', 'BREAK', 'ON_CALL', 'TRAINING', 'CORRECTION']);
const WORK_MODES = new Set<TimeWorkMode>(['OFFICE', 'REMOTE', 'FIELD', 'HYBRID']);
const EXCEPTION_SEVERITIES = new Set<TimeExceptionSeverity>(['INFO', 'WARNING', 'BLOCKING']);
const EXCEPTION_STATES = new Set<TimeExceptionState>(['OPEN', 'RESOLVED', 'WAIVED']);

export function isTimeWorkMode(value: string): value is TimeWorkMode {
  return WORK_MODES.has(value as TimeWorkMode);
}

function invalidTimeSource(): never {
  throw new Error('Time workspace source payload is invalid.');
}

function sourceRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidTimeSource();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalidTimeSource();
  return value as Record<string, unknown>;
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

function sourceText(value: unknown, maximum: number, allowEmpty = false): string {
  if (
    typeof value !== 'string' ||
    (!allowEmpty && value.trim().length === 0) ||
    value.length > maximum ||
    containsControlCharacter(value)
  )
    return invalidTimeSource();
  return value;
}

function optionalSourceText(value: unknown, maximum: number): string | null | undefined {
  if (value === undefined || value === null) return value;
  return sourceText(value, maximum, true);
}

function sourceInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    return invalidTimeSource();
  return value;
}

function sourceEnum<T extends string>(value: unknown, values: ReadonlySet<T>): T {
  const text = sourceText(value, 100);
  if (!values.has(text as T)) return invalidTimeSource();
  return text as T;
}

function sourceArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) return invalidTimeSource();
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return invalidTimeSource();
  }
  return value;
}

function plainDate(value: unknown): Temporal.PlainDate | null {
  if (typeof value !== 'string' || value.length !== 10) return null;
  try {
    const parsed = Temporal.PlainDate.from(value);
    return parsed.toString() === value ? parsed : null;
  } catch {
    return null;
  }
}

function sourceCivilDate(value: unknown): string {
  const text = sourceText(value, 10);
  return plainDate(text)?.toString() ?? invalidTimeSource();
}

function selectTimeCard(source: unknown): TimeCardDisplay {
  const card = sourceRecord(source);
  return Object.freeze({
    timeCardId: sourceText(card.timeCardId, 500),
    periodStart: sourceCivilDate(card.periodStart),
    periodEnd: sourceCivilDate(card.periodEnd),
    status: sourceEnum(card.status, CARD_STATUSES),
    scheduledMinutes: sourceInteger(card.scheduledMinutes, 0),
    recordedMinutes: sourceInteger(card.recordedMinutes, 0),
    exceptionCount: sourceInteger(card.exceptionCount, 0),
    dataOrigin: sourceEnum(card.dataOrigin, DATA_ORIGINS),
    version: sourceInteger(card.version, 0),
  });
}

function selectTimeEntry(source: unknown): TimeEntryDisplay {
  const entry = sourceRecord(source);
  const workMode = optionalSourceText(entry.workMode, 24);
  const note = optionalSourceText(entry.note, 1_000);
  return Object.freeze({
    timeEntryId: sourceText(entry.timeEntryId, 500),
    workDate: sourceCivilDate(entry.workDate),
    entryType: sourceEnum(entry.entryType, ENTRY_TYPES),
    minutes: sourceInteger(entry.minutes, 1, 1_440),
    ...(workMode === undefined
      ? {}
      : { workMode: workMode === null ? null : sourceEnum(workMode, WORK_MODES) }),
    ...(note === undefined ? {} : { note }),
    version: sourceInteger(entry.version, 0),
  });
}

function selectTimeException(source: unknown): TimeExceptionDisplay {
  const exception = sourceRecord(source);
  const resolutionNote = optionalSourceText(exception.resolutionNote, 1_000);
  return Object.freeze({
    exceptionId: sourceText(exception.exceptionId, 500),
    exceptionCode: sourceText(exception.exceptionCode, 80),
    severity: sourceEnum(exception.severity, EXCEPTION_SEVERITIES),
    occurredOn: sourceCivilDate(exception.occurredOn),
    message: sourceText(exception.message, 500),
    lifecycleState: sourceEnum(exception.lifecycleState, EXCEPTION_STATES),
    ...(resolutionNote === undefined ? {} : { resolutionNote }),
  });
}

function uniqueBy<T>(values: readonly T[], identity: (value: T) => string): readonly T[] {
  const identifiers = new Set<string>();
  for (const value of values) {
    const identifier = identity(value);
    if (identifier !== identifier.trim() || identifiers.has(identifier)) return invalidTimeSource();
    identifiers.add(identifier);
  }
  return values;
}

export function selectTimeWorkspaceDisplay(source: unknown): TimeWorkspaceDisplay {
  const workspace = sourceRecord(source);
  const card =
    workspace.card === undefined || workspace.card === null ? null : selectTimeCard(workspace.card);
  const entries = uniqueBy(
    sourceArray(workspace.entries).map(selectTimeEntry),
    (entry) => entry.timeEntryId
  );
  const exceptions = uniqueBy(
    sourceArray(workspace.exceptions).map(selectTimeException),
    (exception) => exception.exceptionId
  );
  if (!card && (entries.length > 0 || exceptions.length > 0)) return invalidTimeSource();
  return Object.freeze({
    card,
    entries: Object.freeze([...entries]),
    exceptions: Object.freeze([...exceptions]),
  });
}

export function timeDateAtInstant(instant: string, timeZone: string): string | null {
  try {
    return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDate().toString();
  } catch {
    return null;
  }
}

export function mondayToSundayWeek(anchor: string): readonly TimeCalendarDay[] {
  const date = plainDate(anchor);
  if (!date) return [];
  const monday = date.subtract({ days: date.dayOfWeek - 1 });
  return Array.from({ length: 7 }, (_, index) => {
    const current = monday.add({ days: index });
    return { date: current.toString(), isoDayOfWeek: current.dayOfWeek };
  });
}

export function resolveTimeCalendarPeriod(
  periodStart: string,
  periodEnd: string
): TimeCalendarPeriod {
  const start = plainDate(periodStart);
  const end = plainDate(periodEnd);
  if (!start || !end || Temporal.PlainDate.compare(end, start) < 0) {
    return { state: 'INVALID', dates: [] };
  }
  const days = start.until(end, { largestUnit: 'days' }).days + 1;
  if (days > 31) return { state: 'INVALID', dates: [] };
  const dates = Array.from({ length: days }, (_, index) => {
    const current = start.add({ days: index });
    return { date: current.toString(), isoDayOfWeek: current.dayOfWeek };
  });
  return {
    state:
      days === 7 && start.dayOfWeek === 1 && end.dayOfWeek === 7
        ? 'MONDAY_TO_SUNDAY'
        : 'NON_STANDARD',
    dates,
  };
}

export function hrisTimeQueryKey(scope: { cacheKey: readonly string[] }) {
  return ['hris', 'time', 'workspace-v2', ...scope.cacheKey] as const;
}

export function resolveTimeDateCommandState({
  card,
  date,
  entry,
  period,
  connectedScheduleDates,
}: {
  card: TimeCardDisplay;
  date: string;
  entry?: TimeEntryDisplay;
  period: TimeCalendarPeriod;
  connectedScheduleDates?: ReadonlySet<string>;
}): TimeDateCommandState {
  if (card.dataOrigin === 'REFERENCE') {
    return { editable: false, reason: 'REFERENCE_DATA' };
  }
  if (card.status !== 'OPEN') return { editable: false, reason: 'CARD_NOT_OPEN' };
  if (!period.dates.some((day) => day.date === date)) {
    return { editable: false, reason: 'OUTSIDE_PERIOD' };
  }
  if (connectedScheduleDates) {
    return connectedScheduleDates.has(date)
      ? { editable: true, reason: 'CONNECTED_SCHEDULE' }
      : { editable: false, reason: 'OUTSIDE_CONNECTED_SCHEDULE' };
  }
  return entry
    ? { editable: true, reason: 'EXISTING_ENTRY' }
    : { editable: false, reason: 'SCHEDULE_UNAVAILABLE' };
}

export function timeCardCanSubmit(card: TimeCardDisplay): boolean {
  return (
    card.dataOrigin !== 'REFERENCE' &&
    card.status === 'OPEN' &&
    card.recordedMinutes > 0 &&
    card.exceptionCount === 0
  );
}

export function classifyTimeCommandFailure(error: unknown): TimeCommandFailure {
  if (error instanceof HttpError) {
    if (error.status === 409) {
      return {
        kind: 'CONFLICT',
        preserveDraft: true,
        requiresRefresh: true,
        retryAllowed: false,
      };
    }
    if (error.status === 401) {
      return {
        kind: 'UNAUTHENTICATED',
        preserveDraft: true,
        requiresRefresh: false,
        retryAllowed: false,
      };
    }
    if (error.status === 403) {
      return {
        kind: 'FORBIDDEN',
        preserveDraft: true,
        requiresRefresh: false,
        retryAllowed: false,
      };
    }
    return {
      kind: 'REJECTED',
      preserveDraft: true,
      requiresRefresh: false,
      retryAllowed: true,
    };
  }
  if (error instanceof HttpTransportError && error.reason === 'ABORT') {
    return {
      kind: 'ABORTED',
      preserveDraft: true,
      requiresRefresh: false,
      retryAllowed: false,
    };
  }
  return {
    kind: 'UNKNOWN_OUTCOME',
    preserveDraft: true,
    requiresRefresh: true,
    retryAllowed: false,
  };
}

export function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
