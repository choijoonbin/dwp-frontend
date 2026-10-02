import {
  CANONICAL_ROUTES,
  DENIED_ACCESS_STATES,
  DENIED_PAGE_CANDIDATES,
  PAYROLL_ROUTES,
  PEOPLE_ROUTES,
  UUID,
  expectedPeoplePolicyRevision,
  hold,
  record,
  responseSummary,
  sha256Canonical,
  sha256Bytes,
  textValue,
} from './hris-w1-checkpoint-core.mjs';

export function envelopeData(root, location) {
  return record(record(root, location).data, `${location}.data`);
}

export function errorCode(root, location) {
  return textValue(record(root, location).errorCode, `${location}.errorCode`, 120);
}

export async function requestJson(session, method, requestPath, options = {}) {
  const expectedURL = new URL(requestPath, 'http://127.0.0.1');
  if (!requestPath.startsWith('/api/') || requestPath.startsWith('//')) {
    hold(`Refusing a non-API live request: ${requestPath}`);
  }
  const response = await session.context.fetch(requestPath, {
    headers: { Accept: 'application/json', ...(options.headers ?? {}) },
    failOnStatusCode: false,
    maxRedirects: 0,
    timeout: 45_000,
    ...(options.data === undefined ? {} : { data: options.data }),
    method,
  });
  const responseURL = new URL(response.url());
  if (
    responseURL.origin !== session.gatewayURL ||
    responseURL.pathname !== expectedURL.pathname ||
    responseURL.search !== expectedURL.search
  ) {
    hold(`${method} ${expectedURL.pathname} escaped the exact live Gateway boundary.`);
  }
  const bytes = await response.body();
  if (!(response.headers()['content-type'] ?? '').includes('application/json')) {
    hold(`${method} ${expectedURL.pathname} did not return JSON (HTTP ${response.status()}).`);
  }
  let root;
  try {
    root = JSON.parse(bytes.toString('utf8'));
  } catch {
    hold(`${method} ${expectedURL.pathname} returned invalid JSON.`);
  }
  return Object.freeze({
    method,
    path: expectedURL.pathname,
    status: response.status(),
    headers: response.headers(),
    root,
    bodySha256: sha256Bytes(bytes),
    bodyByteCount: bytes.byteLength,
  });
}

async function csrf(session) {
  if (session.csrf) return session.csrf;
  const response = await requestJson(session, 'GET', '/api/auth/csrf');
  if (response.status !== 200) hold(`${session.label} CSRF bootstrap failed.`);
  const data = envelopeData(response.root, `${session.label} CSRF`);
  if (data.headerName !== 'X-XSRF-TOKEN') hold(`${session.label} CSRF header is noncanonical.`);
  session.csrf = Object.freeze({
    headerName: data.headerName,
    token: textValue(data.token, `${session.label} CSRF token`, 500),
  });
  return session.csrf;
}

export async function mutationJson(session, method, requestPath, data, headers = {}) {
  const token = await csrf(session);
  return requestJson(session, method, requestPath, {
    data,
    headers: { ...headers, [token.headerName]: token.token, 'Content-Type': 'application/json' },
  });
}

export async function createLiveSession(requestApi, environment, tenant) {
  const context = await requestApi.newContext({
    baseURL: environment.endpoints.gateway,
    extraHTTPHeaders: { 'X-Tenant-ID': String(tenant.tenantId), Accept: 'application/json' },
    timeout: 45_000,
  });
  const session = {
    context,
    gatewayURL: environment.endpoints.gateway,
    tenant,
    label: tenant.label,
    csrf: null,
    contexts: null,
    authentication: null,
  };
  try {
    const login = await requestJson(session, 'POST', '/api/auth/login', {
      data: { email: tenant.email, password: tenant.password, tenantId: String(tenant.tenantId) },
      headers: { 'Content-Type': 'application/json' },
    });
    if (login.status !== 200) hold(`${tenant.label} live Gateway login failed.`);
    const me = await requestJson(session, 'GET', '/api/auth/me');
    if (me.status !== 200) hold(`${tenant.label} live Gateway /api/auth/me failed.`);
    const meData = envelopeData(me.root, `${tenant.label} me`);
    if (
      String(meData.tenantId) !== String(tenant.tenantId) ||
      String(meData.userId) !== String(tenant.userId) ||
      meData.identityPlane !== 'TENANT' ||
      (meData.personPublicId !== undefined && meData.personPublicId !== tenant.personPublicId)
    ) {
      hold(`${tenant.label} authenticated subject does not match the synthetic credential.`);
    }
    session.authentication = Object.freeze({
      login: responseSummary(login),
      me: responseSummary(me),
      tenantId: tenant.tenantId,
      userId: tenant.userId,
      personPublicId: tenant.personPublicId,
    });
    return session;
  } catch (error) {
    await context.dispose().catch(() => {});
    throw error;
  }
}

