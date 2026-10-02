import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  CheckpointHold,
  canonicalJson,
  expectedNegativeContracts,
  expectedPeoplePolicyRevision,
  parseCheckpointEnvironment,
  uuidV5Url,
} from './hris-w1-checkpoint-core.mjs';
import {
  validateNegativeObservations,
  validateRuntimeManifest,
} from './hris-w1-checkpoint-runtime.mjs';
import { assertSameContextBinding, buildRouteMatrices } from './hris-w1-checkpoint-live.mjs';
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
    [`DWP_W1_TENANT_${lane}_TARGET_POPULATION_REVISION`]: prefix.repeat(32),
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
  return {
    routeContractKey,
    contextKey: `psc-${'1'.repeat(64)}`,
    scopeKey: `hcm-scope-${suffix.repeat(40)}`,
    decision,
    decisionRevision: `psr-${suffix.repeat(64)}`,
    revalidateAt: '2026-10-02T01:00:00.000Z',
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

test('context binding requires both contextKey and contextScopeKey equality', () => {
  const left = {
    contextKey: `psc-${'1'.repeat(64)}`,
    contextScopeKey: `hcm-scope-${'2'.repeat(40)}`,
  };
  const right = structuredClone(left);
  assert.equal(assertSameContextBinding('PAY', left, right).equal, true);
  assert.throws(
    () => assertSameContextBinding('PAY', left, { ...right, contextKey: `psc-${'3'.repeat(64)}` }),
    /contextKey and contextScopeKey/u
  );
  assert.throws(
    () =>
      assertSameContextBinding('PAY', left, {
        ...right,
        contextScopeKey: `hcm-scope-${'4'.repeat(40)}`,
      }),
    /contextKey and contextScopeKey/u
  );
});

test('People policy revision is derived from the exact target population revision', () => {
  const revision = 'a'.repeat(32);
  const expected = createHash('sha256')
    .update(Buffer.concat([Buffer.from('policy'), Buffer.from([0]), Buffer.from(revision)]))
    .digest('hex');
  assert.equal(expectedPeoplePolicyRevision(revision), `policy-${expected}`);
  assert.notEqual(
    expectedPeoplePolicyRevision(revision),
    expectedPeoplePolicyRevision('b'.repeat(32))
  );
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
