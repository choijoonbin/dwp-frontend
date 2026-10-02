import { createHash } from 'node:crypto';
import { closeSync, constants as fsConstants, fstatSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const REQUIRED_NODE_MAJOR = 24;
export const REQUIRED_NODE_MINOR = 18;
export const RUNTIME_MANIFEST_NAME = 'runtime.json';
export const BROWSER_SCHEMA = 'hris-w1-live-browser/v2';
export const LOCAL_HOST = '127.0.0.1';
export const SHA256 = /^[0-9a-f]{64}$/u;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const RUN_ID = /^w1-[0-9]{8}t[0-9]{6}z-[0-9a-f]{8}$/u;
export const CONTEXT_KEY = /^psc-[0-9a-f]{64}$/u;
export const SCOPE_KEY = /^hcm-scope-[0-9a-f]{40}$/u;
export const DECISION_REVISION = /^psr-[0-9a-f]{64}$/u;

const SAFE_KEY = /^[a-z0-9][a-z0-9-]{2,79}$/u;
const SAFE_ACCOUNT_SUFFIXES = [
  '@dwp.local',
  '@dwp.test',
  '@example.invalid',
  '@localhost.invalid',
  '@test.invalid',
];
const ENDPOINT_NAMES = Object.freeze([
  'auth',
  'platform',
  'people',
  'provider',
  'payroll',
  'time',
  'gateway',
]);
const TENANT_ENV_FIELDS = Object.freeze([
  'PROVIDER_TENANT_ID',
  'ID',
  'USER_ID',
  'PERSON_PUBLIC_ID',
  'WORKER_PUBLIC_ID',
  'ASSIGNMENT_PUBLIC_ID',
  'ACTOR_LEGAL_EMPLOYER_PUBLIC_ID',
  'TARGET_PERSON_PUBLIC_ID',
  'TARGET_WORKER_PUBLIC_ID',
  'TARGET_ASSIGNMENT_PUBLIC_ID',
  'TARGET_POPULATION_REVISION',
  'TARGET_POPULATION_COUNT',
  'KEY',
  'EMAIL',
  'PASSWORD',
]);
const ALLOWED_DWP_W1_ENV = new Set([
  'DWP_W1_RUN_ID',
  'DWP_W1_EVIDENCE_DIR',
  'DWP_W1_CHECKPOINT_MANIFEST',
  'DWP_W1_ACTIVE_BUNDLE_VERSION',
  'DWP_W1_ACTIVE_BUNDLE_REVISION',
  ...ENDPOINT_NAMES.map((name) => `DWP_W1_${name.toUpperCase()}_URL`),
  ...['A', 'B'].flatMap((lane) =>
    TENANT_ENV_FIELDS.map((field) => `DWP_W1_TENANT_${lane}_${field}`)
  ),
]);

export const ROLLOUT_FLAG_KEYS = Object.freeze([
  'access.product-surfaces.context-shadow.v1',
  'access.product-surfaces.capability-enforcement.hcm.v1',
  'ux.product-surfaces.hcm.v1',
]);
export const NEGATIVE_ASSERTIONS = Object.freeze({
  'negative.stale-evidence-denied': 'STALE',
  'negative.expired-evidence-denied': 'EXPIRED',
  'negative.revoked-evidence-denied': 'REVOKED',
});
export const REQUIRED_ASSERTIONS = Object.freeze([
  'tenant-a.general-owner-api',
  'tenant-a.high-assurance-step-up',
  'tenant-a.receipt-lineage',
  'tenant-a.idempotency-replay',
  'tenant-a.separation-of-duties',
  'tenant-b.feature-off',
  'tenant-b.denied',
  'isolation.cross-tenant-denied',
  'isolation.population-boundary',
  ...Object.keys(NEGATIVE_ASSERTIONS),
  'negative.unmapped-route-denied',
  'path.browser-gateway-owner-db',
  'rollout.flag-off',
]);

export const CANONICAL_ROUTES = Object.freeze([
  {
    id: 'tenant-a-hrm',
    module: 'HRM',
    surfaceKey: 'hcm.operations',
    pageRouteContractKey: 'route.hcm.operations.people.page',
    path: '/hr/operations/people',
    marker: 'input[aria-label="Search people"]',
    apiPath: '/api/people/v1/workforce/people',
  },
  {
    id: 'tenant-a-per',
    module: 'PER',
    surfaceKey: 'hcm.personal',
    pageRouteContractKey: 'route.hcm.personal.talent.page',
    path: '/hr/talent',
    marker: '[data-route="/hr/talent"][data-scope="personal-goal-progress"]',
    apiPath: '/api/people/v1/hr/talent',
  },
  {
    id: 'tenant-a-pay',
    module: 'PAY',
    surfaceKey: 'hcm.personal',
    pageRouteContractKey: 'route.hcm.personal.pay.page',
    path: '/hr/pay',
    marker: '[data-testid="hris-payroll-workspace"]',
    apiPath: '/api/people/v1/hr/pay',
  },
  {
    id: 'tenant-a-tim',
    module: 'TIM',
    surfaceKey: 'hcm.personal',
    pageRouteContractKey: 'route.hcm.personal.time.page',
    path: '/hr/time',
    marker: '[data-testid="hris-query-state"][data-query-state="ready"]',
    apiPath: '/api/people/v1/hr/time',
  },
  {
    id: 'tenant-a-sys',
    module: 'SYS',
    surfaceKey: 'hcm.personal',
    pageRouteContractKey: 'route.hcm.personal.home.page',
    path: '/hr/home',
    marker: '[data-testid="hcm-home-overview"]',
    apiPath: '/api/people/v1/hr/home',
  },
]);

export const PAYROLL_ROUTES = Object.freeze({
  page: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.pay.page',
  },
  list: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.payroll-foundation-configurations.data',
    method: 'GET',
    path: '/api/payroll/v1/hris/payroll/foundation/configurations',
  },
  detail: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.payroll-foundation-configuration.data',
  },
  receipt: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.payroll-foundation-receipt.data',
  },
  update: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.payroll-foundation-update.action',
  },
  simulate: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.payroll-foundation-simulate.action',
  },
  publish: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.payroll-foundation-publish.action',
  },
});

