import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  CheckpointHold,
  canonicalJson,
  expectedNegativeContracts,
  expectedPeopleEffectivePolicyRevision,
  expectedPeoplePolicyRevision,
  parseCheckpointEnvironment,
  uuidV5Url,
} from './hris-w1-checkpoint-core.mjs';
import {
  validateNegativeObservations,
  validateRuntimeManifest,
} from './hris-w1-checkpoint-runtime.mjs';
import {
  assertSameScopeBinding,
  buildRouteMatrices,
  createLiveSession,
  evaluateExact,
  mutationJson,
  runTimeOwnerRead,
} from './hris-w1-checkpoint-live.mjs';
import { generalOwnerApiObservations } from './hris-w1-checkpoint-evidence.mjs';
import {
  selectBrowserPayrollResponse,
  validateBrowserManifest,
} from './hris-w1-checkpoint-browser-evidence.mjs';

const RUN_ID = 'w1-20261002t000000z-deadbeef';
const EVIDENCE_DIR = '/tmp/hris-w1-checkpoint-unit';

function uuid(prefix, suffix) {
  return `${prefix}0000000-0000-4000-8000-${suffix.toString().padStart(12, '0')}`;
}

function tenantEnvironment(lane, prefix, numericOffset) {
  return {
    [`DWP_W1_TENANT_${lane}_PROVIDER_TENANT_ID`]: uuid(prefix, 1),
    [`DWP_W1_TENANT_${lane}_ID`]: String(1000 + numericOffset),
    [`DWP_W1_TENANT_${lane}_USER_ID`]: String(2000 + numericOffset),
    [`DWP_W1_TENANT_${lane}_PERSON_PUBLIC_ID`]: uuid(prefix, 2),
    [`DWP_W1_TENANT_${lane}_WORKER_PUBLIC_ID`]: uuid(prefix, 3),
    [`DWP_W1_TENANT_${lane}_ASSIGNMENT_PUBLIC_ID`]: uuid(prefix, 4),
    [`DWP_W1_TENANT_${lane}_ACTOR_LEGAL_EMPLOYER_PUBLIC_ID`]: uuid(prefix, 5),
    [`DWP_W1_TENANT_${lane}_TARGET_PERSON_PUBLIC_ID`]: uuid(prefix, 6),
    [`DWP_W1_TENANT_${lane}_TARGET_WORKER_PUBLIC_ID`]: uuid(prefix, 7),
    [`DWP_W1_TENANT_${lane}_TARGET_ASSIGNMENT_PUBLIC_ID`]: uuid(prefix, 8),
    [`DWP_W1_TENANT_${lane}_TARGET_POPULATION_REVISION`]: `${prefix.repeat(32)}:true|[]|[DIRECTORY, EMPLOYMENT, WORKER_IDENTIFIERS]|READ`,
    [`DWP_W1_TENANT_${lane}_TARGET_POPULATION_COUNT`]: '1',
    [`DWP_W1_TENANT_${lane}_KEY`]: `synthetic-${lane.toLowerCase()}`,
    [`DWP_W1_TENANT_${lane}_EMAIL`]: `admin-${lane.toLowerCase()}@dwp.test`,
    [`DWP_W1_TENANT_${lane}_PASSWORD`]: `synthetic-password-${lane}-only`,
  };
}

function validEnvironment() {
  return {
    DWP_W1_RUN_ID: RUN_ID,
    DWP_W1_EVIDENCE_DIR: EVIDENCE_DIR,
    DWP_W1_CHECKPOINT_MANIFEST: `${EVIDENCE_DIR}/checkpoint/manifest.json`,
    DWP_W1_ACTIVE_BUNDLE_VERSION: '33',
    DWP_W1_ACTIVE_BUNDLE_REVISION: '2',
    DWP_W1_AUTH_URL: 'http://127.0.0.1:21001',
    DWP_W1_PLATFORM_URL: 'http://127.0.0.1:21002',
    DWP_W1_PEOPLE_URL: 'http://127.0.0.1:21003',
    DWP_W1_PROVIDER_URL: 'http://127.0.0.1:21004',
    DWP_W1_PAYROLL_URL: 'http://127.0.0.1:21005',
    DWP_W1_TIME_URL: 'http://127.0.0.1:21006',
    DWP_W1_GATEWAY_URL: 'http://127.0.0.1:21007',
    ...tenantEnvironment('A', '1', 1),
    ...tenantEnvironment('B', '2', 2),
  };
}