async function contextsFor(session) {
  if (session.contexts) return session.contexts;
  const response = await requestJson(session, 'GET', '/api/auth/product-surface-contexts');
  if (response.status !== 200) hold(`${session.label} product-surface contexts failed.`);
  const data = envelopeData(response.root, `${session.label} contexts`);
  if (!Array.isArray(data.contexts) || !Array.isArray(data.rollouts)) {
    hold(`${session.label} product-surface context response is incomplete.`);
  }
  session.contexts = Object.freeze({ response, data });
  return session.contexts;
}

function evaluationBody(surfaceKey, routeContractKey, contextKey, contextScopeKey) {
  return {
    subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey },
    routeContractKey,
    ...(contextKey ? { contextKey } : {}),
    ...(contextScopeKey ? { contextScopeKey } : {}),
  };
}

async function rawEvaluation(session, surfaceKey, routeContractKey, contextKey, contextScopeKey) {
  const response = await mutationJson(
    session,
    'POST',
    '/api/auth/product-surface-access/evaluate',
    evaluationBody(surfaceKey, routeContractKey, contextKey, contextScopeKey)
  );
  if (response.status !== 200) hold(`${session.label} authority evaluation failed.`);
  const data = envelopeData(response.root, `${routeContractKey} evaluation`);
  textValue(data.decision, `${routeContractKey}.decision`, 80);
  return { response, data };
}

function contextCandidates(contextData, surfaceKey) {
  return contextData.contexts
    .filter(
      (candidate) =>
        candidate?.productKey === 'hcm' &&
        candidate.surfaceKey === surfaceKey &&
        typeof candidate.contextKey === 'string' &&
        Array.isArray(candidate.scopes)
    )
    .flatMap((context) =>
      context.scopes
        .filter((scope) => scope && typeof scope.key === 'string')
        .map((scope) => ({ contextKey: context.contextKey, scope }))
    );
}

function evaluationResult(surfaceKey, routeContractKey, expectedDecision, evaluated, selected) {
  if (
    evaluated.data.context?.contextKey !== selected.contextKey ||
    evaluated.data.scope?.key !== selected.contextScopeKey
  ) {
    hold(`${routeContractKey} returned a different context or scope than selected.`);
  }
  return Object.freeze({
    surfaceKey,
    routeContractKey,
    decision: expectedDecision,
    decisionRevision: textValue(
      evaluated.data.decisionRevision,
      `${routeContractKey}.revision`,
      240
    ),
    contextKey: textValue(selected.contextKey, `${routeContractKey}.contextKey`, 500),
    contextScopeKey: textValue(selected.contextScopeKey, `${routeContractKey}.scope`, 200),
    reasonCode: evaluated.data.reasonCode ?? null,
    requiredAssurance: evaluated.data.requiredAssurance ?? null,
    revalidateAt: evaluated.data.revalidateAt ?? null,
    response: responseSummary(evaluated.response),
  });
}

export async function evaluateExact(
  session,
  surfaceKey,
  routeContractKey,
  expectedDecision,
  requested
) {
  if (requested) {
    const evaluated = await rawEvaluation(
      session,
      surfaceKey,
      routeContractKey,
      requested.contextKey,
      requested.contextScopeKey
    );
    if (evaluated.data.decision !== expectedDecision) {
      hold(
        `${routeContractKey} returned ${evaluated.data.decision}, expected ${expectedDecision}.`
      );
    }
    return evaluationResult(surfaceKey, routeContractKey, expectedDecision, evaluated, requested);
  }
  const first = await rawEvaluation(session, surfaceKey, routeContractKey);
  if (first.data.decision === expectedDecision && first.data.context && first.data.scope) {
    return evaluationResult(surfaceKey, routeContractKey, expectedDecision, first, {
      contextKey: first.data.context.contextKey,
      contextScopeKey: first.data.scope.key,
    });
  }
  const candidates = contextCandidates((await contextsFor(session)).data, surfaceKey);
  if (!candidates.length) hold(`${routeContractKey} has no live Gateway scope candidates.`);
  const matches = [];
  for (const candidate of candidates) {
    const evaluated = await rawEvaluation(
      session,
      surfaceKey,
      routeContractKey,
      candidate.contextKey,
      candidate.scope.key
    );
    if (evaluated.data.decision === expectedDecision) matches.push({ candidate, evaluated });
  }
  const defaults = matches.filter((match) => match.candidate.scope.isDefault === true);
  const selected = matches.length === 1 ? matches[0] : defaults.length === 1 ? defaults[0] : null;
  if (!selected) hold(`${routeContractKey} did not resolve one unambiguous live Gateway scope.`);
  return evaluationResult(surfaceKey, routeContractKey, expectedDecision, selected.evaluated, {
    contextKey: selected.candidate.contextKey,
    contextScopeKey: selected.candidate.scope.key,
  });
}

