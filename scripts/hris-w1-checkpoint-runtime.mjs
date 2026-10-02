import {
  CONTEXT_KEY,
  DECISION_REVISION,
  NEGATIVE_ASSERTIONS,
  ROLLOUT_FLAG_KEYS,
  SCOPE_KEY,
  SHA256,
  UUID,
  canonicalJson,
  exactKeys,
  expectedNegativeContracts,
  hold,
  instant,
  record,
  safeApiPath,
  sha256Canonical,
  textValue,
  uuidV5Url,
} from './hris-w1-checkpoint-core.mjs';

const GATEWAY_AUTHORITY_SPECS = Object.freeze({
  payroll: ['route.hcm.operations.payroll-foundation-configurations.data', 'ALLOWED'],
  time: ['route.hcm.operations.work-plans-list.data', 'ALLOWED'],
  page: ['route.hcm.operations.overview.page', 'ALLOWED'],
  payrollPublish: ['route.hcm.operations.payroll-foundation-publish.action', 'STEP_UP_REQUIRED'],
  payrollStale: ['route.hcm.operations.payroll-foundation-configuration.data', 'ALLOWED'],
  payrollExpired: ['route.hcm.operations.payroll-foundation-versions.data', 'ALLOWED'],
  payrollRevoked: ['route.hcm.operations.payroll-foundation-receipt.data', 'ALLOWED'],
});

function exactRuntimeTenant(value, tenant, location) {
  const runtimeTenant = record(value, location);
  exactKeys(
    runtimeTenant,
    [
      'providerTenantId',
      'tenantId',
      'administratorUserId',
      'personPublicId',
      'workerPublicId',
      'assignmentPublicId',
      'actorLegalEmployerPublicId',
      'targetPersonPublicId',
      'targetWorkerPublicId',
      'targetAssignmentPublicId',
      'targetPopulationRevision',
      'targetPopulationCount',
      'peopleWorkforceReceiptSha256',
      'authBindingExecution',
      'tenantKey',
      'administratorEmail',
      'identityReceiptSha256',
      'hcmState',
      'rollout',
    ],
    location
  );
  const expected = {
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
    tenantKey: tenant.key,
    administratorEmail: tenant.email,
    hcmState: tenant.lane === 'A' ? '111' : '000',
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (runtimeTenant[key] !== expectedValue) {
      hold(`${location}.${key} does not match checkpoint input.`);
    }
  }
  for (const receipt of ['peopleWorkforceReceiptSha256', 'identityReceiptSha256']) {
    if (!SHA256.test(runtimeTenant[receipt])) hold(`${location}.${receipt} is invalid.`);
  }
  const authBinding = record(
    runtimeTenant.authBindingExecution,
    `${location}.authBindingExecution`
  );
  exactKeys(
    authBinding,
    ['mode', 'officialWorkforceEventContractValidated', 'officialWorkforceEventExecuted', 'gap'],
    `${location}.authBindingExecution`
  );
  if (
    authBinding.mode !== 'LOCAL_SYNTHETIC_ACTIVATE' ||
    authBinding.officialWorkforceEventContractValidated !== true ||
    authBinding.officialWorkforceEventExecuted !== false ||
    authBinding.gap !==
      'The official workforce event cannot select the already-provisioned LOCAL administrator; this run binds it only through the run-bound local synthetic activation boundary.'
  ) {
    hold(`${location}.authBindingExecution is not the honest local activation gap record.`);
  }
  return runtimeTenant;
}

function validateMigrationControl(value) {
  const migrationControl = record(value, 'runtime.json.migrationControl');
  exactKeys(migrationControl, ['payroll', 'people', 'time'], 'runtime.json.migrationControl');
  const references = [];
  for (const service of ['payroll', 'people', 'time']) {
    const receipt = record(migrationControl[service], `migrationControl.${service}`);
    exactKeys(
      receipt,
      ['receiptSha256', 'controlReference', 'mode'],
      `migrationControl.${service}`
    );
    if (
      !SHA256.test(String(receipt.receiptSha256 ?? '')) ||
      !/^dwp-migration-control-v2:[0-9a-f]{64}$/u.test(String(receipt.controlReference ?? '')) ||
      receipt.mode !== 'NATIVE_FRESH'
    ) {
      hold(`migrationControl.${service} is not an exact native fresh control receipt.`);
    }
    references.push(receipt.controlReference);
  }
  if (new Set(references).size !== 1) {
    hold('All migration-control receipts must share one attested control reference.');
  }
  return migrationControl;
}