function liveResponse(gatewayURL, requestPath, root, status = 200) {
  const bytes = Buffer.from(JSON.stringify(root), 'utf8');
  return {
    body: async () => bytes,
    headers: () => ({ 'content-type': 'application/json' }),
    status: () => status,
    url: () => new URL(requestPath, gatewayURL).toString(),
  };
}

function timeOwnerFixture(studio, status = 200) {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const manifest = validRuntime(environment);
  const runtimeAuthority = manifest.projectionFeed.gatewayAuthorities.A.time;
  const timeProjection = manifest.projectionFeed.time.A;
  const calls = [];
  const context = {
    fetch: async (requestPath, options) => {
      calls.push({ requestPath, options });
      if (requestPath === '/api/auth/product-surface-access/evaluate') {
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: {
            decision: runtimeAuthority.decision,
            decisionRevision: runtimeAuthority.decisionRevision,
            context: { contextKey: runtimeAuthority.contextKey },
            scope: { key: runtimeAuthority.scopeKey },
            revalidateAt: runtimeAuthority.revalidateAt,
          },
        });
      }
      if (requestPath.startsWith('/api/time/v1/hris/work-plans?')) {
        return liveResponse(environment.endpoints.gateway, requestPath, { data: studio }, status);
      }
      throw new Error(`Unexpected TIME owner fixture request: ${requestPath}`);
    },
  };
  const session = {
    context,
    gatewayURL: environment.endpoints.gateway,
    tenant: environment.tenants[0],
    label: 'tenant-a',
    csrf: { headerName: 'X-XSRF-TOKEN', token: 'checkpoint-time-csrf-token' },
  };
  return { calls, runtimeAuthority, session, timeProjection };
}

function checkpointClock(requestStartedAt, observedAt) {
  const instants = [requestStartedAt, observedAt].map((value) => new Date(value));
  return () => instants.shift();
}

test('live session obtains CSRF before posting credentials', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const tenant = environment.tenants[0];
  const calls = [];
  let csrfRequests = 0;
  const context = {
    dispose: async () => {},
    fetch: async (requestPath, options) => {
      calls.push({ requestPath, options });
      if (requestPath === '/api/auth/csrf') {
        csrfRequests += 1;
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: {
            headerName: 'X-XSRF-TOKEN',
            token: csrfRequests === 1 ? 'csrf-token-for-login' : 'csrf-token-after-login',
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
        assert.equal(options.headers['X-XSRF-TOKEN'], 'csrf-token-after-login');
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: { decision: 'ALLOWED' },
        });
      }
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
      ['/api/auth/csrf', 'GET'],
      ['/api/auth/me', 'GET'],
      ['/api/auth/product-surface-access/evaluate', 'POST'],
    ]
  );
  assert.equal(session.csrf.token, 'csrf-token-after-login');
  await session.context.dispose();
});

test('live session rejects a short authenticated CSRF token before reading the subject', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const tenant = environment.tenants[0];
  let csrfRequests = 0;
  let subjectRequested = false;
  const context = {
    dispose: async () => {},
    fetch: async (requestPath) => {
      if (requestPath === '/api/auth/csrf') {
        csrfRequests += 1;
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: {
            headerName: 'X-XSRF-TOKEN',
            token: csrfRequests === 1 ? 'csrf-token-for-login' : 'short',
          },
        });
      }
      if (requestPath === '/api/auth/login') {
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: { tenantId: String(tenant.tenantId), userId: String(tenant.userId) },
        });
      }
      subjectRequested = true;
      return liveResponse(environment.endpoints.gateway, requestPath, { data: {} });
    },
  };

  await assert.rejects(
    () => createLiveSession({ newContext: async () => context }, environment, tenant),
    (error) => error instanceof CheckpointHold && /CSRF token is too short/u.test(error.message)
  );
  assert.equal(subjectRequested, false);
});

