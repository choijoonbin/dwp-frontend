export type ClockSourceType = 'WEB' | 'MOBILE' | 'KIOSK' | 'DEVICE' | 'IMPORT' | 'API';
export type ClockCaptureMode = 'ONLINE' | 'OFFLINE';
export type ClockTrustLevel = 'LOW' | 'STANDARD' | 'VERIFIED';

export type ClockAvailableAction = Readonly<{
  actionKey: 'hris.action.tim.clock.void';
  method: 'POST';
  hrefTemplate: '/api/time/v1/clock-events/{eventId}/voids';
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type ClockEvent = Readonly<{
  clockEventId: string;
  deepLinkResourceId: string;
  title: string;
  statusCode: string;
  occurredAt: string | null;
  eventOrder: number | null;
  qualityCode: string | null;
  evidenceDigest: string | null;
  availableActions: readonly ClockAvailableAction[];
}>;

export type ClockException = Readonly<{
  exceptionId: string;
  deepLinkResourceId: string;
  clockEventId: string | null;
  code: string;
  state: string;
  eventOrder: number | null;
  evidenceDigest: string | null;
  availableActions: readonly ClockAvailableAction[];
}>;

export type ClockWorkbench = Readonly<{
  queryState: 'EMPTY' | 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
  asOf: string;
  nextCursor: string | null;
  partialFailures: readonly string[];
  events: readonly ClockEvent[];
}>;

export type ClockExceptionWorkbench = Readonly<{
  queryState: 'EMPTY' | 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
  asOf: string;
  nextCursor: string | null;
  partialFailures: readonly string[];
  exceptions: readonly ClockException[];
}>;

export type ClockWorkspace = Readonly<{
  state: 'LOADING' | 'EMPTY' | 'READY' | 'PARTIAL' | 'ERROR';
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
  asOf: string | null;
  failures: readonly string[];
  events: readonly ClockEvent[];
  exceptions: readonly ClockException[];
  eventPage: ClockPageState;
  exceptionPage: ClockPageState;
}>;

export type ClockPageState = Readonly<{
  asOf: string | null;
  nextCursor: string | null;
}>;

export type ClockIngestionScope = Readonly<{
  ready: boolean;
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type RecordClockEventRequest = Readonly<{
  sourcePublicId: string;
  sourceEventKey: string;
  sourceSequence: number;
  sourceType: ClockSourceType;
  devicePublicId: string | null;
  captureMode: ClockCaptureMode;
  offlineBatchPublicId: string | null;
  workerPublicId: string;
  peopleAssignmentPublicId: string;
  peopleAssignmentRevision: number;
  eventType: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
  occurredAt: string;
  sourceLocalDateTime: string;
  sourceTimeZone: string;
  sourceUtcOffsetMinutes: number;
  dstResolution:
    | 'EXACT_OFFSET_SUPPLIED'
    | 'EARLIER_OFFSET_SELECTED'
    | 'LATER_OFFSET_SELECTED'
    | 'GAP_SHIFT_FORWARD';
  instantAuthority: 'SOURCE_INSTANT' | 'LOCAL_WITH_OFFSET' | 'SERVER_RESOLVED';
  tzdbVersion: string;
  timeZoneRuleVersion: string;
  sourceProvenanceDigest: string;
  trustLevel: ClockTrustLevel;
}>;

export type ClockCommandReceipt = Readonly<{
  receiptId: string;
  commandType: 'CLOCK_RECORD' | 'CLOCK_VOID';
  originatingAction: 'TIME_CLOCK_RECORD' | 'TIME_CLOCK_CORRECT';
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: 'TIME_CAPTURE';
  authorizationRevision: number;
  status: 'SUCCEEDED';
  requestDigest: string;
  correlationId: string;
  createdAt: string;
  aggregateVersion: number | null;
  resultRef: string | null;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  label: string
): void {
  const keys = Object.keys(source);
  if (keys.some((key) => !allowed.includes(key)) || required.some((key) => !keys.includes(key))) {
    throw new Error(`Invalid ${label}.`);
  }
}

function exactText(value: unknown, maximum: number, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim() ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f);
    })
  ) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function patternText(value: unknown, pattern: RegExp, maximum: number, label: string): string {
  const candidate = exactText(value, maximum, label);
  if (!pattern.test(candidate)) throw new Error(`Invalid ${label}.`);
  return candidate;
}

