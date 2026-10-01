import path from 'node:path';

export const HRIS_W1_LIVE_ACK = 'LOCAL_SYNTHETIC_ONLY' as const;

const LOCAL_PROTOCOL = 'http:';
const LOCAL_HOST = '127.0.0.1';
const SAFE_ACCOUNT_SUFFIXES = [
  '@dwp.local',
  '@dwp.test',
  '@example.invalid',
  '@localhost.invalid',
  '@test.invalid',
] as const;
const OUTCOMES = new Set(['allowed', 'denied', 'authority-unavailable', 'redirected']);
const ACCESS_STATES = new Set([
  'app-denied',
  'surface-denied',
  'route-denied',
  'scope-selection-required',
  'scope-invalid',
  'expired',
  'activation-required',
  'step-up-required',
  'sod-conflict',
  'support-scope-denied',
  'authority-unavailable',
]);
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export const HRIS_W1_MODULES = ['HRM', 'PER', 'PAY', 'TIM', 'SYS'] as const;
export const HRIS_W1_HIGH_RISK_EVALUATION_PATH =
  '/api/auth/product-surface-access/evaluate' as const;

export type HrisW1Module = (typeof HRIS_W1_MODULES)[number];

const CANONICAL_MODULE_ROUTES: Readonly<
  Record<
    HrisW1Module,
    Readonly<{ path: string; pageRouteContractKey: string; marker: string; apiPath: string }>
  >
> = {
  HRM: {
    path: '/hr/operations/people',
    pageRouteContractKey: 'route.hcm.operations.people.page',
    marker: 'input[aria-label="Search people"]',
    apiPath: '/api/people/v1/workforce/people',
  },
  PER: {
    path: '/hr/talent',
    pageRouteContractKey: 'route.hcm.personal.talent.page',
    marker: '[data-route="/hr/talent"][data-scope="personal-goal-progress"]',
    apiPath: '/api/people/v1/hr/talent',
  },
  PAY: {
    path: '/hr/pay',
    pageRouteContractKey: 'route.hcm.personal.pay.page',
    marker: '[data-testid="hris-payroll-workspace"]',
    apiPath: '/api/people/v1/hr/pay',
  },
  TIM: {
    path: '/hr/time',
    pageRouteContractKey: 'route.hcm.personal.time.page',
    marker: '[data-testid="hris-query-state"][data-query-state="ready"]',
    apiPath: '/api/people/v1/hr/time',
  },
  SYS: {
    path: '/hr/home',
    pageRouteContractKey: 'route.hcm.personal.home.page',
    marker: '[data-testid="hcm-home-overview"]',
    apiPath: '/api/people/v1/hr/home',
  },
};

// Exact HCM projection of PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG. Keep this parser boundary
// dependency-free so the Playwright config can fail closed before Vite starts.
const HCM_HIGH_OPERATION_BINDINGS = [
  ['HCM_ORG_PUBLISH', 'hcm.management', 'route.hcm.management.org-publish.action', 'SYS'],
  [
    'HCM_EXPORT_CREATE',
    'hcm.management',
    'route.hcm.management.controlled-export-create.action',
    'SYS',
  ],
  [
    'HCM_EXPORT_RETRY',
    'hcm.management',
    'route.hcm.management.controlled-export-retry.action',
    'SYS',
  ],
  [
    'HCM_INTEGRATION_CONFIGURATION_CHECK',
    'hcm.management',
    'route.hcm.management.integration-execute.action',
    'SYS',
  ],
  [
    'HCM_INTEGRATION_EXECUTE',
    'hcm.management',
    'route.hcm.management.integration-execute.action',
    'SYS',
  ],
  [
    'HCM_INTEGRATION_RETRY',
    'hcm.management',
    'route.hcm.management.integration-execute.action',
    'SYS',
  ],
  [
    'HCM_INTEGRATION_RECONCILE',
    'hcm.management',
    'route.hcm.management.integration-execute.action',
    'SYS',
  ],
  [
    'HCM_PERFORMANCE_CYCLE_PUBLISH',
    'hcm.operations',
    'route.hcm.operations.performance-cycle-publish.action',
    'PER',
  ],
  [
    'HCM_PAYROLL_FOUNDATION_PUBLISH',
    'hcm.operations',
    'route.hcm.operations.payroll-foundation-publish.action',
    'PAY',
  ],
  [
    'HCM_PAYROLL_FOUNDATION_REVERSE',
    'hcm.operations',
    'route.hcm.operations.payroll-foundation-reverse.action',
    'PAY',
  ],
] as const;

