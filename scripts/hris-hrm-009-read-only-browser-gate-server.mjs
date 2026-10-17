import http from 'node:http';

const HOST = '127.0.0.1';
const PORT = 8919;
const UPSTREAM = new URL('http://127.0.0.1:8080');
const DECISION_REVISION = 'decision:hrm-009:52';
const AS_OF = '2026-10-18T00:00:00Z';
const MAX_CONTROL_BODY_BYTES = 4_096;
const MAX_EVALUATION_BODY_BYTES = 32_768;
const MAX_EVENTS = 512;

const CONTROL_PREFIX = '/api/__hrm009-gate';
const CONTEXTS_PATH = '/api/auth/product-surface-contexts';
const EVALUATION_PATH = '/api/auth/product-surface-access/evaluate';
const PERSONAL_OWNER_PATH = '/api/people/v1/hris/workbench/self-service/requests';
const OPERATIONS_OWNER_PATH = '/api/people/v1/hris/workbench/operations/certificates/documents';
const CERTIFICATE_MUTATION_PREFIX = '/api/people/v1/hris/certificates';
const EMPLOYEE_CHANGE_MUTATION_PREFIX = '/api/people/v1/hris/employee-change-requests';
const STEP_UP_PREFIX = '/api/auth/product-surface-step-up-challenges';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SCENARIOS = new Set(['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE']);
const PRODUCT_KEYS = [
  'approvals',
  'calendar',
  'communications',
  'dwaion',
  'hcm',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'services',
  'spaces',
  'workplace',
];

const CONTRACTS = Object.freeze({
  'route.hcm.personal.requests.page': Object.freeze({
    kind: 'PAGE',
    surfaceKey: 'hcm.personal',
    ownerPath: PERSONAL_OWNER_PATH,
  }),
  'route.hcm.personal.requests.data': Object.freeze({
    kind: 'DATA',
    surfaceKey: 'hcm.personal',
    ownerPath: PERSONAL_OWNER_PATH,
  }),
  'route.hcm.operations.certificates-documents.page': Object.freeze({
    kind: 'PAGE',
    surfaceKey: 'hcm.operations',
    ownerPath: OPERATIONS_OWNER_PATH,
  }),
  'route.hcm.operations.certificates-documents.data': Object.freeze({
    kind: 'DATA',
    surfaceKey: 'hcm.operations',
    ownerPath: OPERATIONS_OWNER_PATH,
  }),
});

const PERSONAL_SCOPE = Object.freeze({
  key: 'scope:hrm009:self',
  kind: 'SELF',
  displayName: 'My HR certificate requests',
  isDefault: true,
  readOnly: true,
  validUntil: null,
});

const OPERATIONS_SCOPE = Object.freeze({
  key: 'scope:hrm009:operations',
  kind: 'TARGET_POPULATION',
  displayName: 'HR certificate operations population',
  isDefault: true,
  readOnly: true,
  validUntil: null,
});

let sequence = 0;
let events = [];
let scenarios = defaultScenarios();
let counters = defaultCounters();

function defaultScenarios() {
  return { personal: 'COMPLETE', operations: 'COMPLETE' };
}

function defaultCounters() {
  return {
    pageEvaluations: Object.fromEntries(
      Object.keys(CONTRACTS)
        .filter((key) => CONTRACTS[key].kind === 'PAGE')
        .map((key) => [key, 0])
    ),
    dataEvaluations: Object.fromEntries(
      Object.keys(CONTRACTS)
        .filter((key) => CONTRACTS[key].kind === 'DATA')
        .map((key) => [key, 0])
    ),
    ownerGets: {
      [PERSONAL_OWNER_PATH]: 0,
      [OPERATIONS_OWNER_PATH]: 0,
    },
    mutations: {},
    unexpectedAuthorityEvaluations: 0,
    stepUpRequests: 0,
  };
}

function resetState() {
  sequence = 0;
  events = [];
  scenarios = defaultScenarios();
  counters = defaultCounters();
}

function recordEvent(type, detail = {}) {
  sequence += 1;
  events.push({ sequence, type, ...detail });
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
}

