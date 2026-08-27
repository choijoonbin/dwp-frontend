import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const goldenSource = readFileSync(
  new URL('./widget-revision-authority.v1.golden.json', import.meta.url),
  'utf8'
);
const negativeSource = readFileSync(
  new URL('./widget-revision-authority.v1.negative.json', import.meta.url),
  'utf8'
);

const anchors = Object.freeze({
  goldenFile: '8039087b9cf838b94e008c6564658e5c8f731173a6341dea9aa6b7184148fed9',
  negativeFile: '54748e022eeb83cfbd93c35e654c47830b30c944fa029245a174b89f8b593f81',
  readRevisionPreimageCanonical: '4e6b459a86d55d96246b11efe02ac311e682ed009c93814d2aa5660986d26ba8',
  contractCanonical: 'da8e1af24de5c535ef713c05132a436e540f4f7528ebc09b5c9e8e66b647ddb4',
});
const maxSignedBigint = 9223372036854775807n;
const revisionPattern = /^(?:0|[1-9][0-9]*)$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(Number.isSafeInteger(value) && value >= 0, `${path} is not a safe unsigned integer.`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(',')}]`;
  }
  assert(value && typeof value === 'object', `${path} is not JSON.`);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`)}`)
    .join(',')}}`;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function validRevision(value) {
  return (
    typeof value === 'string' && revisionPattern.test(value) && BigInt(value) <= maxSignedBigint
  );
}

function validInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().replace('.000Z', 'Z') === value;
}

function sameHeadTuple(left, right) {
  return (
    exactKeys(left, ['registryRevision', 'tenantPolicyRevision', 'safetyRevision']) &&
    exactKeys(right, ['registryRevision', 'tenantPolicyRevision', 'safetyRevision']) &&
    left.registryRevision === right.registryRevision &&
    left.tenantPolicyRevision === right.tenantPolicyRevision &&
    left.safetyRevision === right.safetyRevision
  );
}

function validateMutation(testCase) {
  const common = [
    'name',
    'outcome',
    'authority',
    'currentRevision',
    'nextRevision',
    'lock',
    'commitBoundary',
    'stateMutationCount',
    'eventCount',
    'outboxCount',
  ];
  const expectedKeys =
    testCase.outcome === 'ROLLBACK_STATE_CHANGED'
      ? [...common, 'rollbackSourceRevision']
      : testCase.outcome === 'OVERFLOW'
        ? [...common, 'readinessStatus', 'errorCode']
        : common;
  if (!exactKeys(testCase, expectedKeys)) return 'MUTATION_CASE_SHAPE';
  if (!['REGISTRY', 'TENANT_POLICY', 'SAFETY'].includes(testCase.authority)) {
    return 'MUTATION_AUTHORITY';
  }
  if (!validRevision(testCase.currentRevision)) return 'REVISION_FORMAT';
  if (testCase.lock !== 'SELECT_FOR_UPDATE') return 'HEAD_LOCK_REQUIRED';
  const counts = [testCase.stateMutationCount, testCase.eventCount, testCase.outboxCount];

  if (testCase.outcome === 'OVERFLOW') {
    if (
      testCase.currentRevision !== maxSignedBigint.toString() ||
      testCase.nextRevision !== null ||
      testCase.readinessStatus !== 'FAILED' ||
      testCase.errorCode !== 'REVISION_HEAD_EXHAUSTED' ||
      testCase.commitBoundary !== 'NO_STATE_EVENT_OUTBOX' ||
      !counts.every((count) => count === 0)
    ) {
      return 'BIGINT_OVERFLOW_FAIL_CLOSED';
    }
    return null;
  }

  if (!validRevision(testCase.nextRevision)) return 'REVISION_FORMAT';
  const current = BigInt(testCase.currentRevision);
  const next = BigInt(testCase.nextRevision);
  if (['STATE_CHANGED', 'ROLLBACK_STATE_CHANGED'].includes(testCase.outcome)) {
    if (next !== current + 1n) {
      return testCase.outcome === 'ROLLBACK_STATE_CHANGED'
        ? 'ROLLBACK_NOT_MONOTONIC'
        : 'STATE_CHANGE_NOT_INCREMENTED';
    }
    if (testCase.outcome === 'ROLLBACK_STATE_CHANGED') {
      if (
        !validRevision(testCase.rollbackSourceRevision) ||
        BigInt(testCase.rollbackSourceRevision) >= current
      ) {
        return 'ROLLBACK_SOURCE_NOT_HISTORICAL';
      }
    }
    if (
      testCase.commitBoundary !== 'STATE_EVENT_OUTBOX_SAME_TRANSACTION' ||
      !counts.every((count) => count === 1)
    ) {
      return 'STATE_EVENT_OUTBOX_SAME_COMMIT';
    }
    return null;
  }
  if (!['REPLAY', 'NO_OP', 'FAILURE'].includes(testCase.outcome)) return 'MUTATION_OUTCOME';
  if (next !== current) return 'NON_MUTATION_REVISION_BUMP';
  if (
    testCase.commitBoundary !== 'NO_STATE_EVENT_OUTBOX' ||
    !counts.every((count) => count === 0)
  ) {
    return 'NON_MUTATION_SIDE_EFFECT';
  }
  return null;
}

