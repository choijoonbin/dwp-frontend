const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type JsonRecord = Record<string, unknown>;

export type LiveApiObservation = Readonly<{
  method: string;
  path: string;
  status: number;
  phase: 'PRE_AUTH' | 'AUTHENTICATED';
}>;

export type GatewayMutationAttempt = Readonly<{
  status: number;
  correlationHeader?: string | null;
}>;

export type LiveApiTransportFailure = Readonly<{
  method: string;
  path: string;
  errorText: string;
  phase: 'PRE_AUTH' | 'AUTHENTICATED';
  duringDetailNavigation: boolean;
}>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

export function normalizeGatewayCorrelationHeader(header: string | null | undefined): string {
  const correlationIds = (header ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (correlationIds.length === 0) {
    throw new Error('Gateway correlation header is empty.');
  }
  if (correlationIds.some((correlationId) => !UUID.test(correlationId))) {
    throw new Error('Gateway correlation header contains an invalid identifier.');
  }
  if (new Set(correlationIds).size !== 1) {
    throw new Error('Gateway correlation header contains conflicting identifiers.');
  }
  return correlationIds[0]!;
}

export function isExpectedGatewayMutationSuccess(status: number): boolean {
  return status === 200;
}

export function isExpectedGatewayMutationSequence(statuses: readonly number[]): boolean {
  return (
    (statuses.length === 1 && statuses[0] === 200) ||
    (statuses.length === 2 && statuses[0] === 403 && statuses[1] === 200)
  );
}

export function summarizeGatewayMutationAttempts(
  attempts: readonly GatewayMutationAttempt[]
): string {
  if (attempts.length === 0) return 'no matching responses observed';
  return attempts
    .map((attempt, index) => {
      let correlationId = '<missing-or-invalid>';
      try {
        correlationId = normalizeGatewayCorrelationHeader(attempt.correlationHeader);
      } catch {
        // Diagnostics must preserve the response sequence without echoing malformed headers.
      }
      return `#${index + 1} status=${attempt.status} correlation=${correlationId}`;
    })
    .join(', ');
}

export function unexpectedLiveApiFailures(
  observations: readonly LiveApiObservation[],
  expectedReadMutationPath: string
): LiveApiObservation[] {
  const unexpected: LiveApiObservation[] = [];
  let bootstrapAuthenticationFailureConsumed = false;
  const readMutationObservations = observations.filter(
    (observation) =>
      observation.method.toUpperCase() === 'POST' && observation.path === expectedReadMutationPath
  );
  const readMutationSequenceIsExpected = isExpectedGatewayMutationSequence(
    readMutationObservations.map((observation) => observation.status)
  );
  for (const observation of observations) {
    const method = observation.method.toUpperCase();
    const isReadMutation = method === 'POST' && observation.path === expectedReadMutationPath;
    if (isReadMutation && !readMutationSequenceIsExpected) {
      unexpected.push(observation);
      continue;
    }
    const failed = observation.status <= 0 || observation.status >= 400;
    if (!failed) continue;
    if (
      !bootstrapAuthenticationFailureConsumed &&
      observation.phase === 'PRE_AUTH' &&
      observation.status === 401 &&
      method === 'GET' &&
      observation.path === '/api/auth/me'
    ) {
      bootstrapAuthenticationFailureConsumed = true;
      continue;
    }
    if (observation.status === 403 && isReadMutation) {
      continue;
    }
    unexpected.push(observation);
  }
  return unexpected;
}

export function unexpectedLiveApiTransportFailures(
  failures: readonly LiveApiTransportFailure[]
): LiveApiTransportFailure[] {
  const unexpected: LiveApiTransportFailure[] = [];
  let detailInboxCancellationConsumed = false;
  for (const failure of failures) {
    if (
      !detailInboxCancellationConsumed &&
      failure.phase === 'AUTHENTICATED' &&
      failure.duringDetailNavigation &&
      failure.method.toUpperCase() === 'GET' &&
      failure.path === '/api/notifications/v1/inbox' &&
      failure.errorText === 'net::ERR_ABORTED'
    ) {
      detailInboxCancellationConsumed = true;
      continue;
    }
    unexpected.push(failure);
  }
  return unexpected;
}

export function isKafkaConsoleConsumerTimeout(stderr: string | null | undefined): boolean {
  const diagnostics = stderr ?? '';
  return (
    /org\.apache\.kafka\.common\.errors\.TimeoutException/u.test(diagnostics) &&
    /Processed a total of \d+ messages/u.test(diagnostics)
  );
}

export function matchingKafkaMaterializationEnvelope(
  output: string,
  expected: Readonly<{
    notificationId: string;
    sourceEventId: string;
    intentId: string;
    tenantId: string;
  }>
): string {
  const expectedEventKey = `materialized:${expected.sourceEventId}:${expected.intentId}`;
  for (const line of output.split(/\r?\n/u).map((candidate) => candidate.trim())) {
    if (!line.startsWith('{')) continue;
    let envelope: JsonRecord | null = null;
    try {
      envelope = record(JSON.parse(line) as unknown);
    } catch {
      continue;
    }
    const data = record(envelope?.data);
    const eventKey = typeof envelope?.eventkey === 'string' ? envelope.eventkey : '';
    if (
      envelope?.type === 'notification.materialized' &&
      envelope.subject === `NOTIFICATION/${expected.notificationId}` &&
      envelope.tenantid === expected.tenantId &&
      eventKey === expectedEventKey &&
      data?.notificationId === expected.notificationId
    ) {
      return line;
    }
  }
  return '';
}
