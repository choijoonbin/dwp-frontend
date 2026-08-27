import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ajv = require('ajv');

const schemaSource = readFileSync(
  new URL('./widget-tenant-impact.v1.schema.json', import.meta.url),
  'utf8'
);
const goldenSource = readFileSync(
  new URL('./widget-tenant-impact.v1.golden.json', import.meta.url),
  'utf8'
);
const negativeSource = readFileSync(
  new URL('./widget-tenant-impact.v1.negative.json', import.meta.url),
  'utf8'
);

const anchors = Object.freeze({
  schemaFile: '0250713581c637bdbb2c42089d3138bea0d2d2e94e6b1c3a08dec56e95d0e863',
  goldenFile: '90e40235fcf3efd389a0f1630a973f21143c105511938eceec50cd826fcbb821',
  negativeFile: '69c531d2eeb3e76834accb8f62349172c7d48b567e67c6dda1c41c1024fc22f1',
  impactPreimageCanonical: 'ea98b99d7bb3a1fed88cc68f819f4eb9af5217210cf72555e274ae33544fe9e0',
  contractCanonical: '725c3925bd49054d8f75451e85d676c63405234a3eac3169f526173cd90a07dc',
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assert(value === value.normalize('NFC'), `${path} is not NFC.`);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0),
      `${path} must be a non-negative safe integer.`
    );
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

function compileRef(schema, definitionName) {
  const schemaForValidation = structuredClone(schema);
  delete schemaForValidation.$schema;
  return new Ajv({ allErrors: true, schemaId: 'auto' }).compile({
    $defs: schemaForValidation.$defs,
    $ref: `#/$defs/${definitionName}`,
  });
}

function impactRevision(preimage) {
  return sha256(Buffer.from(canonicalize(preimage), 'utf8'));
}

function applyMutation(target, mutation) {
  assert(
    !mutation.path.includes('.'),
    'Negative mutation paths must be one closed top-level field.'
  );
  if (mutation.operation === 'SET') {
    target[mutation.path] = mutation.value;
    return;
  }
  assert(mutation.operation === 'DELETE', `Unsupported mutation ${mutation.operation}.`);
  delete target[mutation.path];
}

function executePublish(
  { request, currentPreimage, authenticatedTenantBinding, dbNow },
  validators
) {
  if (!validators.publishRequest(request)) {
    return {
      httpStatus: 400,
      code: 'INVALID_INPUT_VALUE',
      stateMutationCount: 0,
      eventCount: 0,
      outboxCount: 0,
      auditCount: 0,
    };
  }
  if (!validators.impactPreimage(currentPreimage)) {
    throw new Error('Test current preimage is not a valid locked projection.');
  }
  const currentRevision = impactRevision(currentPreimage);
  if (
    currentPreimage.internalTenantBinding !== authenticatedTenantBinding ||
    Date.parse(dbNow) >= Date.parse(currentPreimage.validUntil) ||
    request.expectedVersion !== currentPreimage.draftVersion ||
    request.expectedImpactRevision !== currentRevision
  ) {
    return {
      httpStatus: 409,
      code: 'IMPACT_REVISION_CONFLICT',
      stateMutationCount: 0,
      eventCount: 0,
      outboxCount: 0,
      auditCount: 0,
    };
  }
  return {
    httpStatus: 200,
    code: 'PUBLISHED',
    stateMutationCount: 1,
    eventCount: 1,
    outboxCount: 1,
    auditCount: 1,
  };
}

const schema = JSON.parse(schemaSource);
const golden = JSON.parse(goldenSource);
const negative = JSON.parse(negativeSource);
const schemaForValidation = structuredClone(schema);
delete schemaForValidation.$schema;
const validateGolden = new Ajv({ allErrors: true, schemaId: 'auto' }).compile(schemaForValidation);
const validators = Object.freeze({
  impactPreimage: compileRef(schema, 'impactPreimage'),
  impactResponse: compileRef(schema, 'impactResponse'),
  publishRequest: compileRef(schema, 'publishRequest'),
});

assert(
  validateGolden(golden),
  `Golden fixture schema failure: ${JSON.stringify(validateGolden.errors)}.`
);
assert(
  exactKeys(negative, ['fixtureVersion', 'cases']) && negative.fixtureVersion === 1,
  'Negative fixture root must be closed V1.'
);
assert(Array.isArray(negative.cases) && negative.cases.length >= 1, 'Negative cases are required.');

const preimage = golden.preview.preimage;
const response = golden.preview.response;
const lockedImpactRevision = impactRevision(preimage);
assert(
  response.impactRevision === lockedImpactRevision,
  'Preview impactRevision is not JCS(preimage).'
);
assert(
  !Object.hasOwn(response, 'internalTenantBinding') &&
    !Object.hasOwn(golden.publish.request, 'internalTenantBinding'),
  'Internal tenant binding leaked into the public API DTO.'
);
for (const key of [
  'definitionId',
  'draftRevisionId',
  'draftVersion',
  'catalogRevision',
  'bindingCatalogRevision',
  'policyCatalogRevision',
  'safetyRevision',
  'authorityRevision',
  'audienceSelectorHash',
  'validUntil',
  'eligibleCount',
  'newlyAllowedCount',
  'newlyDeniedCount',
  'existingInstanceBlockedCount',
  'unknownAuthorityCount',
]) {
  assert(response[key] === preimage[key], `Preview response field ${key} differs from preimage.`);
}

