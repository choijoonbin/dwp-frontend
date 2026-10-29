import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import {
  expect,
  request as requestApi,
  test,
  type APIResponse,
  type Response,
} from '@playwright/test';

import { loadNotificationLiveEnvironment } from './support/notification-live-environment';
import {
  isExpectedGatewayMutationSequence,
  isExpectedGatewayMutationSuccess,
  isKafkaConsoleConsumerTimeout,
  matchingKafkaMaterializationEnvelope,
  normalizeGatewayCorrelationHeader,
  summarizeGatewayMutationAttempts,
  unexpectedLiveApiFailures,
  unexpectedLiveApiTransportFailures,
  type LiveApiObservation,
  type LiveApiTransportFailure,
} from './support/notification-live-evidence';

const execFileAsync = promisify(execFile);
const runtime = loadNotificationLiveEnvironment();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const GIT_REVISION = /^[0-9a-f]{40,64}$/u;

type JsonRecord = Record<string, unknown>;

function record(value: unknown, location: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${location} must be a JSON object.`);
  }
  return value as JsonRecord;
}

async function envelopeData(response: APIResponse, location: string): Promise<JsonRecord> {
  const envelope = record(await response.json(), location);
  return record(envelope.data, `${location}.data`);
}

function responsePath(response: Response): string {
  return new URL(response.url()).pathname;
}

function expectGatewayCorrelation(response: Response, label: string): string {
  const header = response.headers()['x-correlation-id'] ?? '';
  try {
    return normalizeGatewayCorrelationHeader(header);
  } catch (error) {
    throw new Error(`${label} correlation ID is invalid.`, { cause: error });
  }
}

async function gitSourceEvidence(cwd: string) {
  const revision = (
    await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', timeout: 10_000 })
  ).stdout.trim();
  if (!GIT_REVISION.test(revision)) {
    throw new Error(`Unable to resolve a canonical Git revision for ${cwd}.`);
  }
  const status = await execFileAsync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 10_000,
  });
  return { revision, worktreeDirty: Boolean(status.stdout.trim()) };
}

async function composeOutput(
  args: string[],
  options: {
    timeout?: number;
    acceptFailure?: (failure: { stdout?: string; stderr?: string; message?: string }) => boolean;
  } = {}
): Promise<string> {
  try {
    const result = await execFileAsync('docker', ['compose', ...args], {
      cwd: runtime.backendRoot,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      timeout: options.timeout ?? 15_000,
    });
    return result.stdout;
  } catch (error) {
    const candidate = error as { stdout?: string; stderr?: string; message?: string };
    if (options.acceptFailure?.(candidate)) return candidate.stdout ?? '';
    throw new Error(
      `docker compose ${args.join(' ')} failed: ${candidate.stderr || candidate.message}`
    );
  }
}

async function postgresScalar(sql: string): Promise<string> {
  return (
    await composeOutput([
      'exec',
      '-T',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'dwp_user',
      '-d',
      'dwp_notification',
      '-Atc',
      sql,
    ])
  ).trim();
}

async function kafkaEvidence(
  notificationId: string,
  sourceEventId: string,
  intentId: string
): Promise<string> {
  const output = await composeOutput(
    [
      '--profile',
      'events',
      'exec',
      '-T',
      'kafka',
      '/opt/kafka/bin/kafka-console-consumer.sh',
      '--bootstrap-server',
      'kafka:29092',
      '--topic',
      'dwp.notification.outbox.v1',
      '--from-beginning',
      '--timeout-ms',
      '4000',
    ],
    {
      timeout: 12_000,
      acceptFailure: (failure) => isKafkaConsoleConsumerTimeout(failure.stderr),
    }
  );
  return matchingKafkaMaterializationEnvelope(output, {
    notificationId,
    sourceEventId,
    intentId,
    tenantId: runtime.tenantId,
  });
}

function startRedisProbe(channel: string, password: string) {
  const child = spawn(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      '-e',
      'REDISCLI_AUTH',
      'redis',
      'redis-cli',
      '--raw',
      'SUBSCRIBE',
      channel,
    ],
    {
      cwd: runtime.backendRoot,
      env: { ...process.env, REDISCLI_AUTH: password },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
  let output = '';
  let errorOutput = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    errorOutput += chunk;
  });
  child.on('error', (error) => {
    errorOutput += error.message;
  });
  return {
    child,
    text: () => output,
    diagnostics: () => errorOutput,
  };
}

async function stopProbe(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null) return;
  child.stdin.end();
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
    ]);
  }
  child.stdout.destroy();
  child.stderr.destroy();
}

test('browser observes a durable notification through Gateway, Redis, Kafka, and PostgreSQL', async ({
  page,
}, testInfo) => {
  const browserApiObservations: LiveApiObservation[] = [];
  const browserApiTransportFailures: LiveApiTransportFailure[] = [];
  const browserNotificationResponses: Response[] = [];
  let authenticatedSessionObserved = false;
  let detailNavigationCancellationWindowOpen = false;
  page.on('response', (response) => {
    const path = responsePath(response);
    if (path.startsWith('/api/')) {
      browserApiObservations.push({
        method: response.request().method(),
        path,
        status: response.status(),
        phase: authenticatedSessionObserved ? 'AUTHENTICATED' : 'PRE_AUTH',
      });
    }
    if (
      path === '/api/auth/login' &&
      response.request().method() === 'POST' &&
      response.status() === 200
    ) {
      authenticatedSessionObserved = true;
    }
    if (path.startsWith('/api/notifications/')) {
      browserNotificationResponses.push(response);
    }
  });
  page.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return;
    browserApiTransportFailures.push({
      method: request.method(),
      path,
      errorText: request.failure()?.errorText ?? 'unknown transport failure',
      phase: authenticatedSessionObserved ? 'AUTHENTICATED' : 'PRE_AUTH',
      duringDetailNavigation: detailNavigationCancellationWindowOpen,
    });
  });

  const loginFinished = page.waitForResponse(
    (response) =>
      responsePath(response) === '/api/auth/login' && response.request().method() === 'POST',
    { timeout: 30_000 }
  );
  const authoritySnapshotFinished = page.waitForResponse(
    (response) =>
      responsePath(response) === '/api/auth/product-surface-contexts' &&
      response.request().method() === 'GET',
    { timeout: 30_000 }
  );
  const savedViewsFinished = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/platform/v1/workspace/saved-views' &&
        url.searchParams.get('surfaceKey') === 'notifications.work' &&
        response.request().method() === 'GET'
      );
    },
    { timeout: 30_000 }
  );
  const attentionContextsFinished = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/notifications/v1/me/attention-contexts' &&
        url.searchParams.get('kind') === 'RESOURCE' &&
        url.searchParams.get('limit') === '50' &&
        !url.searchParams.has('query') &&
        response.request().method() === 'GET'
      );
    },
    { timeout: 30_000 }
  );

  await page.goto('/sign-in?returnUrl=%2Fnotifications%2Fcenter%3Fview%3Dall');
  await page.locator('input[name="email"]').fill(runtime.email);
  await page.locator('input[name="password"]').fill(runtime.password);
  const [loginResponse, authoritySnapshot, savedViewsResponse, attentionContextsResponse] =
    await Promise.all([
      loginFinished,
      authoritySnapshotFinished,
      savedViewsFinished,
      attentionContextsFinished,
      page.locator('#dwp-sign-in-form button[type="submit"]').click(),
    ]);
  expect(loginResponse.status(), 'real Gateway login').toBe(200);
  const loginCorrelationId = expectGatewayCorrelation(loginResponse, 'login');
  expect(savedViewsResponse.status(), 'Notification saved views').toBe(200);
  const savedViewsCorrelationId = expectGatewayCorrelation(
    savedViewsResponse,
    'Notification saved views'
  );
  expect(attentionContextsResponse.status(), 'Notification attention contexts').toBe(200);
  const attentionContextsCorrelationId = expectGatewayCorrelation(
    attentionContextsResponse,
    'Notification attention contexts'
  );
  const authoritySnapshotText = await authoritySnapshot.text();
  expect(authoritySnapshot.status(), authoritySnapshotText).toBe(200);
  const authoritySnapshotEnvelope = record(
    JSON.parse(authoritySnapshotText) as unknown,
    'product surface authority snapshot'
  );
  const authoritySnapshotData = record(
    authoritySnapshotEnvelope.data,
    'product surface authority snapshot.data'
  );
  expect(
    Array.isArray(authoritySnapshotData.rollouts),
    'product surface authority snapshot.data.rollouts'
  ).toBe(true);
  const notificationRollout = (authoritySnapshotData.rollouts as unknown[])
    .map((candidate, index) => record(candidate, `authority rollout[${index}]`))
    .find((candidate) => candidate.productKey === 'notifications');
  expect(notificationRollout, authoritySnapshotText).toBeDefined();
  expect(notificationRollout?.state, authoritySnapshotText).toBe('100');
  expect(notificationRollout?.authorityStatus, authoritySnapshotText).toBe('AVAILABLE');
  const notificationRolloutFlags = record(
    notificationRollout?.flags,
    'notification authority rollout.flags'
  );
  expect(notificationRolloutFlags, authoritySnapshotText).toEqual({
    contextShadow: true,
    capabilityEnforcement: false,
    surfaceUi: false,
  });
  const authorityCorrelationId = expectGatewayCorrelation(
    authoritySnapshot,
    'product surface authority snapshot'
  );
  await expect(page).toHaveURL(
    (url) => /^\/notifications\/center(?:\/[^/]+)?$/u.test(url.pathname),
    { timeout: 30_000 }
  );

  await expect
    .poll(
      () =>
        browserNotificationResponses.find(
          (response) =>
            responsePath(response) === '/api/notifications/v1/inbox' &&
            response.request().method() === 'GET'
        ),
      { timeout: 30_000, message: 'The browser never requested the real notification inbox.' }
    )
    .not.toBeUndefined();
  const initialInbox = browserNotificationResponses.find(
    (response) =>
      responsePath(response) === '/api/notifications/v1/inbox' &&
      response.request().method() === 'GET'
  )!;
  expect(initialInbox.status(), 'initial notification inbox').toBe(200);
  const inboxCorrelationId = expectGatewayCorrelation(initialInbox, 'initial inbox');

  await expect
    .poll(
      () =>
        browserNotificationResponses.find(
          (response) =>
            responsePath(response) === '/api/notifications/v1/stream' &&
            response.request().method() === 'GET'
        ),
      { timeout: 30_000, message: 'The browser never opened the real notification SSE stream.' }
    )
    .not.toBeUndefined();
  const stream = browserNotificationResponses.find(
    (response) =>
      responsePath(response) === '/api/notifications/v1/stream' &&
      response.request().method() === 'GET'
  )!;
  expect(stream.status(), 'notification SSE stream').toBe(200);
  const streamCorrelationId = expectGatewayCorrelation(stream, 'notification stream');

  const meResponse = await page.request.get('/api/auth/me', {
    headers: { 'X-Tenant-ID': runtime.tenantId },
  });
  expect(meResponse.status(), 'authenticated identity').toBe(200);
  const me = await envelopeData(meResponse, 'authenticated identity');
  const userId = Number(me.userId);
  expect(Number.isSafeInteger(userId) && userId > 0).toBe(true);

  const redisShard = (31n * BigInt(runtime.tenantId) + BigInt(userId)) % 32n;
  const redisChannel = `dwp.notification.signal.v1.${redisShard}`;
  const redisProbe = startRedisProbe(redisChannel, runtime.redisPassword);
  try {
    await expect
      .poll(() => redisProbe.text(), {
        timeout: 15_000,
        message: `Redis probe did not subscribe to ${redisChannel}: ${redisProbe.diagnostics()}`,
      })
      .toContain(`subscribe\n${redisChannel}\n1`);

    const sourceEventId = crypto.randomUUID();
    const requestTitle = `Notification live ${runtime.runId}`;
    const producer = await requestApi.newContext({
      baseURL: runtime.notificationServiceURL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'X-DWP-Tenant-ID': runtime.tenantId,
        'X-DWP-Source-Service': runtime.producerSource,
        'X-DWP-Service-Token': runtime.producerToken,
        'X-Correlation-ID': crypto.randomUUID(),
      },
    });
    let intentId: string;
    let notificationId: string;
    try {
      const materialized = await producer.post('/internal/v1/intents/direct', {
        data: {
          sourceEventId,
          sourceEventType: 'dwp.approval.task.assigned',
          sourceSchemaVersion: 1,
          typeKey: 'APPROVAL.ACTION_REQUIRED',
          recipientUserIds: [userId],
          threadKey: `notification-live:${runtime.runId}`,
          locale: 'ko-KR',
          reasonCode: 'DIRECT',
          actorReference: 'Notification live gate',
          subjectReference: `approval-task:${sourceEventId}`,
          targetReference: `/approvals/tasks/${sourceEventId}`,
          occurredAt: new Date().toISOString(),
          dueAt: new Date(Date.now() + 2 * 60 * 60 * 1_000).toISOString(),
          actionRequired: true,
          contexts: [],
          variables: {
            requestTitle,
            requesterName: 'Notification live gate',
            taskId: sourceEventId,
          },
        },
      });
      const materializedText = await materialized.text();
      expect(materialized.status(), materializedText).toBe(201);
      const materializedEnvelope = record(
        JSON.parse(materializedText) as unknown,
        'materialized notification'
      );
      const materializedData = record(materializedEnvelope.data, 'materialized notification.data');
      intentId = String(materializedData.intentId);
      notificationId = String(materializedData.notificationId);
      expect(intentId).toMatch(UUID);
      expect(notificationId).toMatch(UUID);
    } finally {
      await producer.dispose();
    }
    const materializedEventKey = `materialized:${sourceEventId}:${intentId}`;

    await expect
      .poll(() => redisProbe.text(), {
        timeout: runtime.evidenceTimeoutMs,
        message: `Redis did not carry ${notificationId}: ${redisProbe.diagnostics()}`,
      })
      .toContain(notificationId);

    const notificationRow = page.locator(`[data-notification-focus-id="${notificationId}"]`);
    await expect(notificationRow).toHaveCount(1, { timeout: runtime.evidenceTimeoutMs });
    await expect(notificationRow).toBeVisible({ timeout: runtime.evidenceTimeoutMs });

    const readPath = `/api/notifications/v1/inbox/${notificationId}/read`;
    const attentionControlsPath = `/api/notifications/v1/inbox/${notificationId}/attention-controls`;
    const readAttempts: Response[] = [];
    const readFinished = page.waitForResponse(
      (response) => {
        const matches =
          responsePath(response) === readPath && response.request().method() === 'POST';
        if (matches) readAttempts.push(response);
        return matches && isExpectedGatewayMutationSuccess(response.status());
      },
      { timeout: 30_000 }
    );
    const attentionControlsFinished = page.waitForResponse(
      (response) =>
        responsePath(response) === attentionControlsPath && response.request().method() === 'GET',
      { timeout: 30_000 }
    );
    detailNavigationCancellationWindowOpen = true;
    await notificationRow.click();
    let readResponse: Response;
    try {
      readResponse = await readFinished;
    } catch (error) {
      throw new Error(
        `read mutation did not reach status 200: ${summarizeGatewayMutationAttempts(
          readAttempts.map((response) => ({
            status: response.status(),
            correlationHeader: response.headers()['x-correlation-id'],
          }))
        )}`,
        { cause: error }
      );
    }
    expect(readResponse.status(), 'read mutation through Gateway').toBe(200);
    const readCorrelationId = expectGatewayCorrelation(readResponse, 'read mutation');
    await expect(page).toHaveURL(new RegExp(`/notifications/center/${notificationId}`));
    const attentionControlsResponse = await attentionControlsFinished;
    expect(attentionControlsResponse.status(), 'notification attention controls').toBe(200);
    const attentionControlsCorrelationId = expectGatewayCorrelation(
      attentionControlsResponse,
      'notification attention controls'
    );
    detailNavigationCancellationWindowOpen = false;
    const readAttemptEvidence = readAttempts.map((response, index) => ({
      status: response.status(),
      correlationId: expectGatewayCorrelation(response, `read mutation attempt ${index + 1}`),
    }));
    expect(
      isExpectedGatewayMutationSequence(readAttemptEvidence.map((attempt) => attempt.status)),
      summarizeGatewayMutationAttempts(
        readAttempts.map((response) => ({
          status: response.status(),
          correlationHeader: response.headers()['x-correlation-id'],
        }))
      )
    ).toBe(true);
    const unexpectedApiFailures = unexpectedLiveApiFailures(browserApiObservations, readPath);
    expect(unexpectedApiFailures, 'browser observed an unexpected API failure').toEqual([]);
    expect(
      unexpectedLiveApiTransportFailures(browserApiTransportFailures),
      'browser observed an API transport failure'
    ).toEqual([]);

    await expect
      .poll(
        () =>
          postgresScalar(
            `SELECT CASE WHEN read_at IS NOT NULL THEN 'READ' ELSE 'UNREAD' END ` +
              `FROM ntf_user_notifications WHERE tenant_id=${runtime.tenantId} ` +
              `AND user_id=${userId} AND notification_id='${notificationId}'::uuid`
          ),
        { timeout: runtime.evidenceTimeoutMs }
      )
      .toBe('READ');

    await expect
      .poll(
        () =>
          postgresScalar(
            `SELECT CASE WHEN published_at IS NOT NULL THEN 'PUBLISHED' ELSE 'PENDING' END ` +
              `FROM ntf_outbox_events WHERE tenant_id=${runtime.tenantId} ` +
              `AND aggregate_id='${notificationId}' ` +
              `AND event_type='notification.materialized' ` +
              `AND event_key='${materializedEventKey}' LIMIT 1`
          ),
        { timeout: runtime.evidenceTimeoutMs }
      )
      .toBe('PUBLISHED');

    await expect
      .poll(() => kafkaEvidence(notificationId, sourceEventId, intentId), {
        timeout: runtime.evidenceTimeoutMs,
        intervals: [1_000, 2_000, 4_000],
      })
      .toContain(notificationId);

    expect(
      browserNotificationResponses.some(
        (response) =>
          responsePath(response) === '/api/notifications/v1/inbox' && response.status() === 200
      )
    ).toBe(true);
    expect(browserNotificationResponses.some((response) => response === readResponse)).toBe(true);

    expect(
      unexpectedLiveApiFailures(browserApiObservations, readPath),
      'browser observed a late API failure'
    ).toEqual([]);
    expect(
      unexpectedLiveApiTransportFailures(browserApiTransportFailures),
      'browser observed a late API transport failure'
    ).toEqual([]);

    const [frontendSource, backendSource] = await Promise.all([
      gitSourceEvidence(process.cwd()),
      gitSourceEvidence(runtime.backendRoot),
    ]);
    expect(frontendSource.revision, 'frontend execution revision').toBe(runtime.frontendRevision);
    expect(backendSource.revision, 'backend execution revision').toBe(runtime.backendRevision);
    expect(
      unexpectedLiveApiFailures(browserApiObservations, readPath),
      'browser observed an API failure while collecting source evidence'
    ).toEqual([]);
    expect(
      unexpectedLiveApiTransportFailures(browserApiTransportFailures),
      'browser observed an API transport failure while collecting source evidence'
    ).toEqual([]);
    const evidence = {
      schemaVersion: 1,
      gate: 'notification-live-vertical',
      runId: runtime.runId,
      tenantId: runtime.tenantId,
      userId,
      notificationId,
      sourceEventId,
      intentId,
      materializedEventKey,
      completedAt: new Date().toISOString(),
      source: { frontend: frontendSource, backend: backendSource },
      browser: {
        loginStatus: loginResponse.status(),
        loginCorrelationId,
        authority: {
          transport: 'GET /api/auth/product-surface-contexts',
          productKey: notificationRollout!.productKey,
          state: notificationRollout!.state,
          flags: notificationRolloutFlags,
          status: notificationRollout!.authorityStatus,
          correlationId: authorityCorrelationId,
        },
        inboxStatus: initialInbox.status(),
        inboxCorrelationId,
        savedViewsStatus: savedViewsResponse.status(),
        savedViewsCorrelationId,
        attentionContextsStatus: attentionContextsResponse.status(),
        attentionContextsCorrelationId,
        streamStatus: stream.status(),
        streamCorrelationId,
        readStatus: readResponse.status(),
        readCorrelationId,
        readAttempts: readAttemptEvidence,
        attentionControlsStatus: attentionControlsResponse.status(),
        attentionControlsCorrelationId,
        expectedApiTransportCancellations: browserApiTransportFailures,
      },
      durableEvidence: {
        redisChannel,
        redisSignalMatched: true,
        uiNotificationMatched: true,
        postgresReadState: 'READ',
        postgresOutboxState: 'PUBLISHED',
        kafkaTopic: 'dwp.notification.outbox.v1',
        kafkaNotificationMatched: true,
        kafkaSourceEventMatched: true,
      },
    };
    const evidencePath = testInfo.outputPath('notification-live-vertical-evidence.json');
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    await testInfo.attach('notification-live-vertical-evidence', {
      path: evidencePath,
      contentType: 'application/json',
    });
  } finally {
    await stopProbe(redisProbe.child);
  }
});