export type HrisW1ApiExpectation = Readonly<{
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  statuses: readonly number[];
}>;

export type HrisW1HighRiskPreview = Readonly<{
  clickSelectors: readonly string[];
  dialogSelector: string;
  dialogText: string;
  allowedRequestPaths: readonly string[];
  expectedRouteContractKey: string;
  expectedOperation: string;
  expectedProductKey: 'hcm';
  expectedSurfaceKey: string;
}>;

export type HrisW1RouteCase = Readonly<{
  id: string;
  module: HrisW1Module;
  pageRouteContractKey: string;
  path: string;
  outcome: 'allowed' | 'denied' | 'authority-unavailable' | 'redirected';
  marker?: string;
  expectedScopeKey?: string;
  accessStates: readonly string[];
  redirectPath?: string;
  api: readonly HrisW1ApiExpectation[];
  highRiskPreview?: HrisW1HighRiskPreview;
}>;

export type HrisW1Tenant = Readonly<{
  label: 'tenant-a' | 'tenant-b';
  tenantId: string;
  email: string;
  password: string;
  expectedRolloutState: '111' | '000';
  expectedAuthorityStatus: 'AVAILABLE' | 'NOT_EVALUATED';
  routes: readonly HrisW1RouteCase[];
}>;

export type HrisW1LiveEnvironment = Readonly<{
  runId: string;
  baseURL: string;
  gatewayURL: string;
  artifactRoot: string;
  assertionTimeoutMs: number;
  tenants: readonly [HrisW1Tenant, HrisW1Tenant];
}>;

function fail(message: string): never {
  throw new Error(`HRIS W1 live acceptance configuration rejected: ${message}`);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  return value || fail(`${name} is required`);
}

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is required`);
  if (value.trim() !== value) fail(`${name} cannot start or end with whitespace`);
  return value;
}

function object(value: unknown, location: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${location} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], location: string) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) fail(`${location} contains unsupported keys: ${extras.join(', ')}`);
}

function nonBlankString(value: unknown, location: string, maximum = 240): string {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > maximum ||
    /[\r\n]/u.test(value)
  ) {
    fail(`${location} must be a non-blank single-line string no longer than ${maximum} characters`);
  }
  return value;
}

function localURL(name: string, options: { trailingSlash: boolean }): URL {
  let parsed: URL;
  try {
    parsed = new URL(required(name));
  } catch {
    return fail(`${name} must be an absolute URL`);
  }
  const port = Number(parsed.port);
  const validPath = options.trailingSlash
    ? parsed.pathname === '/'
    : /^\/?$/u.test(parsed.pathname);
  if (
    parsed.protocol !== LOCAL_PROTOCOL ||
    parsed.hostname !== LOCAL_HOST ||
    !Number.isSafeInteger(port) ||
    port < 1024 ||
    port > 65_535 ||
    !validPath ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    fail(
      `${name} must be an uncredentialed http://127.0.0.1:<port>${
        options.trailingSlash ? '/' : ''
      } URL`
    );
  }
  if (options.trailingSlash) parsed.pathname = '/';
  else parsed.pathname = '';
  return parsed;
}

function safeAppPath(value: unknown, location: string): string {
  const candidate = nonBlankString(value, location, 512);
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('#')) {
    fail(`${location} must be an origin-relative path without a fragment`);
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate, 'http://127.0.0.1');
  } catch {
    return fail(`${location} is not a valid path`);
  }
  if (parsed.origin !== 'http://127.0.0.1') fail(`${location} must remain on localhost`);
  return `${parsed.pathname}${parsed.search}`;
}

function safeHrisPath(value: unknown, location: string): string {
  const candidate = safeAppPath(value, location);
  const pathname = new URL(candidate, 'http://127.0.0.1').pathname;
  if (pathname !== '/hr' && !pathname.startsWith('/hr/')) {
    fail(`${location} must target an /hr route`);
  }
  return candidate;
}

function safeApiPath(value: unknown, location: string): string {
  const candidate = safeAppPath(value, location);
  const parsed = new URL(candidate, 'http://127.0.0.1');
  if (!parsed.pathname.startsWith('/api/') || parsed.search) {
    fail(`${location} must be an exact /api/ path without a query`);
  }
  return parsed.pathname;
}

function stringArray(value: unknown, location: string): string[] {
  if (!Array.isArray(value)) fail(`${location} must be an array`);
  return value.map((item, index) => nonBlankString(item, `${location}[${index}]`));
}

function concreteMarker(value: unknown, location: string): string {
  const marker = nonBlankString(value, location, 160);
  const stableId = /#[a-zA-Z][a-zA-Z0-9_-]*/u;
  const stableAttribute = /\[[a-zA-Z][a-zA-Z0-9_-]*=(?:"[^"]+"|'[^']+')\]/u;
  if (!stableId.test(marker) && !stableAttribute.test(marker)) {
    fail(`${location} must contain an exact #id or attribute equality selector`);
  }
  return marker;
}