function uuid(value: unknown, label: string): string {
  return patternText(value, UUID, 36, label);
}

function integer(value: unknown, minimum: number, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`Invalid ${label}.`);
  }
  return value as number;
}

function instant(value: unknown, label: string): string {
  const candidate = exactText(value, 80, label);
  if (!Number.isFinite(Date.parse(candidate))) throw new Error(`Invalid ${label}.`);
  return candidate;
}

function literal<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value as T;
}

function nullableText(
  value: unknown,
  parser: (candidate: unknown) => string,
  label: string
): string | null {
  if (value === null) return null;
  try {
    return parser(value);
  } catch {
    throw new Error(`Invalid ${label}.`);
  }
}

function parseAvailableActions(value: unknown): readonly ClockAvailableAction[] {
  if (!Array.isArray(value) || value.length > 1) throw new Error('Invalid available actions.');
  return value.map((entry) => {
    const source = record(entry, 'available action');
    exactKeys(
      source,
      ['actionKey', 'method', 'hrefTemplate', 'idempotencyPolicy', 'stepUpPolicy'],
      ['actionKey', 'method', 'hrefTemplate', 'idempotencyPolicy', 'stepUpPolicy'],
      'available action'
    );
    return {
      actionKey: literal(
        source.actionKey,
        ['hris.action.tim.clock.void'] as const,
        'available action key'
      ),
      method: literal(source.method, ['POST'] as const, 'available action method'),
      hrefTemplate: literal(
        source.hrefTemplate,
        ['/api/time/v1/clock-events/{eventId}/voids'] as const,
        'available action route'
      ),
      idempotencyPolicy: literal(
        source.idempotencyPolicy,
        ['REQUIRED_IDEMPOTENCY_KEY'] as const,
        'idempotency policy'
      ),
      stepUpPolicy: literal(
        source.stepUpPolicy,
        ['OWNER_PEP_RISK_POLICY_DECISION_REQUIRED'] as const,
        'step-up policy'
      ),
    };
  });
}

type Decision = 'VIEW' | 'MASK' | 'OMIT';

function parseField(
  groups: Record<string, unknown>,
  key: string,
  parseValue: (value: unknown) => unknown
): Readonly<{ decision: Decision; value: unknown | null }> {
  if (!Object.hasOwn(groups, key)) return { decision: 'OMIT', value: null };
  const source = record(groups[key], `${key} field group`);
  const decision = literal(source.decision, ['VIEW', 'MASK'] as const, `${key} decision`);
  if (decision === 'MASK') {
    exactKeys(
      source,
      ['decision', 'value', 'maskReason', 'maskedDisplayKey'],
      ['decision', 'value', 'maskReason', 'maskedDisplayKey'],
      `${key} masked field group`
    );
    if (source.value !== null) throw new Error(`Invalid ${key} masked value.`);
    patternText(source.maskReason, CODE, 64, `${key} mask reason`);
    patternText(source.maskedDisplayKey, /^[a-z][a-z0-9._-]{1,127}$/u, 128, `${key} mask key`);
    return { decision, value: null };
  }
  exactKeys(source, ['decision', 'value'], ['decision', 'value'], `${key} viewed field group`);
  return { decision, value: parseValue(source.value) };
}