function validateRollouts(value, runtimeTenants) {
  const rollouts = record(value, 'runtime.json.projectionFeed.rollouts');
  exactKeys(rollouts, ['A', 'B'], 'runtime.json.projectionFeed.rollouts');
  for (const [index, lane, state, cohort] of [
    [0, 'A', '111', 'full'],
    [1, 'B', '000', 'baseline'],
  ]) {
    const rollout = record(rollouts[lane], `projectionFeed.rollouts.${lane}`);
    exactKeys(
      rollout,
      ['state', 'cohort', 'revision', 'flags', 'receiptSha256'],
      `projectionFeed.rollouts.${lane}`
    );
    const flags = record(rollout.flags, `projectionFeed.rollouts.${lane}.flags`);
    exactKeys(flags, ROLLOUT_FLAG_KEYS, `projectionFeed.rollouts.${lane}.flags`);
    if (
      rollout.state !== state ||
      rollout.cohort !== cohort ||
      !/^rollout-[0-9a-f]{64}$/u.test(String(rollout.revision ?? '')) ||
      !SHA256.test(String(rollout.receiptSha256 ?? '')) ||
      ROLLOUT_FLAG_KEYS.some(
        (key) => !/^rev-[0-9]{20}$/u.test(textValue(flags[key], `${lane}.${key}`, 240))
      ) ||
      canonicalJson(runtimeTenants[index].rollout) !== canonicalJson(rollout)
    ) {
      hold(`projectionFeed.rollouts.${lane} is not the exact trusted rollout.`);
    }
  }
  return rollouts;
}

function validateGatewayAuthorities(value) {
  const authorities = record(value, 'projectionFeed.gatewayAuthorities');
  exactKeys(authorities, ['A', 'B'], 'projectionFeed.gatewayAuthorities');
  const tenantA = record(authorities.A, 'projectionFeed.gatewayAuthorities.A');
  exactKeys(tenantA, Object.keys(GATEWAY_AUTHORITY_SPECS), 'projectionFeed.gatewayAuthorities.A');
  for (const [key, [routeContractKey, decision]] of Object.entries(GATEWAY_AUTHORITY_SPECS)) {
    const authority = record(tenantA[key], `gatewayAuthorities.A.${key}`);
    const challenge = decision === 'STEP_UP_REQUIRED';
    exactKeys(
      authority,
      [
        'routeContractKey',
        'contextKey',
        'scopeKey',
        'decision',
        'decisionRevision',
        'revalidateAt',
        ...(challenge ? ['reasonCode', 'requiredAssurance'] : []),
      ],
      `gatewayAuthorities.A.${key}`
    );
    if (
      authority.routeContractKey !== routeContractKey ||
      authority.decision !== decision ||
      (challenge
        ? authority.contextKey !== null ||
          authority.scopeKey !== null ||
          authority.reasonCode !== 'STEP_UP_REQUIRED' ||
          authority.requiredAssurance !== 'urn:dwp:assurance:high'
        : !CONTEXT_KEY.test(String(authority.contextKey ?? '')) ||
          !SCOPE_KEY.test(String(authority.scopeKey ?? ''))) ||
      !DECISION_REVISION.test(String(authority.decisionRevision ?? ''))
    ) {
      hold(`gatewayAuthorities.A.${key} is not the exact backend authority.`);
    }
    instant(authority.revalidateAt, `gatewayAuthorities.A.${key}.revalidateAt`);
  }
  for (const key of ['payroll', 'page', 'payrollStale', 'payrollExpired', 'payrollRevoked']) {
    if (tenantA[key].scopeKey !== tenantA.payroll.scopeKey) {
      hold(`gatewayAuthorities.A.${key}.scopeKey drifted from payroll scope.`);
    }
  }
  const tenantB = record(authorities.B, 'projectionFeed.gatewayAuthorities.B');
  exactKeys(tenantB, ['payroll'], 'projectionFeed.gatewayAuthorities.B');
  const denied = record(tenantB.payroll, 'projectionFeed.gatewayAuthorities.B.payroll');
  exactKeys(denied, ['decision', 'reasonCode', 'decisionRevision'], 'gatewayAuthorities.B.payroll');
  if (
    !['APP_DENIED', 'SURFACE_DENIED', 'ROUTE_DENIED'].includes(denied.decision) ||
    typeof denied.reasonCode !== 'string' ||
    !denied.reasonCode ||
    !DECISION_REVISION.test(String(denied.decisionRevision ?? ''))
  ) {
    hold('gatewayAuthorities.B.payroll is not the exact feature-off denial.');
  }
  return authorities;
}

