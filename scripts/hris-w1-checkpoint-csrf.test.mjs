import assert from 'node:assert/strict';
import test from 'node:test';

import { CheckpointHold, parseCheckpointEnvironment } from './hris-w1-checkpoint-core.mjs';
import { createLiveSession, mutationJson } from './hris-w1-checkpoint-live.mjs';
import {
  csrfCookie,
  csrfStorageState,
  liveResponse,
  validEnvironment,
} from './hris-w1-checkpoint-test-fixtures.mjs';

test('live session obtains CSRF before posting credentials', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const tenant = environment.tenants[0];
  const calls = [];
  let csrfRequests = 0;
  let cookieToken = null;
  const context = {
    dispose: async () => {},
    storageState: async () => csrfStorageState(environment.endpoints.gateway, cookieToken),
    fetch: async (requestPath, options) => {
      calls.push({ requestPath, options });
      if (requestPath === '/api/auth/csrf') {
        csrfRequests += 1;
        cookieToken =
          csrfRequests === 1 ? 'csrf-token-for-login' : 'csrf-token-after-authenticated-me';
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: {
            headerName: 'X-XSRF-TOKEN',
            token: cookieToken,
          },
        });
      }
      if (requestPath === '/api/auth/login') {
        assert.equal(options.headers['X-XSRF-TOKEN'], 'csrf-token-for-login');
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: { tenantId: String(tenant.tenantId), userId: String(tenant.userId) },
        });
      }
      if (requestPath === '/api/auth/product-surface-access/evaluate') {
        assert.equal(options.headers['X-XSRF-TOKEN'], 'csrf-token-after-authenticated-me');
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: { decision: 'ALLOWED' },
        });
      }
      cookieToken = null;
      return liveResponse(environment.endpoints.gateway, requestPath, {
        data: {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          identityPlane: 'TENANT',
          personPublicId: tenant.personPublicId,
        },
      });
    },
  };
  const requestApi = { newContext: async () => context };

  const session = await createLiveSession(requestApi, environment, tenant);
  await mutationJson(session, 'POST', '/api/auth/product-surface-access/evaluate', {
    subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey: 'hcm.operations' },
    routeContractKey: 'route.hcm.operations.overview.page',
  });

  assert.deepEqual(
    calls.map(({ requestPath, options }) => [requestPath, options.method]),
    [
      ['/api/auth/csrf', 'GET'],
      ['/api/auth/login', 'POST'],
      ['/api/auth/me', 'GET'],
      ['/api/auth/csrf', 'GET'],
      ['/api/auth/product-surface-access/evaluate', 'POST'],
    ]
  );
  assert.equal(session.csrf.token, 'csrf-token-after-authenticated-me');
  await session.context.dispose();
});

test('live session rejects a short post-authentication CSRF token before returning', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const tenant = environment.tenants[0];
  let csrfRequests = 0;
  let subjectRequested = false;
  let cookieToken = null;
  const context = {
    dispose: async () => {},
    storageState: async () => csrfStorageState(environment.endpoints.gateway, cookieToken),
    fetch: async (requestPath) => {
      if (requestPath === '/api/auth/csrf') {
        csrfRequests += 1;
        cookieToken = csrfRequests === 1 ? 'csrf-token-for-login' : 'short';
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: {
            headerName: 'X-XSRF-TOKEN',
            token: cookieToken,
          },
        });
      }
      if (requestPath === '/api/auth/login') {
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: { tenantId: String(tenant.tenantId), userId: String(tenant.userId) },
        });
      }
      if (requestPath === '/api/auth/me') {
        subjectRequested = true;
        cookieToken = null;
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: {
            tenantId: tenant.tenantId,
            userId: tenant.userId,
            identityPlane: 'TENANT',
            personPublicId: tenant.personPublicId,
          },
        });
      }
      throw new Error(`Unexpected short-CSRF fixture request: ${requestPath}`);
    },
  };

  await assert.rejects(
    () => createLiveSession({ newContext: async () => context }, environment, tenant),
    (error) => error instanceof CheckpointHold && /CSRF token is too short/u.test(error.message)
  );
  assert.equal(subjectRequested, true);
});

test('mutation refreshes a stale CSRF binding before dispatch and never sends the stale header', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const calls = [];
  let cookieToken = 'current-cookie-token-123456';
  const session = {
    gatewayURL: environment.endpoints.gateway,
    tenant: environment.tenants[0],
    label: 'tenant-a',
    csrf: { headerName: 'X-XSRF-TOKEN', token: 'stale-cached-token-123456' },
    context: {
      storageState: async () => csrfStorageState(environment.endpoints.gateway, cookieToken),
      fetch: async (requestPath, options) => {
        calls.push({ requestPath, options });
        if (requestPath === '/api/auth/csrf') {
          cookieToken = 'refreshed-bound-token-123456';
          return liveResponse(environment.endpoints.gateway, requestPath, {
            data: { headerName: 'X-XSRF-TOKEN', token: cookieToken },
          });
        }
        assert.equal(options.headers['X-XSRF-TOKEN'], cookieToken);
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: { decision: 'ROUTE_DENIED' },
        });
      },
    },
  };

  await mutationJson(session, 'POST', '/api/auth/product-surface-access/evaluate', {
    subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey: 'hcm.operations' },
    routeContractKey: 'route.hcm.operations.payroll-foundation-configurations.data',
  });

  assert.deepEqual(
    calls.map(({ requestPath }) => requestPath),
    ['/api/auth/csrf', '/api/auth/product-surface-access/evaluate']
  );
  assert.equal(session.csrf.token, cookieToken);
});