function parseTemporalValue(value: unknown) {
  const source = record(value, 'temporal value');
  exactKeys(
    source,
    ['startAt', 'endAt', 'durationMinutes'],
    ['startAt', 'endAt', 'durationMinutes'],
    'temporal value'
  );
  return {
    startAt: instant(source.startAt, 'temporal start'),
    endAt: nullableText(
      source.endAt,
      (candidate) => instant(candidate, 'temporal end'),
      'temporal end'
    ),
    durationMinutes: integer(source.durationMinutes, 0, 'temporal duration'),
  };
}

function parseStatusValue(value: unknown) {
  const source = record(value, 'status value');
  exactKeys(source, ['code', 'revision'], ['code', 'revision'], 'status value');
  return {
    code: patternText(source.code, CODE, 64, 'status code'),
    revision: integer(source.revision, 1, 'status revision'),
  };
}

function parseAuditValue(value: unknown) {
  const source = record(value, 'audit value');
  exactKeys(
    source,
    ['decisionCode', 'evidenceDigest', 'occurredAt', 'revision'],
    ['decisionCode', 'evidenceDigest', 'occurredAt', 'revision'],
    'audit value'
  );
  return {
    decisionCode: patternText(source.decisionCode, CODE, 64, 'audit decision'),
    evidenceDigest: patternText(source.evidenceDigest, DIGEST, 64, 'audit evidence digest'),
    occurredAt: instant(source.occurredAt, 'audit instant'),
    revision: integer(source.revision, 1, 'audit revision'),
  };
}

function parseReferenceValue(value: unknown) {
  const source = record(value, 'reference value');
  exactKeys(
    source,
    ['publicId', 'code', 'label', 'revision'],
    ['publicId', 'code', 'label', 'revision'],
    'reference value'
  );
  return {
    publicId: patternText(source.publicId, PUBLIC_ID, 128, 'reference public identifier'),
    code: patternText(source.code, CODE, 64, 'reference code'),
    label: exactText(source.label, 512, 'reference label'),
    revision: integer(source.revision, 1, 'reference revision'),
  };
}

function parseMetadataValue(value: unknown) {
  const source = record(value, 'metadata value');
  exactKeys(source, ['key', 'version', 'digest'], ['key', 'version', 'digest'], 'metadata value');
  return {
    key: patternText(source.key, PUBLIC_ID, 128, 'metadata key'),
    version: patternText(source.version, /^[A-Za-z0-9._:-]{1,64}$/u, 64, 'metadata version'),
    digest:
      source.digest === null ? null : patternText(source.digest, DIGEST, 64, 'metadata digest'),
  };
}

function parseDeepLink(value: unknown, route: string) {
  const source = record(value, 'deep link');
  exactKeys(source, ['route', 'resourcePublicId'], ['route', 'resourcePublicId'], 'deep link');
  if (source.route !== route) throw new Error('Invalid deep link route.');
  return patternText(source.resourcePublicId, PUBLIC_ID, 128, 'deep-link resource identifier');
}

type QueryState = Readonly<{
  state: ClockWorkbench['queryState'];
  freshness: ClockWorkbench['freshness'];
  nextCursor: string | null;
  failures: readonly string[];
  expectedCounts: Readonly<{ view: number; mask: number; omit: number }>;
}>;