function json(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function success(response, data, statusCode = 200) {
  json(response, statusCode, { status: 'SUCCESS', message: 'OK', data });
}

function failure(response, statusCode, message, reasonCode) {
  json(response, statusCode, {
    status: 'ERROR',
    message,
    data: null,
    ...(reasonCode ? { reasonCode } : {}),
  });
}

function readJson(request, maximumBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    request.on('data', (chunk) => {
      received += chunk.length;
      if (received > maximumBytes) {
        reject(new Error('REQUEST_TOO_LARGE'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    request.on('error', reject);
  });
}

function freshAuthorityTimes() {
  const generatedAtMs = Date.now();
  return {
    generatedAt: new Date(generatedAtMs).toISOString(),
    revalidateAt: new Date(generatedAtMs + 5 * 60_000).toISOString(),
  };
}

function capabilityGrant({ capabilityContractKey, resolvedCapabilityCode, authorityMode, scope }) {
  return {
    grantKind: 'CAPABILITY',
    capabilityContractKey,
    resolvedCapabilityCode,
    authorityMode,
    predicatePolicyKeys:
      scope.kind === 'SELF'
        ? ['predicate.self-person.v1']
        : ['predicate.hcm-workforce-visible-person.v1'],
    responsibilityRequirement: 'NOT_REQUIRED',
    scopeKeys: [scope.key],
    requiresProductEntitlement: false,
    readOnly: true,
    activationState: 'ACTIVE',
    validUntil: null,
  };
}

function authorityContexts(revalidateAt) {
  return [
    {
      contextKey: 'ctx:hrm009:personal:v52',
      productKey: 'hcm',
      surfaceKey: 'hcm.personal',
      plane: 'work',
      accessMode: 'NORMAL',
      accessSource: 'RELATIONSHIP',
      appResourceKey: 'APP.HCM',
      effectiveGrants: [
        capabilityGrant({
          capabilityContractKey: 'hcm.personal.requests.view',
          resolvedCapabilityCode: 'DATA.HRIS_SELF_REQUEST:VIEW',
          authorityMode: 'PERMISSION_AND_RELATIONSHIP',
          scope: PERSONAL_SCOPE,
        }),
      ],
      scopes: [PERSONAL_SCOPE],
      revalidateAt,
    },
    {
      contextKey: 'ctx:hrm009:operations:v52',
      productKey: 'hcm',
      surfaceKey: 'hcm.operations',
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'APP.HCM',
      effectiveGrants: [
        capabilityGrant({
          capabilityContractKey: 'hcm.operations.people.view',
          resolvedCapabilityCode: 'DATA.HRIS_WORKFORCE:VIEW',
          authorityMode: 'PERMISSION',
          scope: OPERATIONS_SCOPE,
        }),
      ],
      scopes: [OPERATIONS_SCOPE],
      revalidateAt,
    },
  ];
}

function baselineRollout(productKey) {
  return {
    productKey,
    state: '000',
    flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
    cohort: 'hrm009-browser-gate-baseline',
    opaqueRevision: `hrm009-browser-gate-${productKey}-off`,
    authorityStatus: 'NOT_EVALUATED',
  };
}

function authorityEnvelope() {
  const times = freshAuthorityTimes();
  return {
    contractVersion: '2',
    decisionRevision: DECISION_REVISION,
    sourceRevisions: {
      auth: 'auth-v261',
      policy: 'product-authorization-v52',
      productRelationship: 'product-relationship-v52',
      targetPopulation: 'target-population-v52',
      support: 'support-v52',
      tenantControl: 'tenant-control-v52',
    },
    activeAccessMode: 'NORMAL',
    generatedAt: times.generatedAt,
    contexts: authorityContexts(times.revalidateAt),
    rollouts: PRODUCT_KEYS.map((productKey) =>
      productKey === 'hcm'
        ? {
            productKey,
            state: '111',
            flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: true },
            cohort: 'hrm009-browser-gate-v52-read-only',
            opaqueRevision: 'hrm009-browser-gate-v52-read-only-r1',
            authorityStatus: 'AVAILABLE',
          }
        : baselineRollout(productKey)
    ),
  };
}

function contextForSurface(surfaceKey, revalidateAt) {
  return authorityContexts(revalidateAt).find((context) => context.surfaceKey === surfaceKey);
}

function denial(response, decision, reasonCode) {
  success(response, { decision, reasonCode, decisionRevision: DECISION_REVISION });
}

async function evaluateAuthority(request, response) {
  let body;
  try {
    body = await readJson(request, MAX_EVALUATION_BODY_BYTES);
  } catch {
    counters.unexpectedAuthorityEvaluations += 1;
    recordEvent('AUTHORITY_EVALUATION_REJECTED', { reasonCode: 'INVALID_REQUEST_BODY' });
    failure(response, 400, 'Authority evaluation request is invalid.', 'INVALID_REQUEST_BODY');
    return;
  }
  const routeContractKey = typeof body?.routeContractKey === 'string' ? body.routeContractKey : '';
  const contract = CONTRACTS[routeContractKey];
  const subject = body?.subject;
  const surfaceKey = typeof subject?.surfaceKey === 'string' ? subject.surfaceKey : '';
  const expectedScope = surfaceKey === 'hcm.personal' ? PERSONAL_SCOPE : OPERATIONS_SCOPE;
  const contextScopeKey =
    typeof body?.contextScopeKey === 'string' ? body.contextScopeKey : undefined;

  if (
    !contract ||
    subject?.type !== 'PRODUCT' ||
    subject?.productKey !== 'hcm' ||
    contract.surfaceKey !== surfaceKey
  ) {
    counters.unexpectedAuthorityEvaluations += 1;
    recordEvent('AUTHORITY_EVALUATION_REJECTED', {
      routeContractKey: routeContractKey || null,
      surfaceKey: surfaceKey || null,
      reasonCode: 'ROUTE_NOT_ALLOWLISTED',
    });
    denial(response, 'ROUTE_DENIED', 'ROUTE_CAPABILITY_REQUIRED');
    return;
  }
  if (contextScopeKey !== undefined && contextScopeKey !== expectedScope.key) {
    counters.unexpectedAuthorityEvaluations += 1;
    recordEvent('AUTHORITY_EVALUATION_REJECTED', {
      routeContractKey,
      surfaceKey,
      contextScopeKey,
      reasonCode: 'SCOPE_MISMATCH',
    });
    denial(response, 'SCOPE_INVALID', 'SCOPE_CONTEXT_EXPIRED');
    return;
  }

  const { revalidateAt } = freshAuthorityTimes();
  const context = contextForSurface(surfaceKey, revalidateAt);
  counters[contract.kind === 'PAGE' ? 'pageEvaluations' : 'dataEvaluations'][routeContractKey] += 1;
  recordEvent(`${contract.kind}_EVALUATION_ALLOWED`, {
    routeContractKey,
    surfaceKey,
    contextScopeKey: expectedScope.key,
  });
  success(response, {
    decision: 'ALLOWED',
    reasonCode: null,
    decisionRevision: DECISION_REVISION,
    context,
    routeGrantRef: `grant:${routeContractKey}:v52`,
    scope: expectedScope,
    effectiveReadOnly: true,
    validUntil: null,
    revalidateAt,
  });
}

function action(actionKey, hrefTemplate) {
  return {
    actionKey,
    method: 'POST',
    hrefTemplate,
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  };
}

function personalItem() {
  return {
    itemPublicId: 'request:1001',
    title:
      'Employment and long-form certificate request for a globally mobile employee with an intentionally long Korean and English label 증명서 요청',
    statusCode: 'RUNNING',
    fieldGroups: {
      REQUEST_SUMMARY: {
        decision: 'VIEW',
        value: { itemCount: 1, revision: 2, asOf: AS_OF },
      },
      REQUEST_STATUS: { decision: 'VIEW', value: { code: 'RUNNING', revision: 3 } },
      COMMAND_RECEIPT: {
        decision: 'VIEW',
        value: {
          receiptId: '33333333-3333-4333-8333-333333333333',
          state: 'ACCEPTED',
          occurredAt: AS_OF,
          revision: 1,
        },
      },
    },
    deepLink: { route: '/hr/me/requests', resourcePublicId: 'request:1001' },
    availableActions: [
      action(
        'hris.action.hrm.create-employee-change-request',
        '/api/people/v1/hris/employee-change-requests'
      ),
      action(
        'hris.action.hrm.submit-employee-change-request',
        '/api/people/v1/hris/employee-change-requests/{requestPublicId}/submit'
      ),
      action('hris.action.hrm.request-certificate', '/api/people/v1/hris/certificates'),
    ],
  };
}

function operationsItem() {
  return {
    itemPublicId: 'certificate:1001',
    title:
      'Authorized certificate metadata requiring an issuance decision with a deliberately long bilingual label 인증서 메타데이터 검토',
    statusCode: 'ISSUED',
    fieldGroups: {
      CERTIFICATE_METADATA: {
        decision: 'VIEW',
        value: { key: 'certificate:employment', version: 'v1', digest: null },
      },
      DOCUMENT_METADATA: {
        decision: 'VIEW',
        value: { key: 'document:employment', version: 'v2', digest: 'a'.repeat(64) },
      },
    },
    deepLink: {
      route: '/hr/operations/people/certificates-documents',
      resourcePublicId: 'certificate:1001',
    },
    availableActions: [
      action('hris.action.hrm.request-certificate', '/api/people/v1/hris/certificates'),
    ],
  };
}

function projection(surface, scenario, correlationId) {
  const personal = surface === 'personal';
  const unavailable = scenario === 'UNAVAILABLE';
  const empty = scenario === 'EMPTY' || unavailable;
  const item = personal ? personalItem() : operationsItem();
  const viewCount = empty ? 0 : personal ? 3 : 2;
  return {
    projectionVersion: '1',
    asOf: AS_OF,
    variantKey: personal ? 'REQUESTS' : 'CERTIFICATES_DOCUMENTS',
    queryState: {
      state: scenario,
      scopeDecisionRevision: DECISION_REVISION,
      freshness: unavailable ? 'UNAVAILABLE' : 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount, maskedCount: 0, omittedCount: 0 },
      partialFailures:
        scenario === 'PARTIAL'
          ? [
              {
                componentKey: 'certificate.metadata',
                errorCode: 'OWNER_TEMPORARILY_UNAVAILABLE',
                correlationId: '44444444-4444-4444-8444-444444444444',
                retryable: true,
              },
            ]
          : [],
      correlationId,
      cachePolicy: {
        authorizationDecisionRevision: DECISION_REVISION,
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: empty ? [] : [item],
  };
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function serveOwnerProjection(request, response, url, surface) {
  const expectedScope = surface === 'personal' ? PERSONAL_SCOPE.key : OPERATIONS_SCOPE.key;
  const contextScopeKey = url.searchParams.get('contextScopeKey') ?? '';
  const correlationId = url.searchParams.get('correlationId') ?? '';
  const ownerPath = surface === 'personal' ? PERSONAL_OWNER_PATH : OPERATIONS_OWNER_PATH;
  if (contextScopeKey !== expectedScope || !validUuid(correlationId)) {
    recordEvent('OWNER_GET_REJECTED', {
      path: ownerPath,
      surface,
      reasonCode: contextScopeKey !== expectedScope ? 'SCOPE_MISMATCH' : 'CORRELATION_INVALID',
    });
    failure(response, 400, 'Owner query scope is invalid.', 'OWNER_QUERY_SCOPE_INVALID');
    return;
  }
  counters.ownerGets[ownerPath] += 1;
  recordEvent('OWNER_GET_ALLOWED', {
    path: ownerPath,
    surface,
    contextScopeKey,
    scenario: scenarios[surface],
  });
  success(response, projection(surface, scenarios[surface], correlationId));
}

function mutationTarget(pathname) {
  return (
    pathname === CERTIFICATE_MUTATION_PREFIX ||
    pathname.startsWith(`${CERTIFICATE_MUTATION_PREFIX}/`) ||
    pathname === EMPLOYEE_CHANGE_MUTATION_PREFIX ||
    pathname.startsWith(`${EMPLOYEE_CHANGE_MUTATION_PREFIX}/`) ||
    pathname === PERSONAL_OWNER_PATH ||
    pathname === OPERATIONS_OWNER_PATH
  );
}

function denyMutation(request, response, pathname) {
  request.resume();
  const key = `${request.method} ${pathname}`;
  counters.mutations[key] = (counters.mutations[key] ?? 0) + 1;
  recordEvent('HRM009_MUTATION_DENIED', { method: request.method, path: pathname });
  response.setHeader('Allow', 'GET');
  failure(response, 405, 'HRM-009 browser-gate fixture is read only.', 'METHOD_NOT_ALLOWED');
}

function denyStepUp(request, response, pathname) {
  request.resume();
  counters.stepUpRequests += 1;
  recordEvent('HRM009_STEP_UP_DENIED', { method: request.method, path: pathname });
  failure(response, 403, 'HRM-009 step-up is not authorized in the read-only gate.', 'FORBIDDEN');
}

function logSnapshot() {
  return {
    schemaVersion: '1',
    fixture: 'HRIS_HRM_009_READ_ONLY_BROWSER_GATE_V52',
    decisionRevision: DECISION_REVISION,
    upstream: UPSTREAM.origin,
    scenarios: { ...scenarios },
    sequence,
    counters: structuredClone(counters),
    events: events.map((event) => ({ ...event })),
  };
}

async function control(request, response, url) {
  const operation = url.pathname.slice(CONTROL_PREFIX.length) || '/health';
  if (request.method === 'GET' && operation === '/health') {
    json(response, 200, {
      status: 'UP',
      fixture: 'HRIS_HRM_009_READ_ONLY_BROWSER_GATE_V52',
      host: HOST,
      port: PORT,
    });
    return;
  }
  if (request.method === 'GET' && operation === '/log') {
    json(response, 200, logSnapshot());
    return;
  }
  if (request.method === 'GET' && operation === '/scenario') {
    json(response, 200, { ...scenarios });
    return;
  }
  if (request.method === 'POST' && operation === '/reset') {
    request.resume();
    resetState();
    json(response, 200, logSnapshot());
    return;
  }
  if (request.method === 'POST' && operation === '/scenario') {
    let body;
    try {
      body = await readJson(request, MAX_CONTROL_BODY_BYTES);
    } catch {
      failure(response, 400, 'Scenario control is invalid.', 'INVALID_SCENARIO');
      return;
    }
    const personal = body?.personal ?? scenarios.personal;
    const operations = body?.operations ?? scenarios.operations;
    if (!SCENARIOS.has(personal) || !SCENARIOS.has(operations)) {
      failure(response, 400, 'Scenario control is invalid.', 'INVALID_SCENARIO');
      return;
    }
    scenarios = { personal, operations };
    json(response, 200, { ...scenarios });
    return;
  }
  failure(response, 404, 'Fixture control endpoint was not found.', 'NOT_FOUND');
}

function forward(request, response) {
  const headers = { ...request.headers, host: UPSTREAM.host };
  const upstreamRequest = http.request(
    {
      protocol: UPSTREAM.protocol,
      hostname: UPSTREAM.hostname,
      port: UPSTREAM.port,
      method: request.method,
      path: request.url,
      headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    }
  );
  upstreamRequest.setTimeout(30_000, () => {
    upstreamRequest.destroy(new Error('UPSTREAM_TIMEOUT'));
  });
  upstreamRequest.on('error', () => {
    if (!response.headersSent) {
      failure(response, 502, 'Local dwp-dev gateway is unavailable.', 'UPSTREAM_UNAVAILABLE');
    } else {
      response.destroy();
    }
  });
  request.on('aborted', () => upstreamRequest.destroy());
  request.pipe(upstreamRequest);
}

const server = http.createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  if (pathname.startsWith(CONTROL_PREFIX)) {
    await control(request, response, url);
    return;
  }
  if (method === 'GET' && pathname === CONTEXTS_PATH) {
    success(response, authorityEnvelope());
    return;
  }
  if (method === 'POST' && pathname === EVALUATION_PATH) {
    await evaluateAuthority(request, response);
    return;
  }
  if (pathname.startsWith(STEP_UP_PREFIX)) {
    denyStepUp(request, response, pathname);
    return;
  }
  if (MUTATION_METHODS.has(method) && mutationTarget(pathname)) {
    denyMutation(request, response, pathname);
    return;
  }
  if (method === 'GET' && pathname === PERSONAL_OWNER_PATH) {
    serveOwnerProjection(request, response, url, 'personal');
    return;
  }
  if (method === 'GET' && pathname === OPERATIONS_OWNER_PATH) {
    serveOwnerProjection(request, response, url, 'operations');
    return;
  }
  forward(request, response);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `HRM-009 read-only browser gate fixture listening on http://${HOST}:${PORT}\n`
  );
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
