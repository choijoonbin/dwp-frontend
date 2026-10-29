import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isExpectedGatewayMutationSequence,
  isExpectedGatewayMutationSuccess,
  isKafkaConsoleConsumerTimeout,
  matchingKafkaMaterializationEnvelope,
  normalizeGatewayCorrelationHeader,
  summarizeGatewayMutationAttempts,
  unexpectedLiveApiFailures,
  unexpectedLiveApiTransportFailures,
} from './notification-live-evidence.ts';

const CORRELATION_ID = '9fc30b37-6c0a-4820-a0f6-bd98231a5cd4';
const NOTIFICATION_ID = '10000000-0000-4000-8000-000000000001';
const WRONG_NOTIFICATION_ID = '60000000-0000-4000-8000-000000000006';
const SOURCE_EVENT_ID = '20000000-0000-4000-8000-000000000002';
const INTENT_ID = '30000000-0000-4000-8000-000000000003';
const WRONG_INTENT_ID = '50000000-0000-4000-8000-000000000005';

test('normalizes a single gateway correlation identifier', () => {
  assert.equal(normalizeGatewayCorrelationHeader(CORRELATION_ID.toUpperCase()), CORRELATION_ID);
});

test('accepts identical comma-joined gateway correlation identifiers', () => {
  assert.equal(
    normalizeGatewayCorrelationHeader(` ${CORRELATION_ID}, ${CORRELATION_ID} `),
    CORRELATION_ID
  );
});

test('rejects different comma-joined gateway correlation identifiers', () => {
  assert.throws(
    () =>
      normalizeGatewayCorrelationHeader(`${CORRELATION_ID}, 8fc30b37-6c0a-4820-a0f6-bd98231a5cd4`),
    /conflicting identifiers/u
  );
});

test('rejects an invalid gateway correlation identifier', () => {
  assert.throws(() => normalizeGatewayCorrelationHeader('not-a-uuid'), /invalid identifier/u);
});

test('rejects an empty gateway correlation identifier', () => {
  assert.throws(() => normalizeGatewayCorrelationHeader(' , '), /empty/u);
  assert.throws(() => normalizeGatewayCorrelationHeader(undefined), /empty/u);
});

test('selects only the final successful mutation after a recoverable CSRF rejection', () => {
  const statuses = [403, 200];

  assert.equal(statuses.find(isExpectedGatewayMutationSuccess), 200);
  assert.equal([403].find(isExpectedGatewayMutationSuccess), undefined);
  assert.equal(isExpectedGatewayMutationSuccess(201), false);
  assert.equal(isExpectedGatewayMutationSequence([200]), true);
  assert.equal(isExpectedGatewayMutationSequence([403, 200]), true);
  assert.equal(isExpectedGatewayMutationSequence([403, 403, 200]), false);
  assert.equal(isExpectedGatewayMutationSequence([500, 200]), false);
});

test('summarizes every observed mutation attempt without trusting malformed headers', () => {
  assert.equal(
    summarizeGatewayMutationAttempts([
      { status: 403, correlationHeader: CORRELATION_ID },
      { status: 500, correlationHeader: 'not-a-correlation-id' },
    ]),
    `#1 status=403 correlation=${CORRELATION_ID}, ` +
      '#2 status=500 correlation=<missing-or-invalid>'
  );
  assert.equal(summarizeGatewayMutationAttempts([]), 'no matching responses observed');
});

test('rejects silent API failures while allowing only bootstrap auth and CSRF recovery', () => {
  const readPath = `/api/notifications/v1/inbox/${NOTIFICATION_ID}/read`;
  const observations = [
    { method: 'GET', path: '/api/auth/me', status: 401, phase: 'PRE_AUTH' as const },
    { method: 'POST', path: readPath, status: 403, phase: 'AUTHENTICATED' as const },
    { method: 'POST', path: readPath, status: 200, phase: 'AUTHENTICATED' as const },
    {
      method: 'GET',
      path: '/api/platform/v1/workspace/saved-views',
      status: 403,
      phase: 'AUTHENTICATED' as const,
    },
    {
      method: 'GET',
      path: '/api/notifications/v1/me/attention-contexts',
      status: 500,
      phase: 'AUTHENTICATED' as const,
    },
    {
      method: 'GET',
      path: '/api/notifications/v1/inbox',
      status: -1,
      phase: 'AUTHENTICATED' as const,
    },
  ];

  assert.deepEqual(unexpectedLiveApiFailures(observations, readPath), observations.slice(3));
});