function validateContract(fixture) {
  if (
    !exactKeys(fixture, [
      'fixtureVersion',
      'heads',
      'mutationCases',
      'pagination',
      'effectiveRead',
      'rolloutSnapshot',
    ])
  ) {
    return 'FIXTURE_SHAPE';
  }
  if (fixture.fixtureVersion !== 1) return 'FIXTURE_VERSION';
  const expectedHeads = [
    ['REGISTRY', 'plt_widget_registry_revision_head', ['environment']],
    ['TENANT_POLICY', 'adm_tenant_widget_policy_catalog_head', ['tenant_id']],
    ['SAFETY', 'plt_widget_safety_revision_head', ['environment']],
  ];
  if (!Array.isArray(fixture.heads) || fixture.heads.length !== expectedHeads.length) {
    return 'HEAD_AUTHORITY_CATALOG';
  }
  for (let index = 0; index < expectedHeads.length; index += 1) {
    const row = fixture.heads[index];
    const [authority, table, keyColumns] = expectedHeads[index];
    if (
      !exactKeys(row, ['authority', 'table', 'keyColumns', 'revisionType', 'maxRevision']) ||
      row.authority !== authority ||
      row.table !== table ||
      canonicalize(row.keyColumns) !== canonicalize(keyColumns) ||
      row.revisionType !== 'SIGNED_BIGINT' ||
      row.maxRevision !== maxSignedBigint.toString()
    ) {
      return 'HEAD_AUTHORITY_CATALOG';
    }
  }
  if (!Array.isArray(fixture.mutationCases) || fixture.mutationCases.length < 8) {
    return 'MUTATION_CASE_COVERAGE';
  }
  const mutationNames = new Set();
  for (const testCase of fixture.mutationCases) {
    if (mutationNames.has(testCase.name)) return 'MUTATION_CASE_DUPLICATE';
    mutationNames.add(testCase.name);
    const error = validateMutation(testCase);
    if (error) return error;
  }

  const pagination = fixture.pagination;
  if (
    !exactKeys(pagination, [
      'revisionPreimage',
      'firstPage',
      'nextPageSameHead',
      'nextPageStaleHead',
    ])
  ) {
    return 'PAGINATION_SHAPE';
  }
  const readRevision = sha256(Buffer.from(canonicalize(pagination.revisionPreimage), 'utf8'));
  if (
    pagination.firstPage.transaction !== 'READ_ONLY_REPEATABLE_READ' ||
    pagination.firstPage.capturedHeadRevision !== pagination.revisionPreimage.headRevision ||
    pagination.firstPage.readRevision !== readRevision ||
    pagination.firstPage.httpStatus !== 200
  ) {
    return pagination.firstPage.readRevision !== readRevision
      ? 'READ_REVISION_DIGEST'
      : 'FIRST_PAGE_SNAPSHOT';
  }
  if (
    pagination.nextPageSameHead.suppliedReadRevision !== readRevision ||
    pagination.nextPageSameHead.currentHeadRevision !== pagination.revisionPreimage.headRevision ||
    pagination.nextPageSameHead.httpStatus !== 200
  ) {
    return 'NEXT_PAGE_SAME_HEAD';
  }
  if (
    pagination.nextPageStaleHead.suppliedReadRevision !== readRevision ||
    pagination.nextPageStaleHead.currentHeadRevision === pagination.revisionPreimage.headRevision ||
    pagination.nextPageStaleHead.httpStatus !== 409 ||
    pagination.nextPageStaleHead.errorCode !== 'READ_REVISION_CONFLICT'
  ) {
    return 'READ_REVISION_FAIL_OPEN';
  }

  const effective = fixture.effectiveRead;
  if (
    effective.maxAttempts !== 2 ||
    canonicalize(effective.algorithm) !==
      canonicalize(['READ_THREE_HEADS', 'EVALUATE', 'RECHECK_THREE_HEADS'])
  ) {
    return 'EFFECTIVE_READ_ALGORITHM';
  }
  if (
    canonicalize(effective.positiveCacheLookupOrder) !==
    canonicalize([
      'READ_REGISTRY_HEAD',
      'READ_TENANT_POLICY_HEAD',
      'READ_SAFETY_HEAD',
      'BUILD_CACHE_KEY_WITH_SAFETY',
      'POSITIVE_CACHE_LOOKUP',
    ])
  ) {
    return 'SAFETY_HEAD_BEFORE_POSITIVE_CACHE';
  }
  if (
    !sameHeadTuple(effective.stable.firstHeads, effective.stable.recheckedHeads) ||
    effective.stable.attempts !== 1 ||
    effective.stable.httpStatus !== 200
  ) {
    return 'EFFECTIVE_READ_STABLE';
  }
  if (
    !Array.isArray(effective.drift.attempts) ||
    effective.drift.attempts.length !== effective.maxAttempts ||
    effective.drift.attempts.some((attempt) =>
      sameHeadTuple(attempt.firstHeads, attempt.recheckedHeads)
    ) ||
    effective.drift.httpStatus !== 503 ||
    effective.drift.errorCode !== 'REVISION_STABILITY_UNAVAILABLE'
  ) {
    return 'EFFECTIVE_READ_DRIFT_FAIL_CLOSED';
  }

  const rollout = fixture.rolloutSnapshot;
  if (!sameHeadTuple(rollout.headTuple, effective.stable.firstHeads)) {
    return 'ROLLOUT_HEAD_TUPLE_BINDING';
  }
  if (
    !exactKeys(rollout, [
      'environment',
      'predecessorRolloutRevision',
      'headTuple',
      'evidenceWindow',
      'predecessorActivationAt',
      'authoritativeTransitions',
    ]) ||
    rollout.environment !== 'STAGING' ||
    !Number.isSafeInteger(rollout.predecessorRolloutRevision) ||
    rollout.predecessorRolloutRevision < 1 ||
    !exactKeys(rollout.evidenceWindow, ['startedAt', 'endedAt']) ||
    !validInstant(rollout.evidenceWindow.startedAt) ||
    !validInstant(rollout.evidenceWindow.endedAt) ||
    !validInstant(rollout.predecessorActivationAt) ||
    !Array.isArray(rollout.authoritativeTransitions) ||
    rollout.authoritativeTransitions.length < 1
  ) {
    return 'ROLLOUT_TRANSITION_LEDGER';
  }
  let previousTransitionAt = -1;
  for (const transition of rollout.authoritativeTransitions) {
    if (
      !exactKeys(transition, [
        'environment',
        'commitState',
        'type',
        'rolloutRevision',
        'occurredAt',
      ]) ||
      transition.environment !== rollout.environment ||
      transition.commitState !== 'COMMITTED' ||
      !['ACTIVATE', 'STOP', 'EXPIRE'].includes(transition.type) ||
      !Number.isSafeInteger(transition.rolloutRevision) ||
      transition.rolloutRevision < 1 ||
      !validInstant(transition.occurredAt)
    ) {
      return 'ROLLOUT_TRANSITION_LEDGER';
    }
    const transitionAt = Date.parse(transition.occurredAt);
    if (transitionAt <= previousTransitionAt) return 'ROLLOUT_TRANSITION_LEDGER_ORDER';
    previousTransitionAt = transitionAt;
  }
  const startedAt = Date.parse(rollout.evidenceWindow.startedAt);
  const endedAt = Date.parse(rollout.evidenceWindow.endedAt);
  const activationAt = Date.parse(rollout.predecessorActivationAt);
  const activationIndex = rollout.authoritativeTransitions.findIndex(
    (transition) =>
      transition.type === 'ACTIVATE' &&
      transition.rolloutRevision === rollout.predecessorRolloutRevision &&
      transition.occurredAt === rollout.predecessorActivationAt
  );
  const latestAtWindowStart = rollout.authoritativeTransitions
    .filter((transition) => Date.parse(transition.occurredAt) <= startedAt)
    .at(-1);
  const interruptionAfterActivation = rollout.authoritativeTransitions
    .slice(activationIndex + 1)
    .some(
      (transition) =>
        Date.parse(transition.occurredAt) <= endedAt &&
        ['ACTIVATE', 'STOP', 'EXPIRE'].includes(transition.type)
    );
  if (
    activationIndex < 0 ||
    !(activationAt <= startedAt && startedAt < endedAt) ||
    latestAtWindowStart !== rollout.authoritativeTransitions[activationIndex] ||
    interruptionAfterActivation
  ) {
    return 'ROLLOUT_CONTINUOUS_ACTIVE_WINDOW';
  }
  return null;
}