export function assertSameContextBinding(label, ...authorities) {
  if (!authorities.length) hold(`${label} requires at least one authority.`);
  const expected = authorities[0];
  if (
    authorities.some(
      (authority) =>
        !authority ||
        authority.contextKey !== expected.contextKey ||
        authority.contextScopeKey !== expected.contextScopeKey
    )
  ) {
    hold(`${label} contextKey and contextScopeKey values are not identical.`);
  }
  return Object.freeze({
    contextKey: expected.contextKey,
    contextScopeKey: expected.contextScopeKey,
    equal: true,
  });
}

function routeWithScope(routePath, scopeKey) {
  return `${routePath}?scope=${encodeURIComponent(scopeKey)}`;
}

export function buildRouteMatrices(canonicalEvaluations, payrollPage, deniedPage) {
  const tenantA = CANONICAL_ROUTES.map((route) => {
    const evaluation = canonicalEvaluations[route.module];
    if (!evaluation || evaluation.routeContractKey !== route.pageRouteContractKey) {
      hold(`Missing canonical live evaluation for ${route.module}.`);
    }
    return {
      id: route.id,
      module: route.module,
      pageRouteContractKey: route.pageRouteContractKey,
      path: routeWithScope(route.path, evaluation.contextScopeKey),
      outcome: 'allowed',
      marker: route.marker,
      expectedScopeKey: evaluation.contextScopeKey,
      accessStates: [],
      api: [{ path: route.apiPath, method: 'GET', statuses: [200] }],
    };
  });
  tenantA.push({
    id: 'tenant-a-pay-high-preview',
    module: 'PAY',
    pageRouteContractKey: PAYROLL_ROUTES.page.routeContractKey,
    path: routeWithScope('/hr/operations/pay', payrollPage.contextScopeKey),
    outcome: 'allowed',
    marker: '[data-testid="payroll-foundation-studio"]',
    expectedScopeKey: payrollPage.contextScopeKey,
    accessStates: [],
    api: [
      { path: PAYROLL_ROUTES.list.path, method: 'GET', statuses: [200] },
      { path: '/api/auth/product-surface-access/evaluate', method: 'POST', statuses: [200] },
    ],
    highRiskPreview: {
      clickSelectors: [
        'button[aria-describedby="payroll-publish-requirements"]',
        '[role="dialog"] button[type="submit"]',
      ],
      dialogSelector: '[role="dialog"]',
      dialogText: '고위험 작업 본인 확인',
      allowedRequestPaths: ['/api/auth/product-surface-access/evaluate'],
      expectedRouteContractKey: PAYROLL_ROUTES.publish.routeContractKey,
      expectedOperation: 'HCM_PAYROLL_FOUNDATION_PUBLISH',
    },
  });
  tenantA.push({
    id: deniedPage.id,
    module: deniedPage.module,
    pageRouteContractKey: deniedPage.pageRouteContractKey,
    path: deniedPage.path,
    outcome: 'denied',
    accessStates: [deniedPage.accessState],
    api: [],
  });
  const tenantB = CANONICAL_ROUTES.map((route) => ({
    id: route.id.replace('tenant-a-', 'tenant-b-'),
    module: route.module,
    pageRouteContractKey: route.pageRouteContractKey,
    path: route.path,
    outcome: 'redirected',
    accessStates: [],
    redirectPath: '/403',
    api: [],
  }));
  return Object.freeze({ tenantA: Object.freeze(tenantA), tenantB: Object.freeze(tenantB) });
}