const NEGATIVE_DATABASE_EXPECTATIONS = Object.freeze({
  STALE: Object.freeze({
    databaseTransition: 'BUILDING->ACTIVE->SUPERSEDED',
    databaseStatus: 'SUPERSEDED',
    databaseValidity: 'EXPIRED',
  }),
  EXPIRED: Object.freeze({
    databaseTransition: 'BUILDING->ACTIVE',
    databaseStatus: 'ACTIVE',
    databaseValidity: 'EXPIRED',
  }),
  REVOKED: Object.freeze({
    databaseTransition: 'BUILDING->ACTIVE->REVOKED',
    databaseStatus: 'REVOKED',
    databaseValidity: 'EXPIRED',
  }),
});
const NEGATIVE_PROJECTION_KEYS = Object.freeze([
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
]);

function validateNegativeProjection(value, state, contract, environment, authority, rollout) {
  const location = `negativeObservationProjections.projections.${state}`;
  const projection = record(value, location);
  exactKeys(projection, NEGATIVE_PROJECTION_KEYS, location);
  const expectedDatabase = NEGATIVE_DATABASE_EXPECTATIONS[state];
  if (
    projection.tenantId !== environment.tenants[0].tenantId ||
    projection.actorId !== environment.tenants[0].userId ||
    projection.evidenceState !== state ||
    projection.projectionId !== contract.projectionId ||
    !/^[0-9a-f]{64}$/u.test(String(projection.projectionRevision ?? '')) ||
    projection.contextScopeKey !== authority.scopeKey ||
    projection.policyRevision !== rollout.revision ||
    projection.authorizationRevision !== authority.decisionRevision ||
    projection.databaseTransition !== expectedDatabase.databaseTransition ||
    projection.databaseStatus !== expectedDatabase.databaseStatus ||
    projection.databaseValidity !== expectedDatabase.databaseValidity ||
    projection.databaseMemberCount !== 1 ||
    !SHA256.test(String(projection.projectionObservationSha256 ?? ''))
  ) {
    hold(`${location} is not the exact run/authority/revision/database-state projection.`);
  }
  const material = { ...projection };
  delete material.projectionObservationSha256;
  if (sha256Canonical(material) !== projection.projectionObservationSha256) {
    hold(`${location}.projectionObservationSha256 does not match canonical evidence.`);
  }
  return projection;
}

function validateNegativeProjections(value, environment, authorities, rollouts) {
  const projections = record(value, 'projectionFeed.negativeObservationProjections');
  exactKeys(
    projections,
    [
      'schemaVersion',
      'disposable',
      'restoredPositiveAfterObservations',
      'projections',
      'aggregateSha256',
    ],
    'projectionFeed.negativeObservationProjections'
  );
  const projectionMap = record(
    projections.projections,
    'negativeObservationProjections.projections'
  );
  exactKeys(projectionMap, ['STALE', 'EXPIRED', 'REVOKED'], 'negative projections');
  const contracts = expectedNegativeContracts(environment.runId);
  const validated = {};
  for (const contract of Object.values(contracts)) {
    validated[contract.evidenceState] = validateNegativeProjection(
      projectionMap[contract.evidenceState],
      contract.evidenceState,
      contract,
      environment,
      authorities.A[contract.authorityKey],
      rollouts.A
    );
  }
  if (
    projections.schemaVersion !== 1 ||
    projections.disposable !== true ||
    projections.restoredPositiveAfterObservations !== true ||
    !SHA256.test(String(projections.aggregateSha256 ?? '')) ||
    sha256Canonical(projectionMap) !== projections.aggregateSha256
  ) {
    hold('Negative projection lifecycle was not restored after live observations.');
  }
  return Object.freeze({ ...projections, projections: Object.freeze(validated) });
}