export const PEOPLE_ROUTES = Object.freeze({
  search: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.people360-search.data',
    method: 'GET',
    path: '/api/people/v1/workforce/people',
  },
  detail: {
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.people360-detail.data',
    method: 'GET',
    path: '/api/people/v1/workforce/people',
  },
});

export const DENIED_PAGE_CANDIDATES = Object.freeze([
  {
    id: 'tenant-a-team-denied',
    module: 'SYS',
    surfaceKey: 'hcm.team',
    pageRouteContractKey: 'route.hcm.team.home.page',
    path: '/hr/team',
  },
  {
    id: 'tenant-a-system-management-denied',
    module: 'SYS',
    surfaceKey: 'hcm.management',
    pageRouteContractKey: 'route.hcm.management.system.page',
    path: '/hr/manage/system',
  },
  {
    id: 'tenant-a-integration-management-denied',
    module: 'SYS',
    surfaceKey: 'hcm.management',
    pageRouteContractKey: 'route.hcm.management.integration.page',
    path: '/hr/data/integrations',
  },
]);

export const DENIED_ACCESS_STATES = Object.freeze({
  APP_DENIED: 'app-denied',
  SURFACE_DENIED: 'surface-denied',
  ROUTE_DENIED: 'route-denied',
});

export class CheckpointHold extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckpointHold';
  }
}

export function hold(message) {
  throw new CheckpointHold(message);
}

export function record(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    hold(`${location} must be an object.`);
  }
  return value;
}

export function exactKeys(value, allowed, location) {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    hold(`${location} has an unexpected field set.`);
  }
}

export function textValue(value, location, maximum = 500) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.trim() !== value ||
    value.length > maximum ||
    /[\r\n\0]/u.test(value)
  ) {
    hold(`${location} must be a bounded nonblank string.`);
  }
  return value;
}

export function instant(value, location) {
  const parsed = Date.parse(textValue(value, location, 64));
  if (!Number.isFinite(parsed) || !value.endsWith('Z')) hold(`${location} must be a UTC instant.`);
  return value;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) hold('Canonical JSON cannot contain undefined values.');
  return serialized;
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Canonical(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), 'utf8'));
}

