import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { CheckpointHold, parseCheckpointEnvironment } from './hris-w1-checkpoint-core.mjs';
import { crossTenantFence } from './hris-w1-checkpoint-live.mjs';
import { validEnvironment } from './hris-w1-checkpoint-test-fixtures.mjs';

const EMPTY_SHA256 = createHash('sha256').update(Buffer.alloc(0)).digest('hex');

function fixture({ status, body = Buffer.alloc(0), responseURL } = {}) {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const calls = [];
  const session = {
    context: {
      fetch: async (requestPath, options) => {
        calls.push({ requestPath, options });
        return {
          body: async () => body,
          status: () => status,
          url: () => responseURL ?? new URL(requestPath, environment.endpoints.gateway).toString(),
        };
      },
    },
    gatewayURL: environment.endpoints.gateway,
    tenant: environment.tenants[0],
    label: 'tenant-a',
  };
  return { calls, environment, session };
}

test('cross-tenant fence records an exact empty 401 without requiring JSON', async () => {
  const { calls, environment, session } = fixture({ status: 401 });

  const observed = await crossTenantFence(session, environment.tenants[1]);

  assert.deepEqual(observed, {
    method: 'GET',
    path: '/api/auth/me',
    status: 401,
    responseBodySha256: EMPTY_SHA256,
    responseBodyByteCount: 0,
    requestedTenantId: environment.tenants[1].tenantId,
    outcome: 'DENIED',
  });
  assert.deepEqual(calls, [
    {
      requestPath: '/api/auth/me',
      options: {
        headers: {
          Accept: 'application/json',
          'X-Tenant-ID': String(environment.tenants[1].tenantId),
        },
        failOnStatusCode: false,
        maxRedirects: 0,
        timeout: 45_000,
        method: 'GET',
      },
    },
  ]);
  assert.equal('body' in observed, false);
  assert.equal('headers' in observed, false);
  assert.equal('errorCode' in observed, false);
});

test('cross-tenant fence accepts JSON or empty 403 bodies as status-only evidence', async () => {
  const bodies = [Buffer.from('{"errorCode":"AUTHENTICATION_REQUIRED"}', 'utf8'), Buffer.alloc(0)];
  for (const body of bodies) {
    const { environment, session } = fixture({ status: 403, body });
    const observed = await crossTenantFence(session, environment.tenants[1]);

    assert.equal(observed.status, 403);
    assert.equal(observed.responseBodyByteCount, body.byteLength);
    assert.equal(observed.responseBodySha256, createHash('sha256').update(body).digest('hex'));
  }
});

test('cross-tenant fence rejects success, redirects, and unexpected failures', async () => {
  for (const [status, expected] of [
    [200, /did not fail closed \(HTTP 200\)/u],
    [302, /attempted a redirect/u],
    [500, /did not fail closed \(HTTP 500\)/u],
  ]) {
    const { environment, session } = fixture({ status });
    await assert.rejects(
      () => crossTenantFence(session, environment.tenants[1]),
      (error) => error instanceof CheckpointHold && expected.test(error.message)
    );
  }
});

test('cross-tenant fence rejects origin, path, or query boundary drift', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const driftedURLs = [
    'http://127.0.0.1:21999/api/auth/me',
    `${environment.endpoints.gateway}/api/auth/csrf`,
    `${environment.endpoints.gateway}/api/auth/me?redirected=1`,
  ];
  for (const responseURL of driftedURLs) {
    const { session } = fixture({ status: 401, responseURL });
    await assert.rejects(
      () => crossTenantFence(session, environment.tenants[1]),
      (error) =>
        error instanceof CheckpointHold &&
        /escaped the exact live Gateway boundary/u.test(error.message)
    );
  }
});