test('exact evaluation fallback rejects a scope selection ignored by the Gateway', async () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const selectedScopeKey = `hcm-scope-${'4'.repeat(40)}`;
  const returnedScopeKey = `hcm-scope-${'5'.repeat(40)}`;
  const calls = [];
  const session = {
    gatewayURL: environment.endpoints.gateway,
    tenant: environment.tenants[0],
    label: 'tenant-a',
    csrf: { headerName: 'X-XSRF-TOKEN', token: 'checkpoint-evaluate-csrf-token' },
    contexts: null,
    context: {
      fetch: async (requestPath, options) => {
        calls.push({ requestPath, options });
        if (requestPath === '/api/auth/product-surface-contexts') {
          return liveResponse(environment.endpoints.gateway, requestPath, {
            data: {
              contexts: [
                {
                  productKey: 'hcm',
                  surfaceKey: 'hcm.operations',
                  contextKey: `psc-${'4'.repeat(64)}`,
                  scopes: [{ key: selectedScopeKey, isDefault: true }],
                },
              ],
              rollouts: [],
            },
          });
        }
        if (options.data.contextScopeKey === undefined) {
          return liveResponse(environment.endpoints.gateway, requestPath, {
            data: { decision: 'SURFACE_DENIED' },
          });
        }
        return liveResponse(environment.endpoints.gateway, requestPath, {
          data: {
            decision: 'ALLOWED',
            decisionRevision: `psr-${'4'.repeat(64)}`,
            context: { contextKey: `psc-${'6'.repeat(64)}` },
            scope: { key: returnedScopeKey },
            revalidateAt: '2026-10-02T01:00:00.000Z',
          },
        });
      },
    },
  };

  await assert.rejects(
    () =>
      evaluateExact(
        session,
        'hcm.operations',
        'route.hcm.operations.work-plans-list.data',
        'ALLOWED'
      ),
    /returned a different scope than selected/u
  );
  assert.equal(calls.at(-1).options.data.contextScopeKey, selectedScopeKey);
  assert.equal(calls.at(-1).options.data.contextKey, undefined);
});

test('TIME owner read re-evaluates authority before the exact scoped Gateway GET', async () => {
  const studio = {
    queryState: 'EMPTY',
    freshness: 'CURRENT',
    asOf: '2026-10-02T00:00:00.050Z',
    partialFailures: [],
    workPlans: [],
  };
  const fixture = timeOwnerFixture(studio);

  const observed = await runTimeOwnerRead(
    fixture.session,
    fixture.runtimeAuthority,
    fixture.timeProjection,
    checkpointClock('2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.100Z')
  );

  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.calls[0].requestPath, '/api/auth/product-surface-access/evaluate');
  assert.deepEqual(fixture.calls[0].options.data, {
    subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey: 'hcm.operations' },
    routeContractKey: 'route.hcm.operations.work-plans-list.data',
  });
  assert.equal(
    fixture.calls[1].requestPath,
    `/api/time/v1/hris/work-plans?effectiveOn=2026-10-02&contextScopeKey=${fixture.runtimeAuthority.scopeKey}`
  );
  assert.equal(fixture.calls[1].options.method, 'GET');
  assert.deepEqual(observed.request, {
    method: 'GET',
    path: '/api/time/v1/hris/work-plans',
    effectiveOn: '2026-10-02',
    contextScopeKey: fixture.runtimeAuthority.scopeKey,
  });
  assert.deepEqual(observed.outcome, studio);
  assert.equal(observed.requestStartedAt, '2026-10-02T00:00:00.000Z');
  assert.equal(observed.observedAt, '2026-10-02T00:00:00.100Z');
  assert.equal(observed.authority.response.status, 200);
  assert.equal(observed.response.status, 200);
});

test('TIME owner read fails closed on authority drift or any non-safe owner outcome', async () => {
  const safeStudio = {
    queryState: 'EMPTY',
    freshness: 'CURRENT',
    asOf: '2026-10-02T00:00:00.050Z',
    partialFailures: [],
    workPlans: [],
  };
  const drifted = timeOwnerFixture(safeStudio);
  await assert.rejects(
    () =>
      runTimeOwnerRead(
        drifted.session,
        drifted.runtimeAuthority,
        { ...drifted.timeProjection, scopeKey: `hcm-scope-${'9'.repeat(40)}` },
        checkpointClock('2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.100Z')
      ),
    /does not match the attested owner projection/u
  );
  const staleAuthority = timeOwnerFixture(safeStudio);
  await assert.rejects(
    () =>
      runTimeOwnerRead(
        staleAuthority.session,
        staleAuthority.runtimeAuthority,
        staleAuthority.timeProjection,
        checkpointClock('2026-10-02T00:59:59.900Z', '2026-10-02T01:00:00.000Z')
      ),
    /authority is already stale/u
  );

  const unsafeCases = [
    [{ ...safeStudio, queryState: 'COMPLETE' }, 200, /exact safe EMPTY\/CURRENT/u],
    [{ ...safeStudio, freshness: 'STALE' }, 200, /exact safe EMPTY\/CURRENT/u],
    [
      { ...safeStudio, partialFailures: ['TARGET_POPULATION_PLAN_UNAVAILABLE'] },
      200,
      /exact safe EMPTY\/CURRENT/u,
    ],
    [
      { ...safeStudio, workPlans: [{ workPlanId: uuid('9', 1) }] },
      200,
      /exact safe EMPTY\/CURRENT/u,
    ],
    [{ ...safeStudio, extra: true }, 200, /unexpected field set/u],
    [
      { ...safeStudio, asOf: '2026-10-01T23:59:59.999Z' },
      200,
      /outside the observed request window/u,
    ],
    [
      { ...safeStudio, asOf: '2026-10-02T00:00:00.101Z' },
      200,
      /outside the observed request window/u,
    ],
    [safeStudio, 503, /did not return HTTP 200/u],
  ];
  for (const [studio, status, expected] of unsafeCases) {
    const fixture = timeOwnerFixture(studio, status);
    await assert.rejects(
      () =>
        runTimeOwnerRead(
          fixture.session,
          fixture.runtimeAuthority,
          fixture.timeProjection,
          checkpointClock('2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.100Z')
        ),
      expected
    );
  }
});