function parseQueryState(value: unknown, itemCount: number): QueryState {
  const source = record(value, 'query state');
  exactKeys(
    source,
    [
      'state',
      'scopeDecisionRevision',
      'freshness',
      'nextCursor',
      'fieldDecisionSummary',
      'partialFailures',
      'correlationId',
      'cachePolicy',
    ],
    [
      'state',
      'scopeDecisionRevision',
      'freshness',
      'nextCursor',
      'fieldDecisionSummary',
      'partialFailures',
      'correlationId',
      'cachePolicy',
    ],
    'query state'
  );
  const state = literal(
    source.state,
    ['EMPTY', 'COMPLETE', 'PARTIAL', 'UNAVAILABLE'] as const,
    'query state value'
  );
  const freshness = literal(
    source.freshness,
    ['CURRENT', 'STALE', 'UNAVAILABLE'] as const,
    'query freshness'
  );
  patternText(source.scopeDecisionRevision, PUBLIC_ID, 128, 'scope decision revision');
  uuid(source.correlationId, 'query correlation identifier');
  const nextCursor =
    source.nextCursor === null ? null : patternText(source.nextCursor, CURSOR, 1024, 'next cursor');
  const summary = record(source.fieldDecisionSummary, 'field decision summary');
  exactKeys(
    summary,
    ['viewCount', 'maskedCount', 'omittedCount'],
    ['viewCount', 'maskedCount', 'omittedCount'],
    'field decision summary'
  );
  const expectedCounts = {
    view: integer(summary.viewCount, 0, 'view count'),
    mask: integer(summary.maskedCount, 0, 'masked count'),
    omit: integer(summary.omittedCount, 0, 'omitted count'),
  };
  if (!Array.isArray(source.partialFailures) || source.partialFailures.length > 32) {
    throw new Error('Invalid partial failures.');
  }
  const failures = source.partialFailures.map((entry) => {
    const failure = record(entry, 'partial failure');
    exactKeys(
      failure,
      ['componentKey', 'errorCode', 'correlationId', 'retryable'],
      ['componentKey', 'errorCode', 'correlationId', 'retryable'],
      'partial failure'
    );
    patternText(failure.componentKey, /^[a-z][a-z0-9._-]{0,127}$/u, 128, 'failure component');
    uuid(failure.correlationId, 'failure correlation identifier');
    if (typeof failure.retryable !== 'boolean') throw new Error('Invalid partial failure.');
    return patternText(failure.errorCode, CODE, 64, 'failure code');
  });
  const cache = record(source.cachePolicy, 'cache policy');
  exactKeys(
    cache,
    ['authorizationDecisionRevision', 'invalidationEvent', 'maxAgeSeconds'],
    ['authorizationDecisionRevision', 'invalidationEvent', 'maxAgeSeconds'],
    'cache policy'
  );
  patternText(cache.authorizationDecisionRevision, PUBLIC_ID, 128, 'authorization revision');
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') {
    throw new Error('Invalid cache invalidation event.');
  }
  const maxAge = integer(cache.maxAgeSeconds, 0, 'cache maximum age');
  if (maxAge > 300) throw new Error('Invalid cache maximum age.');
  if ((state === 'EMPTY' || state === 'UNAVAILABLE') && itemCount !== 0) {
    throw new Error('Invalid empty query state.');
  }
  if (state === 'PARTIAL' && failures.length === 0) throw new Error('Invalid partial query state.');
  if (state === 'COMPLETE' && failures.length !== 0)
    throw new Error('Invalid complete query state.');
  if ((state === 'UNAVAILABLE') !== (freshness === 'UNAVAILABLE')) {
    throw new Error('Invalid unavailable query state.');
  }
  if (state === 'UNAVAILABLE' && nextCursor !== null) {
    throw new Error('Invalid unavailable query cursor.');
  }
  return { state, freshness, nextCursor, failures, expectedCounts };
}

function verifyDecisionCounts(
  decisions: readonly Decision[],
  expected: QueryState['expectedCounts']
): void {
  const actual = {
    view: decisions.filter((decision) => decision === 'VIEW').length,
    mask: decisions.filter((decision) => decision === 'MASK').length,
    omit: decisions.filter((decision) => decision === 'OMIT').length,
  };
  if (
    actual.view !== expected.view ||
    actual.mask !== expected.mask ||
    actual.omit !== expected.omit
  ) {
    throw new Error('Invalid field decision summary.');
  }
}