export function sha256Text(value) {
  return sha256Bytes(Buffer.from(value, 'utf8'));
}

function sameStat(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

export function readAttestedRegular(pathname, location, maximumBytes = 32 * 1024 * 1024) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    hold(`${location} has an invalid attestation size limit.`);
  }
  if (typeof fsConstants.O_NOFOLLOW !== 'number') {
    hold('This checkpoint requires O_NOFOLLOW filesystem support.');
  }
  let descriptor;
  try {
    descriptor = openSync(
      pathname,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | (fsConstants.O_CLOEXEC ?? 0)
    );
  } catch (error) {
    hold(`${location} could not be opened without following links: ${error.message}`);
  }
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size <= 0n) {
      hold(`${location} must be one non-empty, singly linked regular file.`);
    }
    if (before.size > BigInt(maximumBytes)) hold(`${location} exceeds its attested size limit.`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameStat(before, after) || BigInt(bytes.byteLength) !== before.size) {
      hold(`${location} changed while it was read.`);
    }
    return Object.freeze({
      bytes,
      sha256: sha256Bytes(bytes),
      byteCount: bytes.byteLength,
      device: before.dev.toString(),
      inode: before.ino.toString(),
    });
  } finally {
    closeSync(descriptor);
  }
}

export function readAttestedJson(pathname, location, maximumBytes = 4 * 1024 * 1024) {
  const file = readAttestedRegular(pathname, location, maximumBytes);
  try {
    return Object.freeze({ ...file, value: JSON.parse(file.bytes.toString('utf8')) });
  } catch {
    hold(`${location} is not valid UTF-8 JSON.`);
  }
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    hold(`${name} is required and cannot contain edge whitespace.`);
  }
  if (/[\r\n\0]/u.test(value)) hold(`${name} contains a forbidden control character.`);
  return value;
}

function positiveInteger(value, location) {
  if (!/^[1-9][0-9]{0,15}$/u.test(value)) hold(`${location} must be a positive safe integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) hold(`${location} must be a positive safe integer.`);
  return parsed;
}

function localEndpoint(value, location) {
  let url;
  try {
    url = new URL(value);
  } catch {
    hold(`${location} must be an absolute URL.`);
  }
  const port = Number(url.port);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== LOCAL_HOST ||
    !Number.isSafeInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    !/^\/?$/u.test(url.pathname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    hold(`${location} must be an uncredentialed http://127.0.0.1:<port> URL.`);
  }
  return url.origin;
}

function tenantFromEnvironment(env, lane) {
  const prefix = `DWP_W1_TENANT_${lane}`;
  const uuidValue = (field) => {
    const value = required(env, `${prefix}_${field}`).toLowerCase();
    if (!UUID.test(value)) hold(`${prefix}_${field} must be a UUID.`);
    return value;
  };
  const providerTenantId = uuidValue('PROVIDER_TENANT_ID');
  const personPublicId = uuidValue('PERSON_PUBLIC_ID');
  const workerPublicId = uuidValue('WORKER_PUBLIC_ID');
  const assignmentPublicId = uuidValue('ASSIGNMENT_PUBLIC_ID');
  const actorLegalEmployerPublicId = uuidValue('ACTOR_LEGAL_EMPLOYER_PUBLIC_ID');
  const targetPersonPublicId = uuidValue('TARGET_PERSON_PUBLIC_ID');
  const targetWorkerPublicId = uuidValue('TARGET_WORKER_PUBLIC_ID');
  const targetAssignmentPublicId = uuidValue('TARGET_ASSIGNMENT_PUBLIC_ID');
  for (const [actor, target, label] of [
    [personPublicId, targetPersonPublicId, 'PERSON_PUBLIC_ID'],
    [workerPublicId, targetWorkerPublicId, 'WORKER_PUBLIC_ID'],
    [assignmentPublicId, targetAssignmentPublicId, 'ASSIGNMENT_PUBLIC_ID'],
  ]) {
    if (actor === target) hold(`${prefix}_${label} must differ from its target population member.`);
  }
  const targetPopulationRevision = required(env, `${prefix}_TARGET_POPULATION_REVISION`);
  if (
    !/^[0-9a-f]{32}:true\|\[\]\|\[DIRECTORY, EMPLOYMENT, WORKER_IDENTIFIERS\]\|READ$/u.test(
      targetPopulationRevision
    )
  ) {
    hold(`${prefix}_TARGET_POPULATION_REVISION must be the exact owner policy revision.`);
  }
  const key = required(env, `${prefix}_KEY`);
  if (!SAFE_KEY.test(key)) hold(`${prefix}_KEY must be a safe lowercase tenant key.`);
  const email = required(env, `${prefix}_EMAIL`).toLowerCase();
  if (
    !/^[a-z0-9][a-z0-9._+-]*@/u.test(email) ||
    !SAFE_ACCOUNT_SUFFIXES.some((suffix) => email.endsWith(suffix))
  ) {
    hold(`${prefix}_EMAIL must be an explicitly synthetic account.`);
  }
  const password = required(env, `${prefix}_PASSWORD`);
  if (password.length < 12 || password.length > 256) {
    hold(`${prefix}_PASSWORD must contain 12-256 characters.`);
  }
  return Object.freeze({
    lane,
    label: lane === 'A' ? 'tenant-a' : 'tenant-b',
    providerTenantId,
    tenantId: positiveInteger(required(env, `${prefix}_ID`), `${prefix}_ID`),
    userId: positiveInteger(required(env, `${prefix}_USER_ID`), `${prefix}_USER_ID`),
    personPublicId,
    workerPublicId,
    assignmentPublicId,
    actorLegalEmployerPublicId,
    targetPersonPublicId,
    targetWorkerPublicId,
    targetAssignmentPublicId,
    targetPopulationRevision,
    targetPopulationCount: positiveInteger(
      required(env, `${prefix}_TARGET_POPULATION_COUNT`),
      `${prefix}_TARGET_POPULATION_COUNT`
    ),
    key,
    email,
    password,
  });
}

