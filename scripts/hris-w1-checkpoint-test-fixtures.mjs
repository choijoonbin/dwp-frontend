export const RUN_ID = 'w1-20261002t000000z-deadbeef';

const EVIDENCE_DIR = '/tmp/hris-w1-checkpoint-unit';

export function uuid(prefix, suffix) {
  return `${prefix}0000000-0000-4000-8000-${suffix.toString().padStart(12, '0')}`;
}

function tenantEnvironment(lane, prefix, numericOffset) {
  const populationFieldGroups =
    lane === 'A'
      ? 'DIRECTORY, EMPLOYMENT, JOB_GRADE, WORKER_IDENTIFIERS'
      : 'DIRECTORY, EMPLOYMENT, WORKER_IDENTIFIERS';
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
    [`DWP_W1_TENANT_${lane}_TARGET_POPULATION_REVISION`]: `${prefix.repeat(32)}:true|[]|[${populationFieldGroups}]|READ`,
    [`DWP_W1_TENANT_${lane}_TARGET_POPULATION_COUNT`]: '1',
    [`DWP_W1_TENANT_${lane}_KEY`]: `synthetic-${lane.toLowerCase()}`,
    [`DWP_W1_TENANT_${lane}_EMAIL`]: `admin-${lane.toLowerCase()}@dwp.test`,
    [`DWP_W1_TENANT_${lane}_PASSWORD`]: `synthetic-password-${lane}-only`,
  };
}

export function validEnvironment() {
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

export function liveResponse(gatewayURL, requestPath, root, status = 200) {
  const bytes = Buffer.from(JSON.stringify(root), 'utf8');
  return {
    body: async () => bytes,
    headers: () => ({ 'content-type': 'application/json' }),
    status: () => status,
    url: () => new URL(requestPath, gatewayURL).toString(),
  };
}

export function csrfCookie(gatewayURL, token, overrides = {}) {
  return {
    name: 'XSRF-TOKEN',
    value: token,
    domain: new URL(gatewayURL).hostname,
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
    ...overrides,
  };
}

export function csrfStorageState(gatewayURL, token, overrides = {}) {
  return {
    cookies: token ? [csrfCookie(gatewayURL, token, overrides)] : [],
    origins: [],
  };
}