export function parseClockWorkbench(value: unknown): ClockWorkbench {
  const source = record(value, 'clock workbench');
  exactKeys(
    source,
    ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items'],
    ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items'],
    'clock workbench'
  );
  if (source.projectionVersion !== '1' || source.variantKey !== 'CLOCK_INGESTION') {
    throw new Error('Invalid clock projection identity.');
  }
  if (!Array.isArray(source.items) || source.items.length > 100) {
    throw new Error('Invalid clock projection items.');
  }
  const decisions: Decision[] = [];
  const events = source.items.map((entry): ClockEvent => {
    const item = record(entry, 'clock projection item');
    exactKeys(
      item,
      ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions'],
      ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions'],
      'clock projection item'
    );
    const clockEventId = patternText(item.itemPublicId, PUBLIC_ID, 128, 'clock item identifier');
    const deepLinkResourceId = parseDeepLink(item.deepLink, '/hr/operations/time/clock-ingestion');
    if (deepLinkResourceId !== clockEventId) throw new Error('Invalid clock deep-link target.');
    const groups = record(item.fieldGroups, 'clock field groups');
    exactKeys(
      groups,
      ['CLOCK_EVENT', 'INGESTION_STATUS', 'QUALITY_FINDING'],
      [],
      'clock field groups'
    );
    if (Object.keys(groups).length === 0) throw new Error('Invalid clock field groups.');
    const temporal = parseField(groups, 'CLOCK_EVENT', parseTemporalValue);
    const status = parseField(groups, 'INGESTION_STATUS', parseStatusValue);
    const quality = parseField(groups, 'QUALITY_FINDING', parseAuditValue);
    decisions.push(temporal.decision, status.decision, quality.decision);
    const temporalValue = temporal.value as ReturnType<typeof parseTemporalValue> | null;
    const statusValue = status.value as ReturnType<typeof parseStatusValue> | null;
    const qualityValue = quality.value as ReturnType<typeof parseAuditValue> | null;
    return {
      clockEventId,
      deepLinkResourceId,
      title: exactText(item.title, 512, 'clock item title'),
      statusCode: patternText(item.statusCode, CODE, 64, 'clock item status'),
      occurredAt: temporalValue?.startAt ?? qualityValue?.occurredAt ?? null,
      eventOrder: statusValue?.revision ?? qualityValue?.revision ?? null,
      qualityCode: qualityValue?.decisionCode ?? null,
      evidenceDigest: qualityValue?.evidenceDigest ?? null,
      availableActions: parseAvailableActions(item.availableActions),
    };
  });
  const query = parseQueryState(source.queryState, events.length);
  verifyDecisionCounts(decisions, query.expectedCounts);
  return {
    queryState: query.state,
    freshness: query.freshness,
    asOf: instant(source.asOf, 'clock projection timestamp'),
    nextCursor: query.nextCursor,
    partialFailures: query.failures,
    events,
  };
}