test('does not excuse repeated or post-authentication identity failures', () => {
  const readPath = `/api/notifications/v1/inbox/${NOTIFICATION_ID}/read`;
  const first = { method: 'GET', path: '/api/auth/me', status: 401, phase: 'PRE_AUTH' as const };
  const repeated = { ...first };
  const postAuth = { ...first, phase: 'AUTHENTICATED' as const };

  assert.deepEqual(unexpectedLiveApiFailures([first, repeated, postAuth], readPath), [
    repeated,
    postAuth,
  ]);
});

test('rejects any read response outside the single-attempt or one-recovery sequence', () => {
  const readPath = `/api/notifications/v1/inbox/${NOTIFICATION_ID}/read`;
  const recovered = [
    { method: 'POST', path: readPath, status: 403, phase: 'AUTHENTICATED' as const },
    { method: 'POST', path: readPath, status: 200, phase: 'AUTHENTICATED' as const },
  ];
  const lateRejection = {
    method: 'POST',
    path: readPath,
    status: 403,
    phase: 'AUTHENTICATED' as const,
  };

  assert.deepEqual(unexpectedLiveApiFailures(recovered, readPath), []);
  assert.deepEqual(unexpectedLiveApiFailures([...recovered, lateRejection], readPath), [
    ...recovered,
    lateRejection,
  ]);
});

test('allows one route-change inbox cancellation but rejects every other transport failure', () => {
  const expected = {
    method: 'GET',
    path: '/api/notifications/v1/inbox',
    errorText: 'net::ERR_ABORTED',
    phase: 'AUTHENTICATED' as const,
    duringDetailNavigation: true,
  };
  const repeated = { ...expected };
  const failedControls = {
    ...expected,
    path: `/api/notifications/v1/inbox/${NOTIFICATION_ID}/attention-controls`,
  };
  const premature = { ...expected, duringDetailNavigation: false };

  assert.deepEqual(
    unexpectedLiveApiTransportFailures([expected, repeated, failedControls, premature]),
    [repeated, failedControls, premature]
  );
});

test('recognizes only the Kafka console consumer bounded-timeout footer', () => {
  assert.equal(
    isKafkaConsoleConsumerTimeout(
      'org.apache.kafka.common.errors.TimeoutException\nProcessed a total of 0 messages'
    ),
    true
  );
  assert.equal(isKafkaConsoleConsumerTimeout('Docker daemon is unavailable'), false);
  assert.equal(
    isKafkaConsoleConsumerTimeout('org.apache.kafka.common.errors.TimeoutException'),
    false
  );
});

test('matches the current materialization envelope rather than a stale notification event', () => {
  const current = JSON.stringify({
    type: 'notification.materialized',
    subject: `NOTIFICATION/${NOTIFICATION_ID}`,
    tenantid: '1',
    eventkey: `materialized:${SOURCE_EVENT_ID}:${INTENT_ID}`,
    data: { notificationId: NOTIFICATION_ID },
  });
  const stale = JSON.stringify({
    type: 'notification.materialized',
    subject: `NOTIFICATION/${NOTIFICATION_ID}`,
    tenantid: '1',
    eventkey: `materialized:40000000-0000-4000-8000-000000000004:${INTENT_ID}`,
    data: { notificationId: NOTIFICATION_ID },
  });
  const wrongIntent = JSON.stringify({
    type: 'notification.materialized',
    subject: `NOTIFICATION/${NOTIFICATION_ID}`,
    tenantid: '1',
    eventkey: `materialized:${SOURCE_EVENT_ID}:${WRONG_INTENT_ID}`,
    data: { notificationId: NOTIFICATION_ID },
  });
  const wrongNotification = JSON.stringify({
    type: 'notification.materialized',
    subject: `NOTIFICATION/${WRONG_NOTIFICATION_ID}`,
    tenantid: '1',
    eventkey: `materialized:${SOURCE_EVENT_ID}:${INTENT_ID}`,
    data: { notificationId: WRONG_NOTIFICATION_ID },
  });
  assert.equal(
    matchingKafkaMaterializationEnvelope(`diagnostic\n${stale}\n${wrongIntent}\n${current}\n`, {
      notificationId: NOTIFICATION_ID,
      sourceEventId: SOURCE_EVENT_ID,
      intentId: INTENT_ID,
      tenantId: '1',
    }),
    current
  );
  assert.equal(
    matchingKafkaMaterializationEnvelope(stale, {
      notificationId: NOTIFICATION_ID,
      sourceEventId: SOURCE_EVENT_ID,
      intentId: INTENT_ID,
      tenantId: '1',
    }),
    ''
  );
  assert.equal(
    matchingKafkaMaterializationEnvelope(`${wrongIntent}\n${wrongNotification}`, {
      notificationId: NOTIFICATION_ID,
      sourceEventId: SOURCE_EVENT_ID,
      intentId: INTENT_ID,
      tenantId: '1',
    }),
    ''
  );
});