const publish = golden.publish;
assert(
  canonicalize(publish.transaction.currentPreimage) === canonicalize(preimage),
  'Publish did not recompute the current preimage under the transaction locks.'
);
assert(
  publish.request.expectedImpactRevision === lockedImpactRevision,
  'Publish request does not carry the exact expectedImpactRevision.'
);
assert(
  publish.request.expectedVersion === preimage.draftVersion,
  'Publish expectedVersion differs from the locked draft version.'
);
assert(
  Date.parse(publish.transaction.dbNow) < Date.parse(preimage.validUntil),
  'Golden authority snapshot is expired at the DB clock.'
);
assert(
  canonicalize(publish.transaction.lockOrder) ===
    canonicalize([
      'TENANT_BINDING',
      'POLICY_DRAFT',
      'REGISTRY_REVISION_HEAD',
      'TENANT_POLICY_CATALOG_HEAD',
      'SAFETY_REVISION_HEAD',
      'AUTHORITY_SNAPSHOT',
    ]),
  'Publish lock order changed.'
);
for (const evidence of [publish.response, publish.audit, publish.event]) {
  assert(
    evidence.impactRevision === lockedImpactRevision,
    'Publish response/audit/event did not carry the applied impactRevision.'
  );
}
assert(publish.audit.type === 'TENANT_POLICY_PUBLISHED_AUDIT', 'Audit evidence type changed.');
assert(publish.event.type === 'TENANT_WIDGET_POLICY_PUBLISHED', 'Event evidence type changed.');
const goldenExecution = executePublish(
  {
    request: publish.request,
    currentPreimage: publish.transaction.currentPreimage,
    authenticatedTenantBinding: preimage.internalTenantBinding,
    dbNow: publish.transaction.dbNow,
  },
  validators
);
assert(goldenExecution.httpStatus === 200, 'Golden publish did not commit.');

const names = new Set();
for (const testCase of negative.cases) {
  assert(
    exactKeys(testCase, [
      'name',
      'mutation',
      'authenticatedTenantBinding',
      'dbNow',
      'expectedHttpStatus',
      'expectedCode',
      'expectedStateMutationCount',
      'expectedEventCount',
      'expectedOutboxCount',
      'expectedAuditCount',
    ]),
    `${testCase.name}: negative case must be closed.`
  );
  assert(!names.has(testCase.name), `${testCase.name}: duplicate negative case.`);
  names.add(testCase.name);
  assert(
    exactKeys(testCase.mutation, ['target', 'operation', 'path', 'value']) ||
      exactKeys(testCase.mutation, ['target', 'operation', 'path']),
    `${testCase.name}: mutation must be closed.`
  );
  const request = structuredClone(publish.request);
  const currentPreimage = structuredClone(preimage);
  const mutationTarget =
    testCase.mutation.target === 'REQUEST'
      ? request
      : testCase.mutation.target === 'CURRENT_PREIMAGE'
        ? currentPreimage
        : null;
  assert(mutationTarget, `${testCase.name}: unknown mutation target.`);
  applyMutation(mutationTarget, testCase.mutation);
  const result = executePublish(
    {
      request,
      currentPreimage,
      authenticatedTenantBinding: testCase.authenticatedTenantBinding,
      dbNow: testCase.dbNow,
    },
    validators
  );
  assert(
    result.httpStatus === testCase.expectedHttpStatus,
    `${testCase.name}: HTTP status mismatch.`
  );
  assert(result.code === testCase.expectedCode, `${testCase.name}: error code mismatch.`);
  for (const count of ['StateMutationCount', 'EventCount', 'OutboxCount', 'AuditCount']) {
    const resultKey = `${count[0].toLowerCase()}${count.slice(1)}`;
    assert(
      result[resultKey] === testCase[`expected${count}`],
      `${testCase.name}: ${resultKey} mismatch.`
    );
  }
}

const contract = Object.freeze({
  schemaVersion: 1,
  canonicalization: 'RFC8785_JCS',
  digest: 'SHA-256',
  publishRequires: ['expectedVersion', 'expectedImpactRevision'],
  successCarriesImpactRevision: ['response', 'audit', 'event'],
  conflict: Object.freeze({
    httpStatus: 409,
    code: 'IMPACT_REVISION_CONFLICT',
    stateMutationCount: 0,
    eventCount: 0,
    outboxCount: 0,
    auditCount: 0,
  }),
  transaction: Object.freeze({
    isolation: 'SERIALIZABLE',
    comparison: 'EXPECTED_IMPACT_REVISION_EXACT',
    lockOrder: publish.transaction.lockOrder,
  }),
});
const actualAnchors = Object.freeze({
  schemaFile: sha256(schemaSource),
  goldenFile: sha256(goldenSource),
  negativeFile: sha256(negativeSource),
  impactPreimageCanonical: impactRevision(preimage),
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
process.stdout.write('positive 1\n');
process.stdout.write(`negative ${negative.cases.length}\n`);
process.stdout.write('tenant-impact-contract ok\n');