function applyMutation(fixture, mutation) {
  const parts = mutation.path.split('.');
  let target = fixture;
  for (const part of parts.slice(0, -1)) {
    assert(Object.hasOwn(target, part), `Unknown mutation path ${mutation.path}.`);
    target = target[part];
  }
  const last = parts.at(-1);
  assert(Object.hasOwn(target, last), `Unknown mutation path ${mutation.path}.`);
  if (mutation.operation === 'SET') {
    target[last] = structuredClone(mutation.value);
    return;
  }
  assert(mutation.operation === 'DELETE', `Unsupported mutation operation ${mutation.operation}.`);
  delete target[last];
}

const golden = JSON.parse(goldenSource);
const negative = JSON.parse(negativeSource);
assert(
  validateContract(golden) === null,
  `Golden revision contract failed: ${validateContract(golden)}.`
);
assert(
  exactKeys(negative, ['fixtureVersion', 'cases']) && negative.fixtureVersion === 1,
  'Negative fixture root must be closed V1.'
);
assert(Array.isArray(negative.cases) && negative.cases.length >= 1, 'Negative cases are required.');
const negativeNames = new Set();
for (const testCase of negative.cases) {
  assert(
    exactKeys(testCase, ['name', 'mutations', 'expectedError']),
    `${testCase.name}: negative case must be closed.`
  );
  assert(!negativeNames.has(testCase.name), `${testCase.name}: duplicate negative case.`);
  negativeNames.add(testCase.name);
  assert(
    Array.isArray(testCase.mutations) && testCase.mutations.length >= 1,
    'Mutations required.'
  );
  const fixture = structuredClone(golden);
  for (const mutation of testCase.mutations) {
    assert(
      exactKeys(mutation, ['operation', 'path', 'value']) ||
        exactKeys(mutation, ['operation', 'path']),
      `${testCase.name}: mutation must be closed.`
    );
    applyMutation(fixture, mutation);
  }
  const error = validateContract(fixture);
  assert(
    error === testCase.expectedError,
    `${testCase.name}: expected ${testCase.expectedError}, got ${error}.`
  );
}