function exactRollout(contexts, expected) {
  const matches = contexts.data.rollouts.filter((rollout) => rollout?.productKey === 'hcm');
  if (matches.length !== 1) hold(`${expected.label} must have one HCM rollout.`);
  const rollout = matches[0];
  if (
    rollout.state !== expected.state ||
    rollout.authorityStatus !== expected.authorityStatus ||
    rollout.flags?.contextShadow !== expected.enabled ||
    rollout.flags?.capabilityEnforcement !== expected.enabled ||
    rollout.flags?.surfaceUi !== expected.enabled
  ) {
    hold(`${expected.label} HCM rollout is not ${expected.state}.`);
  }
  return structuredClone(rollout);
}

async function deriveDeniedPage(sessionA) {
  for (const candidate of DENIED_PAGE_CANDIDATES) {
    const evaluated = await rawEvaluation(
      sessionA,
      candidate.surfaceKey,
      candidate.pageRouteContractKey
    );
    const accessState = DENIED_ACCESS_STATES[evaluated.data.decision];
    if (!accessState) continue;
    return Object.freeze({
      ...candidate,
      accessState,
      decision: evaluated.data.decision,
      reasonCode: textValue(evaluated.data.reasonCode, `${candidate.id}.reasonCode`, 120),
      decisionRevision: textValue(evaluated.data.decisionRevision, `${candidate.id}.revision`, 240),
      response: responseSummary(evaluated.response),
    });
  }
  hold('No registered HCM PAGE contract returned a live fail-closed decision for tenant A.');
}

export async function deriveLiveContracts(sessionA, sessionB) {
  const contextsA = await contextsFor(sessionA);
  const contextsB = await contextsFor(sessionB);
  const rolloutA = exactRollout(contextsA, {
    label: 'tenant-a',
    state: '111',
    authorityStatus: 'AVAILABLE',
    enabled: true,
  });
  const rolloutB = exactRollout(contextsB, {
    label: 'tenant-b',
    state: '000',
    authorityStatus: 'NOT_EVALUATED',
    enabled: false,
  });
  const featureOffEvaluation = await rawEvaluation(
    sessionB,
    PAYROLL_ROUTES.list.surfaceKey,
    PAYROLL_ROUTES.list.routeContractKey
  );
  if (
    !['APP_DENIED', 'SURFACE_DENIED', 'ROUTE_DENIED'].includes(featureOffEvaluation.data.decision)
  ) {
    hold('Tenant B feature-off Gateway evaluation did not fail closed.');
  }
  const featureOff = Object.freeze({
    surfaceKey: PAYROLL_ROUTES.list.surfaceKey,
    routeContractKey: PAYROLL_ROUTES.list.routeContractKey,
    decision: featureOffEvaluation.data.decision,
    reasonCode: textValue(featureOffEvaluation.data.reasonCode, 'feature-off reasonCode', 120),
    decisionRevision: textValue(
      featureOffEvaluation.data.decisionRevision,
      'feature-off revision',
      240
    ),
    response: responseSummary(featureOffEvaluation.response),
  });
  const canonicalEvaluations = {};
  for (const route of CANONICAL_ROUTES) {
    canonicalEvaluations[route.module] = await evaluateExact(
      sessionA,
      route.surfaceKey,
      route.pageRouteContractKey,
      'ALLOWED'
    );
  }
  const payrollPage = await evaluateExact(
    sessionA,
    PAYROLL_ROUTES.page.surfaceKey,
    PAYROLL_ROUTES.page.routeContractKey,
    'ALLOWED'
  );
  const payrollRead = await evaluateExact(
    sessionA,
    PAYROLL_ROUTES.list.surfaceKey,
    PAYROLL_ROUTES.list.routeContractKey,
    'ALLOWED'
  );
  const payrollUpdate = await evaluateExact(
    sessionA,
    PAYROLL_ROUTES.update.surfaceKey,
    PAYROLL_ROUTES.update.routeContractKey,
    'ALLOWED'
  );
  const peopleSearch = await evaluateExact(
    sessionA,
    PEOPLE_ROUTES.search.surfaceKey,
    PEOPLE_ROUTES.search.routeContractKey,
    'ALLOWED'
  );
  const peopleDetail = await evaluateExact(
    sessionA,
    PEOPLE_ROUTES.detail.surfaceKey,
    PEOPLE_ROUTES.detail.routeContractKey,
    'ALLOWED'
  );
  const publishPreview = await evaluateExact(
    sessionA,
    PAYROLL_ROUTES.publish.surfaceKey,
    PAYROLL_ROUTES.publish.routeContractKey,
    'STEP_UP_REQUIRED',
    { contextKey: payrollPage.contextKey, contextScopeKey: payrollPage.contextScopeKey }
  );
  assertSameContextBinding('PAY page/read/action', payrollPage, payrollRead, payrollUpdate);
  assertSameContextBinding(
    'People page/search/detail',
    canonicalEvaluations.HRM,
    peopleSearch,
    peopleDetail
  );
  if (
    publishPreview.requiredAssurance !== 'urn:dwp:assurance:high' ||
    publishPreview.reasonCode !== 'STEP_UP_REQUIRED'
  ) {
    hold('PAY publish preview is not exact HIGH step-up authority.');
  }
  const deniedPage = await deriveDeniedPage(sessionA);
  return Object.freeze({
    contextsA,
    contextsB,
    rolloutA,
    rolloutB,
    featureOff,
    canonicalEvaluations: Object.freeze(canonicalEvaluations),
    payrollPage,
    payrollRead,
    payrollUpdate,
    peopleSearch,
    peopleDetail,
    publishPreview,
    deniedPage,
    routeMatrices: buildRouteMatrices(canonicalEvaluations, payrollPage, deniedPage),
  });
}