export function parseCheckpointEnvironment(env) {
  const unexpected = Object.keys(env)
    .filter((name) => name.startsWith('DWP_W1_') && !ALLOWED_DWP_W1_ENV.has(name))
    .sort();
  if (unexpected.length) hold(`Unsupported DWP_W1_* variables: ${unexpected.join(', ')}`);
  const runId = required(env, 'DWP_W1_RUN_ID');
  if (!RUN_ID.test(runId)) hold('DWP_W1_RUN_ID is not the canonical runner id.');
  const activeBundle = {
    version: positiveInteger(
      required(env, 'DWP_W1_ACTIVE_BUNDLE_VERSION'),
      'DWP_W1_ACTIVE_BUNDLE_VERSION'
    ),
    revision: positiveInteger(
      required(env, 'DWP_W1_ACTIVE_BUNDLE_REVISION'),
      'DWP_W1_ACTIVE_BUNDLE_REVISION'
    ),
  };
  if (activeBundle.version !== 33 || activeBundle.revision !== 2) {
    hold('The checkpoint is bound only to active product authorization bundle v33 revision 2.');
  }
  const endpoints = Object.fromEntries(
    ENDPOINT_NAMES.map((name) => [
      name,
      localEndpoint(
        required(env, `DWP_W1_${name.toUpperCase()}_URL`),
        `DWP_W1_${name.toUpperCase()}_URL`
      ),
    ])
  );
  if (new Set(Object.values(endpoints)).size !== ENDPOINT_NAMES.length) {
    hold('All seven DWP_W1 service endpoints must use distinct loopback ports.');
  }
  const rawEvidenceDir = required(env, 'DWP_W1_EVIDENCE_DIR');
  if (!path.isAbsolute(rawEvidenceDir)) hold('DWP_W1_EVIDENCE_DIR must be absolute.');
  const evidenceDir = path.resolve(rawEvidenceDir);
  const checkpointManifest = required(env, 'DWP_W1_CHECKPOINT_MANIFEST');
  if (checkpointManifest !== path.join(evidenceDir, 'checkpoint', 'manifest.json')) {
    hold('DWP_W1_CHECKPOINT_MANIFEST must be the exact runner-owned checkpoint/manifest.json.');
  }
  const tenants = [tenantFromEnvironment(env, 'A'), tenantFromEnvironment(env, 'B')];
  for (const field of [
    'providerTenantId',
    'tenantId',
    'userId',
    'personPublicId',
    'workerPublicId',
    'assignmentPublicId',
    'actorLegalEmployerPublicId',
    'targetPersonPublicId',
    'targetWorkerPublicId',
    'targetAssignmentPublicId',
    'key',
    'email',
  ]) {
    if (tenants[0][field] === tenants[1][field]) {
      hold(`Tenant A and B ${field} values must differ.`);
    }
  }
  if (tenants[0].password === tenants[1].password) hold('Tenant A and B passwords must differ.');
  return Object.freeze({
    runId,
    activeBundle: Object.freeze(activeBundle),
    endpoints: Object.freeze(endpoints),
    evidenceDir,
    checkpointManifest,
    tenants: Object.freeze(tenants),
  });
}