function parseApiExpectation(value: unknown, location: string): HrisW1ApiExpectation {
  const candidate = object(value, location);
  exactKeys(candidate, ['path', 'method', 'statuses'], location);
  const method = nonBlankString(candidate.method, `${location}.method`).toUpperCase();
  if (!HTTP_METHODS.has(method)) fail(`${location}.method is unsupported`);
  if (!Array.isArray(candidate.statuses) || candidate.statuses.length === 0) {
    fail(`${location}.statuses must contain at least one exact HTTP status`);
  }
  const statuses = candidate.statuses.map((status, index) => {
    if (!Number.isSafeInteger(status) || Number(status) < 100 || Number(status) > 599) {
      fail(`${location}.statuses[${index}] must be an HTTP status`);
    }
    return Number(status);
  });
  return {
    path: safeApiPath(candidate.path, `${location}.path`),
    method: method as HrisW1ApiExpectation['method'],
    statuses,
  };
}

function parseHighRiskPreview(
  value: unknown,
  location: string,
  module: HrisW1Module,
  pageRouteContractKey: string
): HrisW1HighRiskPreview {
  const candidate = object(value, location);
  exactKeys(
    candidate,
    [
      'clickSelectors',
      'dialogSelector',
      'dialogText',
      'allowedRequestPaths',
      'expectedRouteContractKey',
      'expectedOperation',
    ],
    location
  );
  const clickSelectors = stringArray(candidate.clickSelectors, `${location}.clickSelectors`);
  if (clickSelectors.length === 0 || clickSelectors.length > 2) {
    fail(`${location}.clickSelectors must contain one or two preview-only clicks`);
  }
  const allowedRequestPaths = stringArray(
    candidate.allowedRequestPaths,
    `${location}.allowedRequestPaths`
  ).map((item, index) => safeApiPath(item, `${location}.allowedRequestPaths[${index}]`));
  if (
    allowedRequestPaths.length !== 1 ||
    allowedRequestPaths[0] !== HRIS_W1_HIGH_RISK_EVALUATION_PATH
  ) {
    fail(
      `${location}.allowedRequestPaths must contain exactly ${HRIS_W1_HIGH_RISK_EVALUATION_PATH}`
    );
  }
  const expectedRouteContractKey = nonBlankString(
    candidate.expectedRouteContractKey,
    `${location}.expectedRouteContractKey`
  );
  if (
    !/^route\.hcm\.(?:operations|management)\.[a-z0-9-]+\.action$/u.test(expectedRouteContractKey)
  ) {
    fail(`${location}.expectedRouteContractKey must be an exact HCM ACTION route contract key`);
  }
  const expectedOperation = nonBlankString(
    candidate.expectedOperation,
    `${location}.expectedOperation`
  );
  if (!/^HCM_[A-Z0-9_]+$/u.test(expectedOperation)) {
    fail(`${location}.expectedOperation must be an exact HCM_* operation`);
  }
  const operationBindings = HCM_HIGH_OPERATION_BINDINGS.filter(
    ([operation]) => operation === expectedOperation
  );
  if (operationBindings.length !== 1) {
    fail(`${location}.expectedOperation must resolve one canonical HCM HIGH binding`);
  }
  const operationBinding = operationBindings[0]!;
  if (operationBinding[2] !== expectedRouteContractKey) {
    fail(
      `${location}.expectedOperation must map to ${expectedRouteContractKey} in the canonical HIGH catalog`
    );
  }
  if (operationBinding[3] !== module) {
    fail(`${location}.expectedOperation is not canonical for module ${module}`);
  }
  if (`hcm.${pageRouteContractKey.split('.')[2]}` !== operationBinding[1]) {
    fail(`${location}.expectedOperation must use the same surface as pageRouteContractKey`);
  }
  const indistinguishableBindings = HCM_HIGH_OPERATION_BINDINGS.filter(
    ([, surfaceKey, routeContractKey]) =>
      surfaceKey === operationBinding[1] && routeContractKey === operationBinding[2]
  );
  if (indistinguishableBindings.length !== 1) {
    fail(
      `${location}.expectedOperation cannot be uniquely attested by the live authority wire contract`
    );
  }
  return {
    clickSelectors,
    dialogSelector: nonBlankString(candidate.dialogSelector, `${location}.dialogSelector`),
    dialogText: nonBlankString(candidate.dialogText, `${location}.dialogText`),
    allowedRequestPaths,
    expectedRouteContractKey,
    expectedOperation,
    expectedProductKey: 'hcm',
    expectedSurfaceKey: operationBinding[1],
  };
}