test('mutation fails closed before dispatch when the CSRF cookie binding stays unavailable', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const calls = [];
  const session = {
    gatewayURL: environment.endpoints.gateway,
    tenant: environment.tenants[0],
    label: 'tenant-a',
    csrf: { headerName: 'X-XSRF-TOKEN', token: 'stale-cached-token-123456' },
    context: {
      storageState: async () => csrfStorageState(environment.endpoints.gateway, null),
      fetch: async (requestPath) => {
        calls.push(requestPath);
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: { headerName: 'X-XSRF-TOKEN', token: 'refreshed-body-token-123456' },
        });
      },
    },
  };

  await assert.rejects(
    () =>
      mutationJson(session, 'POST', '/api/auth/product-surface-access/evaluate', {
        routeContractKey: 'route.hcm.operations.people.page',
      }),
    /binding failed after one pre-dispatch refresh \(applicableCookieCount=0\)/u
  );
  assert.deepEqual(calls, ['/api/auth/csrf']);
});

test('mutation rejects ambiguous applicable CSRF cookies without a refresh or target request', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const token = 'duplicate-cookie-token-123456';
  let fetchCount = 0;
  const session = {
    gatewayURL: environment.endpoints.gateway,
    tenant: environment.tenants[0],
    label: 'tenant-a',
    csrf: { headerName: 'X-XSRF-TOKEN', token },
    context: {
      storageState: async () => ({
        cookies: [
          csrfCookie(environment.endpoints.gateway, token),
          csrfCookie(environment.endpoints.gateway, token, {
            path: '/api/auth/product-surface-access/evaluate/',
          }),
        ],
        origins: [],
      }),
      fetch: async () => {
        fetchCount += 1;
        throw new Error('An ambiguous CSRF binding must not reach the network');
      },
    },
  };

  await assert.rejects(
    () => mutationJson(session, 'POST', '/api/auth/product-surface-access/evaluate', {}),
    /binding is ambiguous \(applicableCookieCount=2\)/u
  );
  assert.equal(fetchCount, 0);
});

test('CSRF binding ignores cookies that cannot apply to the exact Gateway request', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const token = 'exact-applicable-token-123456';
  const target = '/api/auth/product-surface-access/evaluate';
  let targetRequests = 0;
  const session = {
    gatewayURL: environment.endpoints.gateway,
    tenant: environment.tenants[0],
    label: 'tenant-a',
    csrf: { headerName: 'X-XSRF-TOKEN', token },
    context: {
      storageState: async () => ({
        cookies: [
          csrfCookie(environment.endpoints.gateway, 'wrong-domain-token-123456', {
            domain: 'localhost',
          }),
          csrfCookie(environment.endpoints.gateway, 'wrong-path-token-123456', {
            path: '/api/authz',
          }),
          csrfCookie(environment.endpoints.gateway, 'secure-token-123456', { secure: true }),
          csrfCookie(environment.endpoints.gateway, 'expired-token-123456', { expires: 1 }),
          csrfCookie(environment.endpoints.gateway, token),
        ],
        origins: [],
      }),
      fetch: async (requestPath, options) => {
        assert.equal(requestPath, target);
        assert.equal(options.headers['X-XSRF-TOKEN'], token);
        targetRequests += 1;
        return liveResponse(environment.endpoints.gateway, requestPath, { data: {} });
      },
    },
  };

  await mutationJson(session, 'POST', target, {});
  assert.equal(targetRequests, 1);
});

test('non-JSON live failures expose bounded metadata without response or token contents', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const token = 'diagnostic-csrf-token-123456';
  const secretBody = Buffer.from(`forbidden ${token}`, 'utf8');
  const session = {
    gatewayURL: environment.endpoints.gateway,
    tenant: environment.tenants[1],
    label: 'tenant-b',
    csrf: { headerName: 'X-XSRF-TOKEN', token },
    context: {
      storageState: async () => csrfStorageState(environment.endpoints.gateway, token),
      fetch: async (requestPath) => ({
        body: async () => secretBody,
        headers: () => ({ 'content-type': 'text/plain' }),
        status: () => 403,
        url: () => new URL(requestPath, environment.endpoints.gateway).toString(),
      }),
    },
  };

  await assert.rejects(
    () => mutationJson(session, 'POST', '/api/auth/product-surface-access/evaluate', {}),
    (error) => {
      assert.equal(error instanceof CheckpointHold, true);
      assert.match(error.message, /tenant-b POST .*HTTP 403/u);
      assert.match(error.message, new RegExp(`bodyByteCount=${secretBody.byteLength}`, 'u'));
      assert.match(error.message, /bodySha256=[0-9a-f]{64}/u);
      assert.doesNotMatch(error.message, /forbidden/u);
      assert.doesNotMatch(error.message, new RegExp(token, 'u'));
      return true;
    }
  );
});
