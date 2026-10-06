#!/usr/bin/env node
'use strict';

// Read-only standard-schema/selected topology checks; not business/crypto proof.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const frontend = process.argv[2];
if (!frontend || !path.isAbsolute(frontend)) throw new Error('Explicit absolute frontend checkout required.');
const Ajv = createRequire(path.join(frontend, 'package.json'))('ajv');
const file = path.join(__dirname, 'sys-listening-admission-exact.proposal.v1.json');
const before = fs.readFileSync(file);
const proposal = JSON.parse(before);
assert.equal(proposal.status, 'DESIGN_PROPOSED_NOT_CANONICAL');
assert.equal(proposal.g3Authorization, 'NONE');
assert.equal(proposal.domainExecution, 'NOT_EXECUTED_G4');
const engine = new Ajv({ allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
const validators = new Map(Object.entries(proposal.jsonSchemas).map(([id, schema]) => [id, engine.compile(schema)]));
let schemaCases = 0;
const clone = value => JSON.parse(JSON.stringify(value));
const check = (id, value, expected) => {
  assert.equal(validators.get(id)(value), expected, id);
  schemaCases += 1;
};
const uuid = '90000000-0000-4000-8000-000000000801';
const token = 'A'.repeat(43); // TEST_ONLY shape; not cryptographic issuer entropy proof.
const envelope = 'signed-fixture-only-'.repeat(10); // Not signed, no crypto execution claimed.
const answer = { questionKey: 'satisfaction', kind: 'SCALE', value: '4.0000' };
const samples = {
  'SYS.ListeningAnswer.proposal.v1': answer,
  'SYS.ListeningSubmitRequest.proposal.v1': { participationEnvelope: envelope, responseToken: token, formRevision: 1, answers: [answer] },
  'SYS.ListeningReplayRequest.proposal.v1': { participationEnvelope: envelope, responseToken: token },
  'SYS.ListeningEraseRequest.proposal.v1': { participationEnvelope: envelope, responseToken: token, reasonCode: 'SELF_PRIVACY_REQUEST' },
  'SYS.ListeningProtectedReceipt.proposal.v1': { receiptPublicId: uuid, status: 'ACCEPTED' },
  'SYS.ListeningProtectedErasureReceipt.proposal.v1': { erasureReceiptPublicId: uuid, status: 'PENDING' },
  'SYS.ListeningKeyErasureResult.proposal.v1': { erasureRequestPublicId: uuid, keyReference: 'fixture-key-ref', status: 'REVOKED', keyAuthorityRevision: 1, checkedAt: '2026-09-14T01:00:00Z' },
};
for (const [id, sample] of Object.entries(samples)) {
  check(id, sample, true);
  check(id, { ...sample, unknown: true }, false);
  for (const key of Object.keys(sample)) {
    const missing = clone(sample); delete missing[key]; check(id, missing, false);
    check(id, { ...sample, [key]: null }, false);
  }
}
const answerId = 'SYS.ListeningAnswer.proposal.v1';
check(answerId, { questionKey: 'q', kind: 'CHOICE', choiceKeys: ['a'] }, true);
check(answerId, { questionKey: 'q', kind: 'RESTRICTED_TEXT', text: 'fixture text' }, true);
check(answerId, { ...answer, value: 4 }, false);
check(answerId, { ...answer, choiceKeys: ['a'] }, false);
check(answerId, { questionKey: 'q', kind: 'CHOICE', choiceKeys: ['a', 'a'] }, false);
check(answerId, { questionKey: 'q', kind: 'RESTRICTED_TEXT', text: 'x'.repeat(10001) }, false);
check('SYS.ListeningSubmitRequest.proposal.v1', { ...samples['SYS.ListeningSubmitRequest.proposal.v1'], formRevision: '1' }, false);
check('SYS.ListeningProtectedReceipt.proposal.v1', { receiptPublicId: uuid, status: 'ERASED' }, true);
for (const field of proposal.publicReceiptProjection.forbidden) {
  check('SYS.ListeningProtectedReceipt.proposal.v1', { receiptPublicId: uuid, status: 'ACCEPTED', [field]: field }, false);
}
const ownerRef = ownerContractId => ({ ownerContractId, schemaVersion: 1,
  publicId: uuid, revision: 1, contentSha256: 'a'.repeat(64) });
const control = { surveyPublicId: uuid, expectedAdmissionRevision: 0,
  formVersionRef: ownerRef('SYS.ListeningFormVersion.proposal.v1'),
  privacyVersionRef: ownerRef('SYS.ListeningPrivacyVersion.proposal.v1'),
  retentionVersionRef: ownerRef('SYS.ListeningRetentionVersion.proposal.v1'),
  opensAt: '2026-09-14T01:00:00Z', closesAt: '2026-09-15T01:00:00Z',
  sourcePublicationRevision: 1, contentSha256: 'b'.repeat(64) };
const controlId = 'SYS.ListeningAdmissionControlRequest.proposal.v1';
check(controlId, control, true);
for (const [field, wrong] of [['formVersionRef', 'SYS.ListeningPrivacyVersion.proposal.v1'],
  ['privacyVersionRef', 'SYS.ListeningFormVersion.proposal.v1'],
  ['retentionVersionRef', 'SYS.ListeningFormVersion.proposal.v1']]) {
  check(controlId, { ...control, [field]: ownerRef(wrong) }, false);
}
for (const value of ['04.0000', '-0.0000', '+4.0', '4e0']) {
  check(answerId, { ...answer, value }, false);
  check('SYS.ListeningSubmitRequest.proposal.v1',
    { ...samples['SYS.ListeningSubmitRequest.proposal.v1'], answers: [{ ...answer, value }] }, false);
}
for (const value of ['0.0000', '-0.0001', '4.0000']) check(answerId, { ...answer, value }, true);
const cohortId = 'SYS.ListeningCohortResult.proposal.v1';
const cohort = { resultPublicId: uuid, status: 'COMPLETED', adequacyCategory: 'ADEQUATE',
  measures: [{ questionKey: 'q', status: 'COMPLETED', meanValue: '4.0000', unit: 'SCALE_POINT' }],
  privacyRevision: 1, queryEpochPublicId: uuid, sourceRevision: 1 };
check(cohortId, cohort, true);
check(cohortId, { ...cohort, status: 'SUPPRESSED' }, false);
check(cohortId, { ...cohort, status: 'SUPPRESSED', adequacyCategory: 'INSUFFICIENT', measures: [] }, true);
check(cohortId, { ...cohort, measures: [] }, false);
check(cohortId, { ...cohort, measures: [{ ...cohort.measures[0], meanValue: null }] }, false);
check(cohortId, { ...cohort, measures: [{ ...cohort.measures[0], status: 'SUPPRESSED' }] }, false);
check(cohortId, { ...cohort, measures: [cohort.measures[0],
  { questionKey: 'optional-q', status: 'SUPPRESSED', meanValue: null, unit: 'SCALE_POINT' }] }, true);
// Draft-07 uniqueItems cannot enforce uniqueness of a nested key across different values.
// Deliberately preserve this witness and the OPEN owner-projection guard requirement.
const conflictingKeys = { ...cohort, measures: [cohort.measures[0],
  { ...cohort.measures[0], meanValue: '5.0000' }] };
check(cohortId, conflictingKeys, true);
assert.ok(proposal.remainingOpenG3.some(issue => issue.includes('question-key uniqueness')));
let boundaryChecks = 0;
const tables = new Map(proposal.tableSpecifications.map(table => [table.tableName, table]));
for (const table of tables.values()) {
  if (table.schema === 'hris_listening_protected') {
    assert.ok(['NO_PRINCIPAL_CREATED_BY_OR_GENERAL_COMMAND_RECEIPT',
      'NO_PRINCIPAL_OR_GENERAL_RECEIPT_OR_TRACE_LINK'].includes(table.createdByPolicy));
    boundaryChecks += 1;
    for (const column of table.columns) {
      assert.ok(!/(principal|worker|source_ip|raw_token|correlation|created_by)/.test(column.name), column.name);
      boundaryChecks += 1;
    }
  }
  for (const fk of table.foreignKeys) {
    const target = tables.get(fk.targetTable);
    assert.ok(target, fk.targetTable);
    assert.equal(target.schema, table.schema);
    assert.equal(fk.columns[0], 'tenant_id');
    assert.equal(fk.targetColumns[0], 'tenant_id');
    assert.ok(target.uniqueKeys.some(key => JSON.stringify(key) === JSON.stringify(fk.targetColumns)));
    boundaryChecks += 1;
  }
}
for (const op of proposal.operations) {
  assert.ok(validators.has(op.inputSchemaRef));
  assert.ok(validators.has(op.responseSchemaRef));
  for (const table of op.businessWrites) assert.ok(tables.has(table), table);
  if (op.transition) assert.ok(!Array.isArray(op.transition.to), 'guarded outcomes required, not pseudo-state');
  boundaryChecks += 1;
}
assert.deepEqual(fs.readFileSync(file), before);
console.log(JSON.stringify({ status: 'PROPOSAL_STANDARD_SCHEMA_AND_SELECTED_BOUNDARY_CHECK_PASS',
  schemaCount: validators.size, schemaCases, boundaryChecks,
  sourceSha256: crypto.createHash('sha256').update(before).digest('hex'),
  cryptographicEnvelopeAndEntropy: 'NOT_VERIFIED', ownerSourceAndACL: 'NOT_VERIFIED',
  erasureAndCohortDomainExecution: 'NOT_EXECUTED_G4', ownerQuestionKeyUniqueness: 'OPEN_NOT_IMPLEMENTED',
  independentApproval: 'NONE', g3Authorization: 'NONE' }));