export function validateNegativeObservations(value, tenants, runId, causality = undefined) {
  const root = record(value, 'projectionFeed.negativeObservations');
  exactKeys(root, ['schemaVersion', 'observations', 'aggregateSha256'], 'negativeObservations');
  if (
    root.schemaVersion !== 1 ||
    !Array.isArray(root.observations) ||
    root.observations.length !== 3
  ) {
    hold('negativeObservations must contain exactly three schema-version-1 records.');
  }
  const tenantA = tenants[0];
  if (!tenantA) hold('Negative observations require tenant A.');
  const contracts = expectedNegativeContracts(runId);
  const validated = root.observations.map((candidate, index) => {
    const observation = record(candidate, `negativeObservations.observations[${index}]`);
    exactKeys(
      observation,
      [
        'assertionName',
        'source',
        'method',
        'path',
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
        'status',
        'errorCode',
        'ownerErrorMessage',
        'observedAt',
        'responseBodySha256',
        'observationSha256',
      ],
      `negativeObservations.observations[${index}]`
    );
    const assertionName = textValue(observation.assertionName, 'negative assertionName', 120);
    const contract = contracts[assertionName];
    if (!contract || NEGATIVE_ASSERTIONS[assertionName] !== contract.evidenceState) {
      hold(`Unexpected negative assertion: ${assertionName}`);
    }
    const authority = causality?.authorities?.A?.[contract.authorityKey];
    const projected = causality?.projections?.projections?.[contract.evidenceState];
    const projectionMaterial = Object.fromEntries(
      NEGATIVE_PROJECTION_KEYS.map((key) => [key, observation[key]])
    );
    const projectionDigestMaterial = { ...projectionMaterial };
    delete projectionDigestMaterial.projectionObservationSha256;
    if (
      observation.source !== 'LIVE_GATEWAY_OWNER_REQUEST' ||
      observation.method !== 'GET' ||
      safeApiPath(observation.path, `${assertionName}.path`) !== contract.path ||
      observation.tenantId !== tenantA.tenantId ||
      observation.actorId !== tenantA.userId ||
      observation.evidenceState !== contract.evidenceState ||
      observation.projectionId !== contract.projectionId ||
      !/^[0-9a-f]{64}$/u.test(String(observation.projectionRevision ?? '')) ||
      !SCOPE_KEY.test(String(observation.contextScopeKey ?? '')) ||
      !/^rollout-[0-9a-f]{64}$/u.test(String(observation.policyRevision ?? '')) ||
      !DECISION_REVISION.test(String(observation.authorizationRevision ?? '')) ||
      observation.databaseTransition !==
        NEGATIVE_DATABASE_EXPECTATIONS[contract.evidenceState].databaseTransition ||
      observation.databaseStatus !==
        NEGATIVE_DATABASE_EXPECTATIONS[contract.evidenceState].databaseStatus ||
      observation.databaseValidity !==
        NEGATIVE_DATABASE_EXPECTATIONS[contract.evidenceState].databaseValidity ||
      observation.databaseMemberCount !== 1 ||
      !SHA256.test(String(observation.projectionObservationSha256 ?? '')) ||
      sha256Canonical(projectionDigestMaterial) !== observation.projectionObservationSha256 ||
      observation.status !== contract.status ||
      observation.errorCode !== contract.errorCode ||
      observation.ownerErrorMessage !==
        'No current Payroll-owned legal-entity membership matches the authority.' ||
      (causality &&
        (!authority ||
          authority.decision !== 'ALLOWED' ||
          !DECISION_REVISION.test(authority.decisionRevision) ||
          canonicalJson(projected) !== canonicalJson(projectionMaterial)))
    ) {
      hold(`${assertionName} is not bound to its exact state, projection, authority, and denial.`);
    }
    instant(observation.observedAt, `${assertionName}.observedAt`);
    if (
      !SHA256.test(observation.responseBodySha256) ||
      !SHA256.test(observation.observationSha256)
    ) {
      hold(`${assertionName} contains an invalid digest.`);
    }
    const material = { ...observation };
    delete material.observationSha256;
    if (sha256Canonical(material) !== observation.observationSha256) {
      hold(`${assertionName}.observationSha256 does not match canonical evidence.`);
    }
    return structuredClone(observation);
  });
  if (
    canonicalJson(validated.map((item) => item.assertionName)) !==
    canonicalJson(Object.keys(NEGATIVE_ASSERTIONS))
  ) {
    hold('Negative observations must use exact stale, expired, revoked order.');
  }
  if (!SHA256.test(root.aggregateSha256) || sha256Canonical(validated) !== root.aggregateSha256) {
    hold('negativeObservations.aggregateSha256 does not match its ordered records.');
  }
  return Object.freeze({
    schemaVersion: 1,
    observations: Object.freeze(validated),
    aggregateSha256: root.aggregateSha256,
  });
}