function parseRoute(value: unknown, location: string): HrisW1RouteCase {
  const candidate = object(value, location);
  exactKeys(
    candidate,
    [
      'id',
      'module',
      'pageRouteContractKey',
      'path',
      'outcome',
      'marker',
      'expectedScopeKey',
      'accessStates',
      'redirectPath',
      'api',
      'highRiskPreview',
    ],
    location
  );
  const id = nonBlankString(candidate.id, `${location}.id`, 64);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(id)) fail(`${location}.id must be lowercase kebab-case`);
  const module = nonBlankString(candidate.module, `${location}.module`) as HrisW1Module;
  if (!HRIS_W1_MODULES.includes(module)) {
    fail(`${location}.module must be one of ${HRIS_W1_MODULES.join(', ')}`);
  }
  const pageRouteContractKey = nonBlankString(
    candidate.pageRouteContractKey,
    `${location}.pageRouteContractKey`
  );
  if (
    !/^route\.hcm\.(?:personal|team|operations|management)\.[a-z0-9-]+\.page$/u.test(
      pageRouteContractKey
    )
  ) {
    fail(`${location}.pageRouteContractKey must be an exact HCM PAGE route contract key`);
  }
  const outcome = nonBlankString(candidate.outcome, `${location}.outcome`);
  if (!OUTCOMES.has(outcome)) fail(`${location}.outcome is unsupported`);
  const accessStates =
    candidate.accessStates === undefined
      ? []
      : stringArray(candidate.accessStates, `${location}.accessStates`);
  if (accessStates.some((state) => !ACCESS_STATES.has(state))) {
    fail(`${location}.accessStates contains an unsupported product access state`);
  }
  if ((outcome === 'denied' || outcome === 'authority-unavailable') && accessStates.length === 0) {
    fail(`${location}.accessStates is required for ${outcome}`);
  }
  if (outcome === 'authority-unavailable' && !accessStates.includes('authority-unavailable')) {
    fail(`${location}.accessStates must include authority-unavailable`);
  }
  const redirectPath =
    candidate.redirectPath === undefined
      ? undefined
      : safeAppPath(candidate.redirectPath, `${location}.redirectPath`);
  if ((outcome === 'redirected') !== Boolean(redirectPath)) {
    fail(`${location}.redirectPath is required only for redirected outcomes`);
  }
  const api = candidate.api === undefined ? [] : candidate.api;
  if (!Array.isArray(api)) fail(`${location}.api must be an array`);
  const highRiskPreview =
    candidate.highRiskPreview === undefined
      ? undefined
      : parseHighRiskPreview(
          candidate.highRiskPreview,
          `${location}.highRiskPreview`,
          module,
          pageRouteContractKey
        );
  const parsedApi = api.map((item, index) =>
    parseApiExpectation(item, `${location}.api[${index}]`)
  );
  const marker =
    candidate.marker === undefined
      ? undefined
      : concreteMarker(candidate.marker, `${location}.marker`);
  const expectedScopeKey =
    candidate.expectedScopeKey === undefined
      ? undefined
      : nonBlankString(candidate.expectedScopeKey, `${location}.expectedScopeKey`, 160);
  if (outcome === 'allowed' && !marker) {
    fail(`${location}.marker is required for an allowed route`);
  }
  if (outcome === 'allowed' && parsedApi.length === 0) {
    fail(`${location}.api must contain at least one real 2xx response for an allowed route`);
  }
  if (outcome === 'allowed' && !expectedScopeKey) {
    fail(`${location}.expectedScopeKey is required for an allowed canonicalized route`);
  }
  if (outcome !== 'allowed' && expectedScopeKey) {
    fail(`${location}.expectedScopeKey is only valid for an allowed route`);
  }
  if (
    outcome === 'allowed' &&
    parsedApi.some((expectation) =>
      expectation.statuses.some((status) => status < 200 || status > 299)
    )
  ) {
    fail(`${location}.api statuses must all be 2xx for an allowed route`);
  }
  if (highRiskPreview && outcome !== 'allowed') {
    fail(`${location}.highRiskPreview requires an allowed route`);
  }
  if (
    highRiskPreview &&
    !parsedApi.some(
      (expectation) =>
        expectation.method === 'POST' &&
        expectation.path === HRIS_W1_HIGH_RISK_EVALUATION_PATH &&
        expectation.statuses.length === 1 &&
        expectation.statuses[0] === 200
    )
  ) {
    fail(
      `${location}.api must include exactly POST ${HRIS_W1_HIGH_RISK_EVALUATION_PATH} with statuses [200]`
    );
  }
  return {
    id,
    module,
    pageRouteContractKey,
    path: safeHrisPath(candidate.path, `${location}.path`),
    outcome: outcome as HrisW1RouteCase['outcome'],
    ...(marker ? { marker } : {}),
    ...(expectedScopeKey ? { expectedScopeKey } : {}),
    accessStates,
    ...(redirectPath ? { redirectPath } : {}),
    api: parsedApi,
    ...(highRiskPreview ? { highRiskPreview } : {}),
  };
}