test('general owner API evidence includes the exact TIME owner observation', () => {
  const timeOwnerRead = {
    source: 'LIVE_GATEWAY_TIME_OWNER',
    request: {
      method: 'GET',
      path: '/api/time/v1/hris/work-plans',
      effectiveOn: '2026-10-02',
      contextScopeKey: `hcm-scope-${'2'.repeat(40)}`,
    },
    projection: {
      scopeKey: `hcm-scope-${'2'.repeat(40)}`,
      populationPublicId: uuid('2', 1),
    },
  };
  const observations = generalOwnerApiObservations({
    sessionA: { authentication: { source: 'LIVE_GATEWAY_AUTH' } },
    contracts: { payrollPage: {}, payrollRead: {}, payrollUpdate: {} },
    ownerChain: { contextBinding: {}, initial: {}, final: {} },
    timeOwnerRead,
  });

  assert.strictEqual(observations[3], timeOwnerRead);
  assert.deepEqual(
    observations.filter((observation) => observation.source === 'LIVE_GATEWAY_TIME_OWNER'),
    [timeOwnerRead]
  );
});

function sha256Canonical(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function negativePath(assertionName) {
  const state = assertionName.includes('.stale-')
    ? 'stale'
    : assertionName.includes('.expired-')
      ? 'expired'
      : 'revoked';
  const id = uuidV5Url(`dwp:${RUN_ID}:negative:${state}`);
  if (state === 'stale') {
    return `/api/payroll/v1/hris/payroll/foundation/configurations/${id}`;
  }
  if (state === 'expired') {
    return `/api/payroll/v1/hris/payroll/foundation/configurations/${id}/versions`;
  }
  return `/api/payroll/v1/hris/payroll/foundation/receipts/${id}`;
}

function negativeObservation(assertionName, evidenceState, tenant) {
  const contract = expectedNegativeContracts(RUN_ID)[assertionName];
  const database = {
    STALE: {
      databaseTransition: 'BUILDING->ACTIVE->SUPERSEDED',
      databaseStatus: 'SUPERSEDED',
    },
    EXPIRED: { databaseTransition: 'BUILDING->ACTIVE', databaseStatus: 'ACTIVE' },
    REVOKED: {
      databaseTransition: 'BUILDING->ACTIVE->REVOKED',
      databaseStatus: 'REVOKED',
    },
  }[evidenceState];
  const projectionMaterial = {
    tenantId: tenant.tenantId,
    actorId: tenant.userId,
    evidenceState,
    projectionId: contract.projectionId,
    projectionRevision: 'c'.repeat(64),
    contextScopeKey: `hcm-scope-${'1'.repeat(40)}`,
    policyRevision: `rollout-${'1'.repeat(64)}`,
    authorizationRevision: `psr-${'1'.repeat(64)}`,
    databaseTransition: database.databaseTransition,
    databaseStatus: database.databaseStatus,
    databaseValidity: 'EXPIRED',
    databaseMemberCount: 1,
  };
  const material = {
    assertionName,
    source: 'LIVE_GATEWAY_OWNER_REQUEST',
    method: 'GET',
    path: negativePath(assertionName),
    tenantId: tenant.tenantId,
    actorId: tenant.userId,
    evidenceState,
    ...projectionMaterial,
    projectionObservationSha256: sha256Canonical(projectionMaterial),
    status: 503,
    errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
    ownerErrorMessage: 'No current Payroll-owned legal-entity membership matches the authority.',
    observedAt: '2026-10-02T00:00:00.000Z',
    responseBodySha256: 'a'.repeat(64),
  };
  return { ...material, observationSha256: sha256Canonical(material) };
}

function negativeFeed(tenant) {
  const observations = [
    negativeObservation('negative.stale-evidence-denied', 'STALE', tenant),
    negativeObservation('negative.expired-evidence-denied', 'EXPIRED', tenant),
    negativeObservation('negative.revoked-evidence-denied', 'REVOKED', tenant),
  ];
  return {
    schemaVersion: 1,
    observations,
    aggregateSha256: sha256Canonical(observations),
  };
}

function rehash(feed, index) {
  const material = { ...feed.observations[index] };
  delete material.observationSha256;
  feed.observations[index] = {
    ...material,
    observationSha256: sha256Canonical(material),
  };
  feed.aggregateSha256 = sha256Canonical(feed.observations);
  return feed;
}

function authority(routeContractKey, decision = 'ALLOWED', suffix = '1') {
  const challenge = decision === 'STEP_UP_REQUIRED';
  return {
    routeContractKey,
    contextKey: challenge ? null : `psc-${suffix.repeat(64)}`,
    scopeKey: challenge ? null : `hcm-scope-${suffix.repeat(40)}`,
    decision,
    decisionRevision: `psr-${suffix.repeat(64)}`,
    revalidateAt: '2026-10-02T01:00:00.000Z',
    ...(challenge
      ? {
          reasonCode: 'STEP_UP_REQUIRED',
          requiredAssurance: 'urn:dwp:assurance:high',
        }
      : {}),
  };
}

function validRuntime(environment) {
  const tenantA = environment.tenants[0];
  const tenantB = environment.tenants[1];
  const rolloutA = {
    state: '111',
    cohort: 'full',
    revision: `rollout-${'1'.repeat(64)}`,
    flags: {
      'access.product-surfaces.context-shadow.v1': 'rev-00000000000000000001',
      'access.product-surfaces.capability-enforcement.hcm.v1': 'rev-00000000000000000002',
      'ux.product-surfaces.hcm.v1': 'rev-00000000000000000003',
    },
    receiptSha256: '1'.repeat(64),
  };
  const rolloutB = {
    state: '000',
    cohort: 'baseline',
    revision: `rollout-${'2'.repeat(64)}`,
    flags: {
      'access.product-surfaces.context-shadow.v1': 'rev-00000000000000000004',
      'access.product-surfaces.capability-enforcement.hcm.v1': 'rev-00000000000000000005',
      'ux.product-surfaces.hcm.v1': 'rev-00000000000000000006',
    },
    receiptSha256: '2'.repeat(64),
  };
  const runtimeTenant = (tenant, rollout, state, receipt) => ({
    providerTenantId: tenant.providerTenantId,
    tenantId: tenant.tenantId,
    administratorUserId: tenant.userId,
    personPublicId: tenant.personPublicId,
    workerPublicId: tenant.workerPublicId,
    assignmentPublicId: tenant.assignmentPublicId,
    actorLegalEmployerPublicId: tenant.actorLegalEmployerPublicId,
    targetPersonPublicId: tenant.targetPersonPublicId,
    targetWorkerPublicId: tenant.targetWorkerPublicId,
    targetAssignmentPublicId: tenant.targetAssignmentPublicId,
    targetPopulationRevision: tenant.targetPopulationRevision,
    targetPopulationCount: tenant.targetPopulationCount,
    peopleWorkforceReceiptSha256: receipt.repeat(64),
    authBindingExecution: {
      mode: 'LOCAL_SYNTHETIC_ACTIVATE',
      officialWorkforceEventContractValidated: true,
      officialWorkforceEventExecuted: false,
      gap: 'The official workforce event cannot select the already-provisioned LOCAL administrator; this run binds it only through the run-bound local synthetic activation boundary.',
    },
    tenantKey: tenant.key,
    administratorEmail: tenant.email,
    identityReceiptSha256: receipt.repeat(64),
    hcmState: state,
    rollout,
  });
  const payrollAuthority = authority('route.hcm.operations.payroll-foundation-configurations.data');
  const gatewayAuthorities = {
    A: {
      payroll: payrollAuthority,
      time: authority('route.hcm.operations.work-plans-list.data', 'ALLOWED', '2'),
      page: authority('route.hcm.operations.overview.page'),
      payrollPublish: authority(
        'route.hcm.operations.payroll-foundation-publish.action',
        'STEP_UP_REQUIRED'
      ),
      payrollStale: authority('route.hcm.operations.payroll-foundation-configuration.data'),
      payrollExpired: authority('route.hcm.operations.payroll-foundation-versions.data'),
      payrollRevoked: authority('route.hcm.operations.payroll-foundation-receipt.data'),
    },
    B: {
      payroll: {
        decision: 'APP_DENIED',
        reasonCode: 'APP_DISABLED',
        decisionRevision: `psr-${'3'.repeat(64)}`,
      },
    },
  };
  const negativeObservations = negativeFeed(tenantA);
  const negativeProjectionFields = [
    'tenantId',
    'actorId',
    'evidenceState',
    'projectionId',
    'projectionRevision',
    'contextScopeKey',
    'policyRevision',
    'authorizationRevision',
    'databaseTransition',
    'databaseStatus',
    'databaseValidity',
    'databaseMemberCount',
    'projectionObservationSha256',
  ];
  const negativeProjections = Object.fromEntries(
    negativeObservations.observations.map((observation) => [
      observation.evidenceState,
      Object.fromEntries(negativeProjectionFields.map((key) => [key, observation[key]])),
    ])
  );
  const configurationId = uuid('3', 1);
  const bootstrapCommandId = uuid('3', 2);
  const createCommandId = uuid('3', 3);
  const payrollFoundation = {
    configurationId,
    version: 2,
    lifecycleState: 'SIMULATED',
    dependencyFreshness: 'LIVE',
    authorActorId: 9001,
    browserActorId: tenantA.userId,
    canPublish: true,
    receiptSha256: '4'.repeat(64),
    createCommandId,
    simulateCommandId: bootstrapCommandId,
  };
  const databaseObservationMaterial = {
    schemaVersion: 1,
    phase: 'PREFLIGHT',
    tenantId: tenantA.tenantId,
    configurationId,
    currentVersion: 2,
    lifecycleState: 'SIMULATED',
    legalEntityId: tenantA.actorLegalEmployerPublicId,
    authorId: 9001,
    publisherId: null,
    lastCommandId: bootstrapCommandId,
    fixtureReceiptSha256: payrollFoundation.receiptSha256,
    definitionDigest: '5'.repeat(64),
    dependencyDigest: '6'.repeat(64),
    lastCommandReceipt: {
      commandId: bootstrapCommandId,
      commandType: 'SIMULATE',
      receiptStatus: 'SUCCEEDED',
      resultVersion: 2,
      requestDigest: '7'.repeat(64),
    },
  };
  return {
    schemaVersion: 1,
    runId: RUN_ID,
    syntheticOnly: true,
    secretsPersisted: false,
    activeBundle: environment.activeBundle,
    migrationControl: Object.fromEntries(
      ['people', 'payroll', 'time'].map((service, index) => [
        service,
        {
          receiptSha256: String(index + 7).repeat(64),
          controlReference: `dwp-migration-control-v2:${'8'.repeat(64)}`,
          mode: 'NATIVE_FRESH',
        },
      ])
    ),
    syntheticTenants: {
      A: runtimeTenant(tenantA, rolloutA, '111', 'a'),
      B: runtimeTenant(tenantB, rolloutB, '000', 'b'),
    },
    projectionFeed: {
      rollouts: { A: rolloutA, B: rolloutB },
      gatewayAuthorities,
      negativeObservations,
      negativeObservationProjections: {
        schemaVersion: 1,
        disposable: true,
        restoredPositiveAfterObservations: true,
        projections: negativeProjections,
        aggregateSha256: sha256Canonical(negativeProjections),
      },
      payroll: {
        A: {
          scopeKey: payrollAuthority.scopeKey,
          projectionId: uuidV5Url(`dwp:${RUN_ID}:payroll:A:projection`),
          legalEntityId: tenantA.actorLegalEmployerPublicId,
          status: 'ACTIVE',
          policyRevision: rolloutA.revision,
          authorizationRevision: payrollAuthority.decisionRevision,
        },
      },
      time: {
        A: {
          scopeKey: gatewayAuthorities.A.time.scopeKey,
          populationPublicId: uuidV5Url(`dwp:${RUN_ID}:time:A:population`),
          workerPublicId: tenantA.targetWorkerPublicId,
          peopleAssignmentPublicId: tenantA.targetAssignmentPublicId,
          peopleAssignmentRevision: 1,
          lifecycleState: 'ACTIVE',
          peopleTargetPersonPublicId: tenantA.targetPersonPublicId,
          peopleTargetPopulationRevision: tenantA.targetPopulationRevision,
          populationIdentityKind: 'TIM_PROJECTION_RUN_BOUND',
        },
      },
      payrollAuthority,
      payrollFoundation,
      payrollFoundationDatabaseObservation: {
        ...databaseObservationMaterial,
        observationSha256: sha256Canonical(databaseObservationMaterial),
      },
      runtimeMutationDenied: true,
      publisherForbiddenTableDenied: true,
    },
    endpoints: environment.endpoints,
  };
}

test('checkpoint environment parser accepts only the frozen runner contract', () => {
  const parsed = parseCheckpointEnvironment(validEnvironment());

  assert.equal(parsed.endpoints.gateway, 'http://127.0.0.1:21007');
  assert.equal(parsed.tenants[0].workerPublicId, uuid('1', 3));
  assert.equal(parsed.tenants[0].targetPopulationCount, 1);
  assert.equal(parsed.tenants[1].actorLegalEmployerPublicId, uuid('2', 5));
});

test('checkpoint environment parser fails closed on unknown variables and ambiguous bindings', () => {
  assert.throws(
    () => parseCheckpointEnvironment({ ...validEnvironment(), DWP_W1_UNDECLARED: 'value' }),
    CheckpointHold
  );

  const duplicateEndpoint = validEnvironment();
  duplicateEndpoint.DWP_W1_GATEWAY_URL = duplicateEndpoint.DWP_W1_AUTH_URL;
  assert.throws(() => parseCheckpointEnvironment(duplicateEndpoint), CheckpointHold);

  const actorAsTarget = validEnvironment();
  actorAsTarget.DWP_W1_TENANT_A_TARGET_PERSON_PUBLIC_ID =
    actorAsTarget.DWP_W1_TENANT_A_PERSON_PUBLIC_ID;
  assert.throws(() => parseCheckpointEnvironment(actorAsTarget), CheckpointHold);
});

test('runtime validator closes every backend field and database lineage relation', () => {
  const environment = parseCheckpointEnvironment(validEnvironment());
  const manifest = validRuntime(environment);
  const validated = validateRuntimeManifest(manifest, environment);
  assert.equal(validated.payrollFoundation.version, 2);
  assert.equal(
    validated.payrollFoundationDatabaseObservation.configurationId,
    validated.payrollFoundation.configurationId
  );
  assert.equal(
    validated.timeProjection.workerPublicId,
    environment.tenants[0].targetWorkerPublicId
  );

  const expanded = structuredClone(manifest);
  expanded.projectionFeed.payrollFoundation.untrusted = true;
  assert.throws(() => validateRuntimeManifest(expanded, environment), /unexpected field set/u);

  const wrongProjection = structuredClone(manifest);
  wrongProjection.projectionFeed.negativeObservationProjections.projections.STALE.projectionId =
    uuid('4', 9);
  assert.throws(
    () => validateRuntimeManifest(wrongProjection, environment),
    /run\/authority\/revision\/database-state projection/u
  );
});

test('negative feed accepts only three digest-bound live owner observations', () => {
  const { tenants } = parseCheckpointEnvironment(validEnvironment());
  const feed = negativeFeed(tenants[0]);

  assert.deepEqual(validateNegativeObservations(feed, tenants, RUN_ID), feed);

  const wrongPath = structuredClone(feed);
  wrongPath.observations[0].path = '/api/people/v1/workforce/people';
  assert.throws(
    () => validateNegativeObservations(rehash(wrongPath, 0), tenants, RUN_ID),
    /exact state, projection, authority, and denial/u
  );

  const relabelled = structuredClone(feed);
  relabelled.observations[1].evidenceState = 'REVOKED';
  assert.throws(
    () => validateNegativeObservations(rehash(relabelled, 1), tenants, RUN_ID),
    /exact state, projection, authority, and denial/u
  );

  const tampered = structuredClone(feed);
  tampered.observations[2].responseBodySha256 = 'f'.repeat(64);
  assert.throws(
    () => validateNegativeObservations(tampered, tenants, RUN_ID),
    /observationSha256 does not match/u
  );
});

test('route matrices carry live page scopes and one registered live denial', () => {
  const definitions = {
    HRM: ['route.hcm.operations.people.page', 'scope-hrm'],
    PER: ['route.hcm.personal.talent.page', 'scope-per'],
    PAY: ['route.hcm.personal.pay.page', 'scope-pay'],
    TIM: ['route.hcm.personal.time.page', 'scope-tim'],
    SYS: ['route.hcm.personal.home.page', 'scope-sys'],
  };
  const evaluations = Object.fromEntries(
    Object.entries(definitions).map(([module, [routeContractKey, contextScopeKey]]) => [
      module,
      { routeContractKey, contextScopeKey },
    ])
  );
  const matrices = buildRouteMatrices(
    evaluations,
    { contextScopeKey: 'scope-payroll-owner' },
    {
      id: 'tenant-a-team-denied',
      module: 'SYS',
      pageRouteContractKey: 'route.hcm.team.home.page',
      path: '/hr/team',
      accessState: 'surface-denied',
    }
  );

  assert.equal(matrices.tenantA[0].path, '/hr/operations/people?scope=scope-hrm');
  assert.equal(matrices.tenantA.at(-1).path, '/hr/team');
  assert.deepEqual(matrices.tenantA.at(-1).accessStates, ['surface-denied']);
  assert.equal(matrices.tenantB.length, 5);
});

test('negative UUIDv5 contracts distinguish request targets from database projections', () => {
  const contracts = expectedNegativeContracts(RUN_ID);
  const stale = contracts['negative.stale-evidence-denied'];
  assert.equal(
    stale.path,
    `/api/payroll/v1/hris/payroll/foundation/configurations/${uuidV5Url(
      `dwp:${RUN_ID}:negative:stale`
    )}`
  );
  assert.equal(stale.projectionId, uuidV5Url(`dwp:${RUN_ID}:payroll:negative:stale`));
  assert.notEqual(stale.path.split('/').at(-1), stale.projectionId);
  assert.equal(stale.status, 503);
  assert.equal(stale.errorCode, 'AUTHORITY_RESOLUTION_UNAVAILABLE');
});

test('scope binding permits route-specific context keys but requires one owner scope', () => {
  const left = {
    contextKey: `psc-${'1'.repeat(64)}`,
    contextScopeKey: `hcm-scope-${'2'.repeat(40)}`,
  };
  const right = structuredClone(left);
  assert.equal(assertSameScopeBinding('PAY', left, right).equalScope, true);
  assert.equal(
    assertSameScopeBinding('PAY', left, {
      ...right,
      contextKey: `psc-${'3'.repeat(64)}`,
    }).equalScope,
    true
  );
  assert.throws(
    () =>
      assertSameScopeBinding('PAY', left, {
        ...right,
        contextScopeKey: `hcm-scope-${'4'.repeat(40)}`,
      }),
    /contextScopeKey/u
  );
});

test('People policy revision is derived from the exact target population revision', () => {
  const revision = `${'a'.repeat(32)}:true|[]|[DIRECTORY, EMPLOYMENT, WORKER_IDENTIFIERS]|READ`;
  const expected = createHash('sha256')
    .update(Buffer.concat([Buffer.from('policy'), Buffer.from([0]), Buffer.from(revision)]))
    .digest('hex');
  assert.equal(expectedPeoplePolicyRevision(revision), `policy-${expected}`);
  assert.notEqual(
    expectedPeoplePolicyRevision(revision),
    expectedPeoplePolicyRevision('b'.repeat(32))
  );
  const list = expectedPeopleEffectivePolicyRevision(revision, 41, '2026-10-02', 'LIST');
  const detail = expectedPeopleEffectivePolicyRevision(revision, 41, '2026-10-02', 'DETAIL');
  const expectedList = createHash('sha256')
    .update(
      Buffer.concat([
        Buffer.from('effective-policy'),
        Buffer.from([0]),
        Buffer.from(`policy-${expected}`),
        Buffer.from([0]),
        Buffer.from('people360.compatibility-default.v1'),
        Buffer.from([0]),
        Buffer.from('41'),
        Buffer.from([0]),
        Buffer.from('2026-10-02'),
        Buffer.from([0]),
        Buffer.from('LIST'),
      ])
    )
    .digest('hex');
  assert.equal(list, `effective-policy-${expectedList}`);
  assert.notEqual(list, detail);
  assert.notEqual(list, expectedPeopleEffectivePolicyRevision(revision, 42, '2026-10-02', 'LIST'));
});

test('browser PAY selector requires one digest-bound exact configuration response', () => {
  const configurationId = uuid('3', 1);
  const response = {
    method: 'GET',
    path: '/api/payroll/v1/hris/payroll/foundation/configurations',
    status: 200,
    bodyByteLength: 123,
    responseBodySha256: 'a'.repeat(64),
    payrollConfigurationIds: [configurationId],
    fromServiceWorker: false,
  };
  assert.equal(
    selectBrowserPayrollResponse([response], configurationId).responseBodySha256,
    'a'.repeat(64)
  );
  assert.throws(
    () =>
      selectBrowserPayrollResponse([{ ...response, payrollConfigurationIds: [] }], configurationId),
    /exact payroll configuration/u
  );
  assert.throws(
    () => selectBrowserPayrollResponse([response, response], configurationId),
    /exactly one response/u
  );
});

test('browser v2 manifest validation rejects schema expansion before trusting evidence', () => {
  assert.throws(
    () => validateBrowserManifest({ schemaVersion: 'hris-w1-live-browser/v2', extra: true }, {}),
    /unexpected field set/u
  );
});