function validatePayrollProjection(value, environment, rollouts, authorities) {
  const payroll = record(value, 'projectionFeed.payroll');
  exactKeys(payroll, ['A'], 'projectionFeed.payroll');
  const entry = record(payroll.A, 'projectionFeed.payroll.A');
  exactKeys(
    entry,
    [
      'scopeKey',
      'projectionId',
      'legalEntityId',
      'status',
      'policyRevision',
      'authorizationRevision',
    ],
    'projectionFeed.payroll.A'
  );
  const expectedProjectionId = expectedPayrollProjectionId(environment.runId);
  if (
    entry.scopeKey !== authorities.A.payroll.scopeKey ||
    entry.projectionId !== expectedProjectionId ||
    entry.legalEntityId !== environment.tenants[0].actorLegalEmployerPublicId ||
    entry.status !== 'ACTIVE' ||
    entry.policyRevision !== rollouts.A.revision ||
    entry.authorizationRevision !== authorities.A.payroll.decisionRevision
  ) {
    hold('projectionFeed.payroll.A is not the exact active DB projection.');
  }
  return payroll;
}

function expectedPayrollProjectionId(runId) {
  return uuidV5Url(`dwp:${runId}:payroll:A:projection`);
}

function validateTimeProjection(value, environment, authorities) {
  const time = record(value, 'projectionFeed.time');
  exactKeys(time, ['A'], 'projectionFeed.time');
  const entry = record(time.A, 'projectionFeed.time.A');
  exactKeys(
    entry,
    [
      'scopeKey',
      'populationPublicId',
      'workerPublicId',
      'peopleAssignmentPublicId',
      'peopleAssignmentRevision',
      'lifecycleState',
      'peopleTargetPersonPublicId',
      'peopleTargetPopulationRevision',
      'populationIdentityKind',
    ],
    'projectionFeed.time.A'
  );
  if (
    entry.scopeKey !== authorities.A.time.scopeKey ||
    entry.populationPublicId !== uuidV5Url(`dwp:${environment.runId}:time:A:population`) ||
    entry.workerPublicId !== environment.tenants[0].targetWorkerPublicId ||
    entry.peopleAssignmentPublicId !== environment.tenants[0].targetAssignmentPublicId ||
    entry.peopleAssignmentRevision !== 1 ||
    entry.lifecycleState !== 'ACTIVE' ||
    entry.peopleTargetPersonPublicId !== environment.tenants[0].targetPersonPublicId ||
    entry.peopleTargetPopulationRevision !== environment.tenants[0].targetPopulationRevision ||
    entry.populationIdentityKind !== 'TIM_PROJECTION_RUN_BOUND'
  ) {
    hold('projectionFeed.time.A is not the exact People-bound target projection.');
  }
  return time;
}

function validatePayrollFoundation(value, environment, payrollProjection) {
  const fixture = record(value, 'projectionFeed.payrollFoundation');
  exactKeys(
    fixture,
    [
      'configurationId',
      'version',
      'lifecycleState',
      'dependencyFreshness',
      'authorActorId',
      'browserActorId',
      'canPublish',
      'receiptSha256',
      'createCommandId',
      'simulateCommandId',
    ],
    'projectionFeed.payrollFoundation'
  );
  if (
    !UUID.test(String(fixture.configurationId ?? '')) ||
    fixture.version !== 2 ||
    fixture.lifecycleState !== 'SIMULATED' ||
    fixture.dependencyFreshness !== 'LIVE' ||
    fixture.browserActorId !== environment.tenants[0].userId ||
    fixture.authorActorId === environment.tenants[0].userId ||
    fixture.canPublish !== true ||
    !SHA256.test(String(fixture.receiptSha256 ?? '')) ||
    !UUID.test(String(fixture.createCommandId ?? '')) ||
    !UUID.test(String(fixture.simulateCommandId ?? '')) ||
    fixture.createCommandId === fixture.simulateCommandId ||
    payrollProjection.A.legalEntityId !== environment.tenants[0].actorLegalEmployerPublicId
  ) {
    hold('projectionFeed.payrollFoundation is not the exact owner-native fixture.');
  }
  return fixture;
}