export function parseClockExceptionWorkbench(value: unknown): ClockExceptionWorkbench {
  const source = record(value, 'clock exception workbench');
  exactKeys(
    source,
    ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items'],
    ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items'],
    'clock exception workbench'
  );
  if (source.projectionVersion !== '1' || source.variantKey !== 'EXCEPTIONS') {
    throw new Error('Invalid clock exception projection identity.');
  }
  if (!Array.isArray(source.items) || source.items.length > 100) {
    throw new Error('Invalid clock exception projection items.');
  }
  const decisions: Decision[] = [];
  const exceptions = source.items.map((entry): ClockException => {
    const item = record(entry, 'clock exception item');
    exactKeys(
      item,
      ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions'],
      ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions'],
      'clock exception item'
    );
    const exceptionId = patternText(item.itemPublicId, PUBLIC_ID, 128, 'exception item identifier');
    const deepLinkResourceId = parseDeepLink(item.deepLink, '/hr/operations/time/exceptions');
    if (deepLinkResourceId !== exceptionId) {
      throw new Error('Invalid exception deep-link target.');
    }
    const groups = record(item.fieldGroups, 'exception field groups');
    exactKeys(
      groups,
      ['EXCEPTION', 'OWNER_DEEP_LINK', 'RECOVERY_METADATA'],
      [],
      'exception field groups'
    );
    if (Object.keys(groups).length === 0) throw new Error('Invalid exception field groups.');
    const exception = parseField(groups, 'EXCEPTION', parseStatusValue);
    const owner = parseField(groups, 'OWNER_DEEP_LINK', parseReferenceValue);
    const recovery = parseField(groups, 'RECOVERY_METADATA', parseMetadataValue);
    decisions.push(exception.decision, owner.decision, recovery.decision);
    const exceptionValue = exception.value as ReturnType<typeof parseStatusValue> | null;
    const ownerValue = owner.value as ReturnType<typeof parseReferenceValue> | null;
    const recoveryValue = recovery.value as ReturnType<typeof parseMetadataValue> | null;
    return {
      exceptionId,
      deepLinkResourceId,
      clockEventId: ownerValue?.publicId ?? null,
      code: exceptionValue?.code ?? exactText(item.title, 512, 'exception item title'),
      state: patternText(item.statusCode, CODE, 64, 'exception item status'),
      eventOrder: exceptionValue?.revision ?? ownerValue?.revision ?? null,
      evidenceDigest: recoveryValue?.digest ?? null,
      availableActions: parseAvailableActions(item.availableActions),
    };
  });
  const query = parseQueryState(source.queryState, exceptions.length);
  verifyDecisionCounts(decisions, query.expectedCounts);
  return {
    queryState: query.state,
    freshness: query.freshness,
    asOf: instant(source.asOf, 'exception projection timestamp'),
    nextCursor: query.nextCursor,
    partialFailures: query.failures,
    exceptions,
  };
}

export function parseClockCommandReceipt(value: unknown): ClockCommandReceipt {
  const source = record(value, 'clock command receipt');
  exactKeys(
    source,
    [
      'receiptId',
      'commandType',
      'originatingAction',
      'subjectPrincipalPublicId',
      'populationScopeDigest',
      'fieldPolicyRevision',
      'purposeCode',
      'authorizationRevision',
      'status',
      'correlationId',
      'requestDigest',
      'createdAt',
      'aggregateVersion',
      'resultRef',
    ],
    [
      'receiptId',
      'commandType',
      'originatingAction',
      'subjectPrincipalPublicId',
      'populationScopeDigest',
      'fieldPolicyRevision',
      'purposeCode',
      'authorizationRevision',
      'status',
      'correlationId',
      'requestDigest',
      'createdAt',
    ],
    'clock command receipt'
  );
  const requestDigest = patternText(source.requestDigest, DIGEST, 64, 'request digest');
  const commandType = literal(
    source.commandType,
    ['CLOCK_RECORD', 'CLOCK_VOID'] as const,
    'command type'
  );
  const originatingAction = literal(
    source.originatingAction,
    ['TIME_CLOCK_RECORD', 'TIME_CLOCK_CORRECT'] as const,
    'originating action'
  );
  if (
    (commandType === 'CLOCK_RECORD' && originatingAction !== 'TIME_CLOCK_RECORD') ||
    (commandType === 'CLOCK_VOID' && originatingAction !== 'TIME_CLOCK_CORRECT')
  ) {
    throw new Error('Invalid clock receipt action binding.');
  }
  const aggregateVersion =
    source.aggregateVersion == null
      ? null
      : integer(source.aggregateVersion, 1, 'aggregate version');
  const resultRef =
    source.resultRef == null ? null : uuid(source.resultRef, 'receipt result reference');
  return Object.freeze({
    receiptId: uuid(source.receiptId, 'receipt identifier'),
    commandType,
    originatingAction,
    subjectPrincipalPublicId: uuid(source.subjectPrincipalPublicId, 'subject principal identifier'),
    populationScopeDigest: patternText(
      source.populationScopeDigest,
      DIGEST,
      64,
      'population scope digest'
    ),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1, 'field policy revision'),
    purposeCode: literal(source.purposeCode, ['TIME_CAPTURE'] as const, 'purpose code'),
    authorizationRevision: integer(source.authorizationRevision, 1, 'authorization revision'),
    status: literal(source.status, ['SUCCEEDED'] as const, 'receipt status'),
    requestDigest,
    correlationId: uuid(source.correlationId, 'correlation identifier'),
    createdAt: instant(source.createdAt, 'receipt timestamp'),
    aggregateVersion,
    resultRef,
  });
}