export async function crossTenantFence(sessionA, tenantB) {
  const response = await requestJson(sessionA, 'GET', '/api/auth/me', {
    headers: { 'X-Tenant-ID': String(tenantB.tenantId) },
  });
  if (![401, 403].includes(response.status)) hold('Live cross-tenant session did not fail closed.');
  return Object.freeze({
    ...responseSummary(response),
    requestedTenantId: tenantB.tenantId,
    errorCode: errorCode(response.root, 'cross-tenant response'),
  });
}

function targetSnapshot(item, location, tenant, policyRevision) {
  const snapshot = record(item, location);
  const person = record(snapshot.person, `${location}.person`);
  const personId = textValue(person.personId, `${location}.person.personId`);
  if (!UUID.test(personId)) hold(`${location} returned a noncanonical person id.`);
  if (personId === tenant.targetPersonPublicId) {
    if (
      record(snapshot.employment, `${location}.employment`).workerNumber !== 'E100002' ||
      record(snapshot.primaryAssignment, `${location}.primaryAssignment`).assignmentKey !==
        'ASG-E100002-1' ||
      record(snapshot.access, `${location}.access`).policyRevision !== policyRevision
    ) {
      hold(
        'People search target is not bound to the target worker, assignment, and policy revision.'
      );
    }
  }
  return personId;
}