function validatePayrollFoundationDatabaseObservation(
  value,
  environment,
  payrollProjection,
  payrollFoundation
) {
  const observation = record(value, 'projectionFeed.payrollFoundationDatabaseObservation');
  exactKeys(
    observation,
    [
      'schemaVersion',
      'phase',
      'tenantId',
      'configurationId',
      'currentVersion',
      'lifecycleState',
      'legalEntityId',
      'authorId',
      'publisherId',
      'lastCommandId',
      'fixtureReceiptSha256',
      'definitionDigest',
      'dependencyDigest',
      'lastCommandReceipt',
      'observationSha256',
    ],
    'projectionFeed.payrollFoundationDatabaseObservation'
  );
  const receipt = record(
    observation.lastCommandReceipt,
    'payrollFoundationDatabaseObservation.lastCommandReceipt'
  );
  exactKeys(
    receipt,
    ['commandId', 'commandType', 'receiptStatus', 'resultVersion', 'requestDigest'],
    'payrollFoundationDatabaseObservation.lastCommandReceipt'
  );
  if (
    observation.schemaVersion !== 1 ||
    observation.phase !== 'PREFLIGHT' ||
    observation.tenantId !== environment.tenants[0].tenantId ||
    observation.configurationId !== payrollFoundation.configurationId ||
    observation.currentVersion !== payrollFoundation.version ||
    observation.currentVersion !== 2 ||
    observation.lifecycleState !== payrollFoundation.lifecycleState ||
    observation.legalEntityId !== payrollProjection.legalEntityId ||
    observation.authorId !== payrollFoundation.authorActorId ||
    observation.publisherId !== null ||
    observation.lastCommandId !== receipt.commandId ||
    observation.lastCommandId !== payrollFoundation.simulateCommandId ||
    observation.fixtureReceiptSha256 !== payrollFoundation.receiptSha256 ||
    !SHA256.test(String(observation.definitionDigest ?? '')) ||
    !SHA256.test(String(observation.dependencyDigest ?? '')) ||
    receipt.commandType !== 'SIMULATE' ||
    receipt.receiptStatus !== 'SUCCEEDED' ||
    receipt.resultVersion !== 2 ||
    !UUID.test(String(receipt.commandId ?? '')) ||
    !SHA256.test(String(receipt.requestDigest ?? '')) ||
    !SHA256.test(String(observation.observationSha256 ?? ''))
  ) {
    hold('payrollFoundationDatabaseObservation is not the exact preflight DB lineage.');
  }
  const material = { ...observation };
  delete material.observationSha256;
  if (sha256Canonical(material) !== observation.observationSha256) {
    hold('payrollFoundationDatabaseObservation canonical digest does not match.');
  }
  return observation;
}