export function responseSummary(response) {
  return {
    method: response.method,
    path: response.path,
    status: response.status,
    responseBodySha256: response.bodySha256,
    responseBodyByteCount: response.bodyByteCount,
  };
}

export function safeApiPath(value, location) {
  const candidate = textValue(value, location, 500);
  let parsed;
  try {
    parsed = new URL(candidate, 'http://127.0.0.1');
  } catch {
    hold(`${location} must be an origin-relative API path.`);
  }
  if (
    !candidate.startsWith('/api/') ||
    candidate.startsWith('//') ||
    parsed.origin !== 'http://127.0.0.1' ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== candidate
  ) {
    hold(`${location} must be an exact origin-relative /api/ path without query or fragment.`);
  }
  return candidate;
}

export function uuidV5Url(name) {
  const namespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const digest = createHash('sha1')
    .update(namespace)
    .update(Buffer.from(name, 'utf8'))
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

export function expectedNegativeContracts(runId) {
  if (!RUN_ID.test(runId)) hold('Negative contracts require the canonical runner id.');
  const pathId = (state) => uuidV5Url(`dwp:${runId}:negative:${state}`);
  const projectionId = (state) => uuidV5Url(`dwp:${runId}:payroll:negative:${state}`);
  return Object.freeze({
    'negative.stale-evidence-denied': Object.freeze({
      evidenceState: 'STALE',
      authorityKey: 'payrollStale',
      path: `${PAYROLL_ROUTES.list.path}/${pathId('stale')}`,
      projectionId: projectionId('stale'),
      status: 503,
      errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
    }),
    'negative.expired-evidence-denied': Object.freeze({
      evidenceState: 'EXPIRED',
      authorityKey: 'payrollExpired',
      path: `${PAYROLL_ROUTES.list.path}/${pathId('expired')}/versions`,
      projectionId: projectionId('expired'),
      status: 503,
      errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
    }),
    'negative.revoked-evidence-denied': Object.freeze({
      evidenceState: 'REVOKED',
      authorityKey: 'payrollRevoked',
      path: `/api/payroll/v1/hris/payroll/foundation/receipts/${pathId('revoked')}`,
      projectionId: projectionId('revoked'),
      status: 503,
      errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
    }),
  });
}

export function expectedPeoplePolicyRevision(targetPopulationRevision) {
  return `policy-${sha256Bytes(
    Buffer.concat([
      Buffer.from('policy', 'utf8'),
      Buffer.from([0]),
      Buffer.from(targetPopulationRevision, 'utf8'),
    ])
  )}`;
}

export function expectedPeopleEffectivePolicyRevision(
  targetPopulationRevision,
  tenantId,
  asOf,
  purpose
) {
  if (!['LIST', 'DETAIL'].includes(purpose)) {
    hold(`Unsupported People projection purpose: ${purpose}`);
  }
  const authorityRevision = expectedPeoplePolicyRevision(targetPopulationRevision);
  return `effective-policy-${sha256Bytes(
    Buffer.concat([
      Buffer.from('effective-policy', 'utf8'),
      Buffer.from([0]),
      Buffer.from(authorityRevision, 'utf8'),
      Buffer.from([0]),
      Buffer.from('people360.compatibility-default.v1', 'utf8'),
      Buffer.from([0]),
      Buffer.from(String(tenantId), 'utf8'),
      Buffer.from([0]),
      Buffer.from(asOf, 'utf8'),
      Buffer.from([0]),
      Buffer.from(purpose, 'utf8'),
    ])
  )}`;
}