export async function populationBoundaryFence(sessionA, contracts, runtimeTenant) {
  const tenant = sessionA.tenant;
  const binding = assertSameContextBinding(
    'People population',
    contracts.canonicalEvaluations.HRM,
    contracts.peopleSearch,
    contracts.peopleDetail
  );
  const asOf = new Date().toISOString().slice(0, 10);
  const commonQuery = new URLSearchParams({
    projection: 'people360',
    asOf,
    contextScopeKey: binding.contextScopeKey,
  });
  const searchQuery = new URLSearchParams(commonQuery);
  searchQuery.set('size', '50');
  const searchResponse = await requestJson(
    sessionA,
    PEOPLE_ROUTES.search.method,
    `${PEOPLE_ROUTES.search.path}?${searchQuery.toString()}`
  );
  const page = dataFromSuccess(searchResponse, 'People 360 target population search');
  if (
    !Array.isArray(page.items) ||
    page.items.length !== tenant.targetPopulationCount ||
    page.size !== tenant.targetPopulationCount ||
    page.hasMore !== false ||
    page.nextCursor != null ||
    page.asOf !== asOf
  ) {
    hold('People 360 search did not return the exact bounded target population.');
  }
  const policyRevision = expectedPeoplePolicyRevision(tenant.targetPopulationRevision);
  const listedPersonIds = page.items.map((item, index) =>
    targetSnapshot(item, `People 360 page.items[${index}]`, tenant, policyRevision)
  );
  if (
    new Set(listedPersonIds).size !== listedPersonIds.length ||
    !listedPersonIds.includes(tenant.targetPersonPublicId) ||
    listedPersonIds.includes(tenant.personPublicId)
  ) {
    hold('People 360 search did not prove target membership and actor exclusion.');
  }
  const detailPath = (personId) =>
    `${PEOPLE_ROUTES.detail.path}/${encodeURIComponent(personId)}?${commonQuery.toString()}`;
  const targetResponse = await requestJson(
    sessionA,
    PEOPLE_ROUTES.detail.method,
    detailPath(tenant.targetPersonPublicId)
  );
  if (targetResponse.status !== 200) hold('People 360 target detail did not return HTTP 200.');
  const target = dataFromSuccess(targetResponse, 'People 360 target member detail');
  const targetPerson = record(target.person, 'People target.person');
  if (
    target.schemaVersion !== 1 ||
    target.asOf !== asOf ||
    targetPerson.personId !== tenant.targetPersonPublicId ||
    record(target.employment, 'People target.employment').workerNumber !== 'E100002' ||
    record(target.primaryAssignment, 'People target.primaryAssignment').assignmentKey !==
      'ASG-E100002-1' ||
    record(target.access, 'People target.access').policyRevision !== policyRevision
  ) {
    hold('People target detail is not bound to person, worker, assignment, and policy revision.');
  }
  const actorResponse = await requestJson(
    sessionA,
    PEOPLE_ROUTES.detail.method,
    detailPath(tenant.personPublicId)
  );
  if (![403, 404].includes(actorResponse.status)) {
    hold('People operations detail did not deny the population-excluded actor.');
  }
  return Object.freeze({
    asOf,
    routeContracts: {
      search: contracts.peopleSearch.routeContractKey,
      detail: contracts.peopleDetail.routeContractKey,
    },
    contextBinding: binding,
    population: {
      revision: tenant.targetPopulationRevision,
      policyRevision,
      expectedCount: tenant.targetPopulationCount,
      observedCount: listedPersonIds.length,
      actorPersonPublicId: tenant.personPublicId,
      targetPersonPublicId: tenant.targetPersonPublicId,
      targetWorkerPublicId: tenant.targetWorkerPublicId,
      targetAssignmentPublicId: tenant.targetAssignmentPublicId,
      workerNumber: 'E100002',
      assignmentKey: 'ASG-E100002-1',
      peopleWorkforceReceiptSha256: runtimeTenant.peopleWorkforceReceiptSha256,
    },
    search: responseSummary(searchResponse),
    targetMember: {
      ...responseSummary(targetResponse),
      personPublicId: tenant.targetPersonPublicId,
      schemaVersion: target.schemaVersion,
    },
    excludedActor: {
      ...responseSummary(actorResponse),
      personPublicId: tenant.personPublicId,
      errorCode: errorCode(actorResponse.root, 'People actor exclusion'),
    },
  });
}

export async function unmappedRouteFence(sessionA, runId) {
  const routeContractKey = `route.hcm.operations.checkpoint-${runId.slice(-8)}.page`;
  const evaluated = await rawEvaluation(sessionA, 'hcm.operations', routeContractKey);
  if (!['ROUTE_DENIED', 'APP_DENIED', 'SURFACE_DENIED'].includes(evaluated.data.decision)) {
    hold('Unmapped HCM route did not return a fail-closed authority decision.');
  }
  return Object.freeze({
    routeContractKey,
    decision: evaluated.data.decision,
    reasonCode: textValue(evaluated.data.reasonCode, 'unmapped reasonCode', 120),
    decisionRevision: textValue(evaluated.data.decisionRevision, 'unmapped revision', 240),
    response: responseSummary(evaluated.response),
  });
}

export function dataFromSuccess(response, location) {
  if (response.status !== 200) hold(`${location} failed with HTTP ${response.status}.`);
  return envelopeData(response.root, location);
}

export function configurationById(workspace, configurationId, location) {
  if (!Array.isArray(workspace.configurations))
    hold(`${location}.configurations must be an array.`);
  const matches = workspace.configurations.filter(
    (item) => item?.configurationId === configurationId
  );
  if (matches.length !== 1) hold(`${location} must contain exactly one fixture configuration.`);
  return record(matches[0], `${location}.configuration`);
}

export function assertReceipt(result, expected, location) {
  const receipt = record(result.receipt, `${location}.receipt`);
  const configuration = record(result.configuration, `${location}.configuration`);
  if (
    receipt.commandId !== expected.commandId ||
    receipt.commandType !== expected.commandType ||
    receipt.status !== 'SUCCEEDED' ||
    receipt.configurationId !== expected.configurationId ||
    receipt.resultVersion !== expected.resultVersion ||
    configuration.configurationId !== expected.configurationId ||
    configuration.version !== expected.resultVersion ||
    configuration.lastCommandId !== expected.commandId
  ) {
    hold(`${location} receipt/configuration lineage is not exact.`);
  }
  return { receipt, configuration, digest: sha256Canonical(result) };
}