export function validateRuntimeManifest(value, environment) {
  const runtime = record(value, 'runtime.json');
  exactKeys(
    runtime,
    [
      'schemaVersion',
      'runId',
      'syntheticOnly',
      'secretsPersisted',
      'activeBundle',
      'migrationControl',
      'syntheticTenants',
      'projectionFeed',
      'endpoints',
    ],
    'runtime.json'
  );
  if (
    runtime.schemaVersion !== 1 ||
    runtime.runId !== environment.runId ||
    runtime.syntheticOnly !== true ||
    runtime.secretsPersisted !== false ||
    canonicalJson(runtime.activeBundle) !== canonicalJson(environment.activeBundle)
  ) {
    hold('runtime.json root binding is invalid.');
  }
  const endpoints = record(runtime.endpoints, 'runtime.json.endpoints');
  exactKeys(endpoints, Object.keys(environment.endpoints), 'runtime.json.endpoints');
  if (canonicalJson(endpoints) !== canonicalJson(environment.endpoints)) {
    hold('runtime.json endpoints do not match the checkpoint.');
  }
  const migrationControl = validateMigrationControl(runtime.migrationControl);
  const syntheticTenants = record(runtime.syntheticTenants, 'runtime.json.syntheticTenants');
  exactKeys(syntheticTenants, ['A', 'B'], 'runtime.json.syntheticTenants');
  const runtimeTenants = [
    exactRuntimeTenant(syntheticTenants.A, environment.tenants[0], 'syntheticTenants.A'),
    exactRuntimeTenant(syntheticTenants.B, environment.tenants[1], 'syntheticTenants.B'),
  ];
  const feed = record(runtime.projectionFeed, 'runtime.json.projectionFeed');
  exactKeys(
    feed,
    [
      'rollouts',
      'gatewayAuthorities',
      'negativeObservations',
      'negativeObservationProjections',
      'payroll',
      'time',
      'payrollAuthority',
      'payrollFoundation',
      'payrollFoundationDatabaseObservation',
      'runtimeMutationDenied',
      'publisherForbiddenTableDenied',
    ],
    'runtime.json.projectionFeed'
  );
  const rollouts = validateRollouts(feed.rollouts, runtimeTenants);
  const gatewayAuthorities = validateGatewayAuthorities(feed.gatewayAuthorities);
  const negativeProjections = validateNegativeProjections(
    feed.negativeObservationProjections,
    environment,
    gatewayAuthorities,
    rollouts
  );
  const negativeObservations = validateNegativeObservations(
    feed.negativeObservations,
    environment.tenants,
    environment.runId,
    { authorities: gatewayAuthorities, projections: negativeProjections }
  );
  const payroll = validatePayrollProjection(
    feed.payroll,
    environment,
    rollouts,
    gatewayAuthorities
  );
  const time = validateTimeProjection(feed.time, environment, gatewayAuthorities);
  const payrollAuthority = record(feed.payrollAuthority, 'projectionFeed.payrollAuthority');
  if (canonicalJson(payrollAuthority) !== canonicalJson(gatewayAuthorities.A.payroll)) {
    hold('projectionFeed.payrollAuthority is not the exact Gateway payroll authority.');
  }
  const payrollFoundation = validatePayrollFoundation(feed.payrollFoundation, environment, payroll);
  const payrollFoundationDatabaseObservation = validatePayrollFoundationDatabaseObservation(
    feed.payrollFoundationDatabaseObservation,
    environment,
    payroll.A,
    payrollFoundation
  );
  if (feed.runtimeMutationDenied !== true || feed.publisherForbiddenTableDenied !== true) {
    hold('Projection publisher/runtime DB boundary evidence is incomplete.');
  }
  return Object.freeze({
    runtime,
    runtimeTenants: Object.freeze(runtimeTenants),
    migrationControl,
    projectionFeed: feed,
    gatewayAuthorities,
    negativeProjections,
    negativeObservations,
    payrollProjection: payroll.A,
    timeProjection: time.A,
    payrollFoundation,
    payrollFoundationDatabaseObservation,
  });
}

export function assertLiveRuntimeBindings(validatedRuntime, contracts) {
  const payroll = validatedRuntime.gatewayAuthorities.A.payroll;
  const publish = validatedRuntime.gatewayAuthorities.A.payrollPublish;
  const featureOff = validatedRuntime.gatewayAuthorities.B.payroll;
  if (
    contracts.payrollRead.routeContractKey !== payroll.routeContractKey ||
    contracts.payrollRead.contextKey !== payroll.contextKey ||
    contracts.payrollRead.contextScopeKey !== payroll.scopeKey ||
    contracts.payrollRead.decision !== payroll.decision ||
    contracts.payrollRead.decisionRevision !== payroll.decisionRevision ||
    contracts.publishPreview.routeContractKey !== publish.routeContractKey ||
    contracts.publishPreview.contextKey !== null ||
    contracts.publishPreview.contextScopeKey !== null ||
    contracts.publishPreview.decision !== publish.decision ||
    contracts.publishPreview.decisionRevision !== publish.decisionRevision ||
    contracts.publishPreview.reasonCode !== publish.reasonCode ||
    contracts.publishPreview.requiredAssurance !== publish.requiredAssurance ||
    contracts.featureOff.decision !== featureOff.decision ||
    contracts.featureOff.decisionRevision !== featureOff.decisionRevision ||
    contracts.featureOff.reasonCode !== featureOff.reasonCode
  ) {
    hold('Live Gateway contracts do not equal the backend-emitted runtime authorities.');
  }
  return true;
}