function parseRoutes(name: string, label: HrisW1Tenant['label']): HrisW1RouteCase[] {
  let value: unknown;
  try {
    value = JSON.parse(required(name));
  } catch {
    return fail(`${name} must be valid JSON`);
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    fail(`${name} must contain between one and twelve route cases`);
  }
  const routes = value.map((item, index) => parseRoute(item, `${name}[${index}]`));
  if (new Set(routes.map((route) => route.id)).size !== routes.length) {
    fail(`${name} route ids must be unique`);
  }
  const coveredModules = new Set(routes.map((route) => route.module));
  const missingModules = HRIS_W1_MODULES.filter((module) => !coveredModules.has(module));
  if (missingModules.length > 0) {
    fail(`${name} must cover every W1 module; missing ${missingModules.join(', ')}`);
  }
  for (const module of HRIS_W1_MODULES) {
    const canonical = CANONICAL_MODULE_ROUTES[module];
    const matches = routes.filter(
      (route) =>
        route.module === module &&
        new URL(route.path, 'http://127.0.0.1').pathname === canonical.path &&
        route.pageRouteContractKey === canonical.pageRouteContractKey
    );
    if (matches.length === 0) {
      fail(
        `${name} must bind ${module} to ${canonical.path} and ${canonical.pageRouteContractKey}`
      );
    }
    if (label === 'tenant-a') {
      const allowed = matches.find((route) => route.outcome === 'allowed');
      if (!allowed) fail(`${name} must allow the canonical ${module} route`);
      if (allowed.marker !== canonical.marker) {
        fail(`${name} canonical ${module} marker must equal ${canonical.marker}`);
      }
      if (
        !allowed.api.some(
          (api) =>
            api.method === 'GET' &&
            api.path === canonical.apiPath &&
            api.statuses.every((status) => status >= 200 && status <= 299)
        )
      ) {
        fail(`${name} canonical ${module} route must verify a 2xx GET ${canonical.apiPath}`);
      }
    } else if (
      matches.some((route) => route.outcome !== 'redirected' || route.redirectPath !== '/403')
    ) {
      fail(`${name} canonical ${module} route must redirect to /403 while tenant B rollout is off`);
    }
  }
  if (label === 'tenant-a') {
    if (!routes.some((route) => route.outcome === 'allowed' && !route.highRiskPreview)) {
      fail(`${name} must contain an allowed happy-path route`);
    }
    if (!routes.some((route) => route.highRiskPreview)) {
      fail(`${name} must contain a non-dispatching high-risk preview`);
    }
    if (!routes.some((route) => route.outcome === 'denied')) {
      fail(`${name} must contain an explicit denied route`);
    }
  } else {
    if (routes.some((route) => route.outcome === 'allowed' || route.highRiskPreview)) {
      fail(`${name} cannot claim allowed/high-risk behavior while tenant B rollout is off`);
    }
    if (!routes.some((route) => route.outcome === 'redirected' && route.redirectPath === '/403')) {
      fail(`${name} must contain an explicit /403 denial while tenant B rollout is off`);
    }
  }
  return routes;
}

