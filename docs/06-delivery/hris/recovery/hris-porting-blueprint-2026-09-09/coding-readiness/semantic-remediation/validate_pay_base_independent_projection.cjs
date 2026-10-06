#!/usr/bin/env node
'use strict';

// Read-only reviewer diagnostic. Draft-07 projection is NOT a canonical
// Draft-2020-12, owner-source, SQL, business-runtime or Gate approval.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const frontend = process.argv[2];
assert.ok(frontend && path.isAbsolute(frontend), 'Explicit installed frontend checkout required');
const requireFrontend = createRequire(path.join(frontend, 'package.json'));
const Ajv = requireFrontend('ajv');
const file = path.join(__dirname, 'pay-base-exact.proposal.v1.json');
const before = fs.readFileSync(file);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(before), 'bfe3e38b1417b180339e91ca22e20409e75f3991904ab26ecf0e8f3cb7e22455');
const p = JSON.parse(before);
assert.equal(p.CURRENT_PUBLISHED, false);
const unsupported = new Set(['unevaluatedProperties', 'unevaluatedItems', 'prefixItems',
  '$dynamicRef', '$dynamicAnchor', 'dependentSchemas', 'dependentRequired', '$recursiveRef']);
const issues = [];
let unverifiedReferenceAnnotations = 0;
function scan(value, pointer) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach((item, i) => scan(item, pointer + '/' + i));
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!unsupported.has(key), 'Unsupported Draft-2020 projection at ' + pointer + '/' + key);
    if (key === '$ref') assert.ok(item.startsWith('#/$defs/'), 'External schema ref: ' + item);
    scan(item, pointer + '/' + key);
  }
  if ('$ref' in value) {
    // Custom entity metadata is explicitly NOT evaluated by JSON Schema in
    // either dialect. Keep it visible in the diagnostic, not as owner proof.
    const annotations = new Set(['$ref', 'description', 'title', '$comment', 'examples', 'default',
      'referenceContract']);
    if ('referenceContract' in value) unverifiedReferenceAnnotations++;
    assert.ok(Object.keys(value).every(key => annotations.has(key) || key.startsWith('x-')),
      'Draft-2020 sibling semantics cannot be projected at ' + pointer);
  }
}
scan(p.$defs, '#/$defs');
const engine = new Ajv({ allErrors: true, format: 'full', coerceTypes: false,
  useDefaults: false, removeAdditional: false, logger: false });
const id = 'urn:dwp:review:pay-base-draft07-projection:bfe3e38b';
engine.addSchema({ $schema: 'http://json-schema.org/draft-07/schema#', $id: id, $defs: p.$defs });
const validators = new Map();
for (const key of Object.keys(p.$defs)) {
  validators.set(key, engine.compile({ $ref: id + '#/$defs/' + key }));
}
let fixtureCases = 0;
for (const fixture of p.configurationFixtures) {
  for (const request of fixture.requests) {
    const op = p.operationDeltas.find(item => item.operationId === request.operationId);
    assert.ok(op, request.operationId);
    const validate = validators.get(op.requestBodySchemaRef);
    fixtureCases++;
    if (!validate(request.body)) issues.push({ fixture: fixture.fixtureId,
      operationId: request.operationId, errors: validate.errors });
  }
  for (const [schemaId, body] of Object.entries(fixture.ownerResponses)) {
    const validate = validators.get(schemaId);
    assert.ok(validate, schemaId);
    fixtureCases++;
    if (!validate(body)) issues.push({ fixture: fixture.fixtureId, schemaId, errors: validate.errors });
  }
}
const rounding = p.configurationFixtures[0].requests[0].body;
const samples = [
  ['valid_rounding', 'PAY.RoundingCreate', rounding, true],
  ['duplicate_stage_different_rule', 'PAY.RoundingCreate', { ...rounding,
    rules: [rounding.rules[0], { ...rounding.rules[0], mode: 'UP' }] }, true],
  ['invalid_calendar_date', 'PAY.Date', '2026-02-30', false],
  ['negative_zero_requires_canonical_policy', 'PAY.InputAmount', '-0', true],
  ['invalid_zone_and_wrong_owner_require_semantic_guard', 'PAY.EntityCreate', {
    entityKey: 'LEGAL_TEST', legalEntitySnapshot: rounding.governance.snapshot,
    jurisdictionCode: 'ZZ', baseCurrency: 'TST', timeZone: 'Not/AZone',
    validFrom: '2026-09-01', validTo: '2026-10-01', governance: rounding.governance }, true],
];
const probes = samples.map(([probe, schemaId, input, expected]) => {
  const validate = validators.get(schemaId), accepted = validate(input);
  assert.equal(accepted, expected, probe);
  return { probe, schemaId, accepted, expected, scope: 'SHAPE_ONLY_NOT_OWNER_OR_RULE_VALIDATION' };
});
const owners = new Set(p.ownerContractDeltas.map(item => item.contractRef));
const unresolvedOperationOwnerLabels = p.operationDeltas.flatMap((op, index) =>
  op.ownerReadContracts.filter(ref => !owners.has(ref)).map(ref => ({
    operationId: op.operationId, pointer: '#/operationDeltas/' + index + '/ownerReadContracts', ref,
  })));
const schemaNames = [...new Set(p.tableSpecifications.map(table => table.schemaName))];
const cancellation = p.operationDeltas.find(op => op.operationId === 'pay.approval.reconcile');
assert.equal(sha(fs.readFileSync(file)), sha(before));
console.log(JSON.stringify({
  status: 'REVIEWER_SHAPE_DIAGNOSTIC_G3_CLOSED', inputSha256: sha(before),
  ajvVersion: requireFrontend('ajv/package.json').version, formatMode: 'full',
  projectedDraft: 'Draft-07; unsupported keywords/ref siblings rejected, no owner semantics',
  compiledSchemas: validators.size, fixtureCases, fixtureFailures: issues, probes,
  unverifiedReferenceAnnotations,
  unresolvedOperationOwnerLabels, plannedSchemaNames: schemaNames,
  cancellationDeclaredWrites: cancellation.writesTables,
  cancellationBranchWriteSets: cancellation.branchWriteSets,
  negativeCatalogConcreteObjects: p.negativeCaseCatalog.filter(item => typeof item.input === 'object').length,
  inputUnchanged: true, domainExecution: p.domainExecution,
}, null, 2));
process.exitCode = issues.length ? 1 : 0;