/** A replay of one idempotent command must return the same sealed public receipt. */
export function assertClockReceiptReplayInvariant(
  first: ClockCommandReceipt,
  replay: ClockCommandReceipt
): void {
  const keys = Object.keys(first) as (keyof ClockCommandReceipt)[];
  if (
    keys.length !== Object.keys(replay).length ||
    keys.some((key) => first[key] !== replay[key])
  ) {
    throw new Error('TIM clock command replay changed its sealed receipt.');
  }
}

function emptyPage(): ClockPageState {
  return { asOf: null, nextCursor: null };
}

export function combineClockWorkspace(
  events: ClockWorkbench | null,
  exceptions: ClockExceptionWorkbench | null,
  failures: readonly string[] = []
): ClockWorkspace {
  const combinedFailures = [
    ...failures,
    ...(events?.partialFailures ?? []),
    ...(exceptions?.partialFailures ?? []),
  ];
  if (!events && !exceptions) {
    return {
      state: 'ERROR',
      freshness: 'UNAVAILABLE',
      asOf: null,
      failures: combinedFailures,
      events: [],
      exceptions: [],
      eventPage: emptyPage(),
      exceptionPage: emptyPage(),
    };
  }
  const eventItems = events?.events ?? [];
  const exceptionItems = exceptions?.exceptions ?? [];
  const partial = !events || !exceptions || combinedFailures.length > 0;
  return {
    state: partial
      ? 'PARTIAL'
      : eventItems.length === 0 && exceptionItems.length === 0
        ? 'EMPTY'
        : 'READY',
    freshness:
      events?.freshness === 'STALE' || exceptions?.freshness === 'STALE'
        ? 'STALE'
        : events?.freshness === 'UNAVAILABLE' || exceptions?.freshness === 'UNAVAILABLE'
          ? 'UNAVAILABLE'
          : 'CURRENT',
    asOf:
      [events?.asOf, exceptions?.asOf]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
    failures: combinedFailures,
    events: eventItems,
    exceptions: exceptionItems,
    eventPage: events ? { asOf: events.asOf, nextCursor: events.nextCursor } : emptyPage(),
    exceptionPage: exceptions
      ? { asOf: exceptions.asOf, nextCursor: exceptions.nextCursor }
      : emptyPage(),
  };
}

export function mergeClockWorkbench(current: ClockWorkbench, next: ClockWorkbench): ClockWorkbench {
  if (current.asOf !== next.asOf) throw new Error('Clock continuation changed its asOf instant.');
  const byId = new Map(current.events.map((event) => [event.clockEventId, event]));
  next.events.forEach((event) => {
    if (!byId.has(event.clockEventId)) byId.set(event.clockEventId, event);
  });
  return {
    ...next,
    partialFailures: [...new Set([...current.partialFailures, ...next.partialFailures])],
    events: [...byId.values()],
  };
}

export function mergeClockExceptionWorkbench(
  current: ClockExceptionWorkbench,
  next: ClockExceptionWorkbench
): ClockExceptionWorkbench {
  if (current.asOf !== next.asOf) {
    throw new Error('Clock exception continuation changed its asOf instant.');
  }
  const byId = new Map(current.exceptions.map((entry) => [entry.exceptionId, entry]));
  next.exceptions.forEach((entry) => {
    if (!byId.has(entry.exceptionId)) byId.set(entry.exceptionId, entry);
  });
  return {
    ...next,
    partialFailures: [...new Set([...current.partialFailures, ...next.partialFailures])],
    exceptions: [...byId.values()],
  };
}