function tenant(
  label: HrisW1Tenant['label'],
  prefix: 'HRIS_W1_TENANT_A' | 'HRIS_W1_TENANT_B'
): HrisW1Tenant {
  const tenantId = required(`${prefix}_ID`);
  if (!/^[1-9][0-9]{0,17}$/u.test(tenantId) || !Number.isSafeInteger(Number(tenantId))) {
    fail(`${prefix}_ID must be a positive safe integer`);
  }
  const email = required(`${prefix}_EMAIL`).toLowerCase();
  if (
    !/^[a-z0-9][a-z0-9._+-]*@/u.test(email) ||
    !SAFE_ACCOUNT_SUFFIXES.some((suffix) => email.endsWith(suffix))
  ) {
    fail(`${prefix}_EMAIL must use an explicitly synthetic/local account suffix`);
  }
  const password = requiredSecret(`${prefix}_PASSWORD`);
  if (password.length < 12 || password.length > 256 || /[\r\n]/u.test(password)) {
    fail(`${prefix}_PASSWORD must be a 12-256 character single-line synthetic secret`);
  }
  return {
    label,
    tenantId,
    email,
    password,
    expectedRolloutState: label === 'tenant-a' ? '111' : '000',
    expectedAuthorityStatus: label === 'tenant-a' ? 'AVAILABLE' : 'NOT_EVALUATED',
    routes: parseRoutes(`${prefix}_ROUTES_JSON`, label),
  };
}

export function loadHrisW1LiveEnvironment(): HrisW1LiveEnvironment {
  if (required('HRIS_W1_LIVE_ACK') !== HRIS_W1_LIVE_ACK) {
    fail(`HRIS_W1_LIVE_ACK must equal ${HRIS_W1_LIVE_ACK}`);
  }
  const runId = required('HRIS_W1_LIVE_RUN_ID');
  if (!/^[a-z0-9][a-z0-9-]{7,63}$/u.test(runId)) {
    fail('HRIS_W1_LIVE_RUN_ID must be an 8-64 character lowercase run id');
  }
  const base = localURL('HRIS_W1_LIVE_BASE_URL', { trailingSlash: true });
  const gateway = localURL('HRIS_W1_LIVE_GATEWAY_URL', { trailingSlash: false });
  if (base.origin === gateway.origin) {
    fail('frontend and Gateway must use different explicitly owned localhost ports');
  }
  const artifactRoot = path.resolve(required('HRIS_W1_LIVE_ARTIFACT_DIR'));
  if (!path.isAbsolute(required('HRIS_W1_LIVE_ARTIFACT_DIR'))) {
    fail('HRIS_W1_LIVE_ARTIFACT_DIR must be absolute');
  }
  if (path.basename(artifactRoot) !== `hris-w1-live-browser-${runId}`) {
    fail('HRIS_W1_LIVE_ARTIFACT_DIR basename must bind exactly to HRIS_W1_LIVE_RUN_ID');
  }
  if (path.dirname(artifactRoot) === path.parse(artifactRoot).root) {
    fail('HRIS_W1_LIVE_ARTIFACT_DIR cannot be created directly under the filesystem root');
  }
  const timeoutValue = process.env.HRIS_W1_LIVE_ASSERTION_TIMEOUT_MS?.trim() || '45000';
  const assertionTimeoutMs = Number(timeoutValue);
  if (
    !/^[0-9]+$/u.test(timeoutValue) ||
    !Number.isSafeInteger(assertionTimeoutMs) ||
    assertionTimeoutMs < 10_000 ||
    assertionTimeoutMs > 120_000
  ) {
    fail('HRIS_W1_LIVE_ASSERTION_TIMEOUT_MS must be an integer between 10000 and 120000');
  }
  const tenantA = tenant('tenant-a', 'HRIS_W1_TENANT_A');
  const tenantB = tenant('tenant-b', 'HRIS_W1_TENANT_B');
  if (tenantA.tenantId === tenantB.tenantId) fail('tenant A and tenant B ids must be distinct');
  return {
    runId,
    baseURL: base.href,
    gatewayURL: gateway.origin,
    artifactRoot,
    assertionTimeoutMs,
    tenants: [tenantA, tenantB],
  };
}