const contract = Object.freeze({
  schemaVersion: 1,
  authorities: golden.heads,
  stateChange: Object.freeze({
    lock: 'SELECT_FOR_UPDATE',
    revisionDelta: '+1',
    commitBoundary: 'STATE_EVENT_OUTBOX_SAME_TRANSACTION',
  }),
  nonMutationOutcomes: ['REPLAY', 'NO_OP', 'FAILURE'],
  rollback: 'NEW_INCREMENT_NEVER_DECREMENT',
  overflow: 'READINESS_FAILED',
  pagination: 'HEAD_BOUND_READ_REVISION_OR_409',
  effectiveRead: 'THREE_HEAD_RECHECK_TWICE_OR_503',
  positiveCache: 'SAFETY_HEAD_BEFORE_LOOKUP',
  rollout: 'HEAD_TUPLE_PLUS_CONTINUOUS_PREDECESSOR_ACTIVE_WINDOW',
});
const actualAnchors = Object.freeze({
  goldenFile: sha256(goldenSource),
  negativeFile: sha256(negativeSource),
  readRevisionPreimageCanonical: sha256(
    Buffer.from(canonicalize(golden.pagination.revisionPreimage), 'utf8')
  ),
  contractCanonical: sha256(Buffer.from(canonicalize(contract), 'utf8')),
});

if (process.argv.includes('--print-anchors')) {
  process.stdout.write(`${JSON.stringify(actualAnchors, null, 2)}\n`);
  process.exit(0);
}
for (const [name, expected] of Object.entries(anchors)) {
  assert(actualAnchors[name] === expected, `${name} anchor changed: ${actualAnchors[name]}.`);
}
for (const [name, value] of Object.entries(actualAnchors)) {
  process.stdout.write(`${name} ${value}\n`);
}
process.stdout.write(`positive ${golden.mutationCases.length + 4}\n`);
process.stdout.write(`negative ${negative.cases.length}\n`);
process.stdout.write('revision-authority-contract ok\n');
