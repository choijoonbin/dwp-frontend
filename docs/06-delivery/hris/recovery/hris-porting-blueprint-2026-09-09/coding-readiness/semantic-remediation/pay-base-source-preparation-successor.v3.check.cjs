#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {createRequire} = require('node:module'), {spawnSync} = require('node:child_process');
const D = require('./pay-base-source-preparation-successor.v3.design.cjs');
const M = require('./pay-base-source-preparation-successor.v3.model.cjs');
const S = require('./pay-base-v2-independent-strict-check.v1.cjs');
const frontend = path.resolve(process.argv[2] || '/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend');
const ownSuffixes = ['.design.cjs', '.model.cjs', '.check.cjs', '.json', '.schemas.json', '.fixtures.json', '.nullable.json', '.source-contract.json', '.allocation.json', '.record-outputs.json', '.md'];
const rootFiles = ['pay-base-v2-independent-strict-check.v1.cjs', 'pay-base-v2-independent-strict-check.v1.test.cjs'].map(n => path.join(D.dir, n));
const frozenFiles = fs.readdirSync(D.dir).filter(n => n.startsWith(D.oldPrefix + '.')).map(n => path.join(D.dir, n));
const sourceFiles = [...new Set([...rootFiles, ...frozenFiles, ...D.sourceContract().nativePins.map(x => x.path), ...ownSuffixes.map(s => path.join(D.dir, D.prefix + s)), path.join(D.dir, '../reports/pay-v2-draft-native-root-type-rls-pass-2026-09-14.json'), path.join(D.dir, 'sys-stream-authority-decision.proposal.v1.md')])];
const startedAt = new Date().toISOString(), before = sourceFiles.map(D.pin);
let assertions = 0;
const check = (condition, label) => { assert.ok(condition, label); assertions++; };
function replay(argv) {
  const start = new Date().toISOString();
  const result = spawnSync(process.execPath, argv, {encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024});
  check(result.status === 0, 'bounded replay exit0 ' + result.stderr);
  return {argv: [process.execPath, ...argv], startedAt: start, finishedAt: new Date().toISOString(), exitCode: result.status, stdoutSha256: D.sha(result.stdout), stderrSha256: D.sha(result.stderr), stdout: result.stdout};
}
try {
  const strictUnits = replay(['--test', '--test-reporter=tap', rootFiles[1]]);
  check(/# tests 10\b/.test(strictUnits.stdout) && /# pass 10\b/.test(strictUnits.stdout) && /# fail 0\b/.test(strictUnits.stdout), 'actual independent strict10 units');
  const strictCli = replay([rootFiles[0], frontend]), strictResult = JSON.parse(strictCli.stdout);
  check(strictResult.sourceIssues.length === 0 && strictResult.status === 'BOUNDED_STRUCTURE_PASS_SOURCE_PREPARATION_STILL_OPEN', 'root CLI fatal diagnostics result');
  const p = D.read(D.prefix + '.json'), schemas = D.read(D.prefix + '.schemas.json'), fixtures = D.read(D.prefix + '.fixtures.json'), nullable = D.read(D.prefix + '.nullable.json');
  check(JSON.stringify(p) === JSON.stringify(D.proposal()), 'saved exact proposal matches author source builder');
  check(JSON.stringify(schemas) === JSON.stringify(D.schemas()), 'saved complete schema document matches builder');
  check(JSON.stringify(fixtures) === JSON.stringify(M.fixtures()), 'saved full API/source-row fixtures match builder');
  check(JSON.stringify(nullable.declarations) === JSON.stringify(D.nullableDeclarations()), 'all150 savedDDL/native sidecar declarations exact');
  const sourceContract = D.read(D.prefix + '.source-contract.json'), allocation = D.read(D.prefix + '.allocation.json');
  check(JSON.stringify(sourceContract) === JSON.stringify(D.sourceContract()), 'exact current source column/owner/query/native version pins');
  check(JSON.stringify(allocation) === JSON.stringify(D.allocation()), 'exact source producer/consumer/schema/test file ownership');
  check(nullable.declarations.length === 150, '150 exact nullability declarations, not150 semantics approval');
  check(p.CURRENT_PUBLISHED === false && p.gateAuthorization === 'NONE' && p.all119ExactSourceClosed === false, 'author-only not canonical/all119/G3 approval');
  assert.deepEqual(p.operationRegistry.map(o => o.operationId), D.frozen.operationRegistry.map(o => o.operationId)); assertions++;
  check(p.operationRegistry.length === 119 && p.operationRegistry.every(o => o.remaining.length > 0), 'all119 gaps honest; not independent expected oracle');
  for (const pin of p.inputManifest) check(D.pin(pin.path).sha256 === pin.sha256 && D.pin(pin.path).mtimeNs === pin.mtimeNs, 'actual pinned source ' + pin.path);
  const forbidden = new Set(['unevaluatedProperties', 'unevaluatedItems', 'prefixItems', '$dynamicRef', '$dynamicAnchor', 'dependentSchemas', 'dependentRequired', '$recursiveRef']);
  let recursiveSchemaNodes = 0;
  function schemaWalk(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(schemaWalk);
    for (const [key, child] of Object.entries(value)) { check(!forbidden.has(key), 'unsupported Draft07 projection'); if (key === '$ref') check(child.startsWith('#/$defs/'), 'exact local ref'); schemaWalk(child); }
    if (value.$ref) check(Object.keys(value).every(k => ['$ref', 'description', 'title', '$comment', 'examples', 'default', 'referenceContract'].includes(k) || k.startsWith('x-')), 'no discarded constrained ref sibling');
    recursiveSchemaNodes++;
  }
  const defs = {...D.historical.$defs, ...D.v2schemas.$defs, ...D.foundationSchemas.$defs, ...schemas.$defs};
  schemaWalk(defs);
  const rf = createRequire(path.join(frontend, 'package.json')), Ajv = rf('ajv');
  const ajv = new Ajv({allErrors: true, format: 'full', coerceTypes: false, useDefaults: false, removeAdditional: false, logger: false});
  const id = 'urn:dwp:pay:v3:complete-draft07-author';
  ajv.addSchema({$schema: 'http://json-schema.org/draft-07/schema#', $id: id, $defs: defs});
  const validators = new Map(Object.keys(defs).map(k => [k, ajv.compile({$ref: id + '#/$defs/' + k})]));
  function shape(name, value) { const v = validators.get(name); check(!!v, 'real named schema ' + name); check(v(value), name + ': ' + JSON.stringify(v.errors)); }
  function leaves(value, prefix = '', out = []) { if (value !== null && typeof value === 'object') { for (const [k, child] of Object.entries(value)) leaves(child, prefix + '/' + k, out); } else out.push([prefix, value]); return out; }
  const at = (value, pointer) => pointer.split('/').slice(1).reduce((a, k) => a[k], value);
  let normalizedLeaves = 0, localRowSchemas = 0, ownerCases = 0, actualMaterializedPrimitiveValues = 0;
  const outputs = [];
  for (const f of [...fixtures.positive, ...fixtures.input, ...fixtures.negative]) {
    shape(f.bodySchemaRef, f.body);
    const old = D.historical.operationDeltas.find(o => o.operationId === f.operationId);
    shape(old.pathSchemaRef, f.path); shape(old.headerSchemaRef, f.headers);
    shape('PAYV3.Actor', f.actor); shape('PAYV3.Authority', f.authority);
    if (f.source) shape('PAYV3.SourcePayload', f.source);
  }
  for (const f of fixtures.positive) {
    const out = M.foundation(f); check(out.status === 'SUCCEEDED', f.fixtureId + ' actual guarded oracle');
    shape('PAY.Receipt', out.receipt);
    const payloadTable = D.frozen.tablePlans.find(t => t.table === D.foundations.find(r => r.operationId === f.operationId).table);
    check(Object.keys(out.payloadRow).length === payloadTable.columns.length, 'all selected actual materialized row columns');
    for (const column of payloadTable.columns) {
      const forwardNullable = payloadTable.table === 'pay_gl_mapping_rule_versions' && column.name === 'source_element_key' ? true : column.nullable;
      check(Object.hasOwn(out.payloadRow, column.name) && M.sqlValueValid(column.sqlType, out.payloadRow[column.name], forwardNullable), 'actual SQL primitive/null value type ' + payloadTable.table + '.' + column.name); actualMaterializedPrimitiveValues++;
    }
    if (payloadTable.table === 'pay_pay_groups') check(out.payloadRow.legal_payroll_entity_id === f.localRows.find(r => r.kind === 'ENTITY' && r.payloadId === f.body.legalPayrollEntityId).internalId, 'actual UUID input resolves loaded native localBIGINT parent');
    shape('PAYV3.GovernanceSnapshot.' + f.body.governance.artifactKind, f.ownerGovernance); ownerCases++;
    const governanceQuery = {...f.body.governance, expectedPayloadDigest: f.body.governance.expectedPayloadDigest};
    shape('PAYV3.GovernanceQuery.' + f.body.governance.artifactKind, governanceQuery); ownerCases++;
    for (const row of f.localRows) { shape('PAYV3.LocalArtifact', row); localRowSchemas++; check(D.digest(row.payload) === row.payloadDigest, 'actual refetched full local payload digest'); }
    for (const [pointer, value] of leaves(f.body)) { check(JSON.stringify(at(out.artifact.normalized_payload, pointer)) === JSON.stringify(value), 'actual recursive body leaf preserved ' + pointer); normalizedLeaves++; }
    check(D.digest(out.artifact.normalized_payload) === out.artifact.payload_digest, 'complete normalized body digest');
    check(out.receipt.aggregateId === out.artifact.public_id && out.receipt.resultRef === out.artifact.public_id && out.artifact.payload_public_id !== out.artifact.public_id, 'actual distinct RETURNING artifact/payload/receipt binding');
    check(out.artifact.public_id !== f.headers['X-Correlation-Id'] && out.artifact.public_id !== out.receipt.receiptId, 'no audit business UUID alias');
    check(typeof out.artifact.owner_bindings.actingAuthorityTokens.permissionRevision === 'string', 'native token not numeric governance counter');
    const replayFixture = structuredClone(f); replayFixture.existingReceipt = out.receipt;
    const replayOut = M.foundation(replayFixture); check(replayOut.status === 'REPLAY' && replayOut.businessWrites.length === 0 && replayOut.outboxWrites.length === 0, 'current reauth idempotent saved result');
    const queryResponse = {artifactId: out.artifact.public_id, kind: out.artifact.artifact_kind, key: out.artifact.artifact_key, versionNo: out.artifact.version_no, payloadId: out.artifact.payload_public_id, payload: out.artifact.normalized_payload, payloadDigest: out.artifact.payload_digest, validFrom: f.body.validFrom, validTo: f.body.validTo, status: out.artifact.status, rowVersion: out.artifact.row_version, governance: f.ownerGovernance};
    shape('PAYV3.ArtifactQueryResult.' + out.artifact.artifact_kind, queryResponse);
    outputs.push({fixtureId: f.fixtureId, ...out, queryResponse});
  }
  for (const f of fixtures.input) {
    const out = M.ingest(f); check(out.status === 'SUCCEEDED', f.fixtureId);
    check(out.mockOwnerQueryCount === 1 && out.mockOwnerQueryTrace[0] === 'TIM_CLOSED_TIME', 'instrumented synthetic selected TIM callback1; optional PER/country/bank callbacks0, not native authority');
    check(out.businessWrites[0].input_snapshot_id === f.loadedSnapshot.internalId && out.businessWrites[1].ingest_receipt_id === f.returning.ingestInternalId, 'actual loaded/RETURNING internal parent tuple');
    check(D.digest(M.withoutDigest(out.businessWrites[1].public_payload)) === out.businessWrites[1].payload_digest, 'real typed payload not digest-only source');
    const replayF = structuredClone(f); replayF.existingReceipt = {requestDigest: out.requestDigest};
    check(M.ingest(replayF).businessWrites.length === 0, 'ingest replay zero source writes');
    outputs.push({fixtureId: f.fixtureId, ...out});
  }
  const savedOutputs = D.read(D.prefix + '.record-outputs.json');
  assert.deepEqual(savedOutputs.outputs, outputs); assertions++;
  check(savedOutputs.outputDigest === D.digest(outputs), 'actual executed records equal saved full-output digest');
  for (const f of fixtures.negative) {
    if (f.caseId.startsWith('PAY_NEG_')) {
      const original = D.read(D.oldPrefix + '.fixtures.json').typedBoundaryCases.find(c => c.caseId === f.caseId);
      check(!!original && original.operationId === f.operationId, 'original negative caseId+operationId exact scope, no unearned different-op closure');
      check(original.expected === f.expectedCode, 'original error status/code and opaque denial preserved');
    }
    const out = f.source ? M.ingest(f) : M.foundation(f);
    check(out.code === f.expectedCode, f.caseId + ' actual ' + out.code);
    check(out.businessWrites.length === 0 && out.outboxWrites.length === 0, 'typed negative writes0 ' + f.caseId);
    if (f.caseId === 'V3_PRIMARY_OR_MISSING_OWNER_NO_FALLBACK') check(out.mockOwnerQueryCount === 0 && out.mockOwnerQueryTrace.length === 0, 'actual synthetic adapter callback not invoked before unavailable denial');
  }
  // Exact physical source maps, not just counting source bindings or permitting unknowns.
  let physicalSourceColumns = 0;
  for (const command of p.foundationCommands) {
    for (const write of command.writes.filter(w => w.columns)) {
      const table = D.frozen.tablePlans.find(t => t.table === write.table); check(!!table, 'actual planned physical parent table');
      for (const bind of write.columns) { const c = table.columns.find(c => c.name === bind.column); check(!!c, 'actual source column exists'); if (bind.sqlType) check(bind.sqlType === c.sqlType, 'source SQL type equals saved planned type'); check(typeof bind.source === 'string' && !bind.source.startsWith('OPEN_MISSING'), 'exact selected source expression supplied'); physicalSourceColumns++; }
    }
  }
  for (const op of p.governancePort.operations) {
    check(Object.keys(defs[op.responseSchemaRef].properties).every(field => op.fieldSources[field]), 'all typed owner response fields source-bound');
    check(op.CURRENT_PUBLISHED === false, 'no owner label laundering');
  }
  check(p.governancePort.owner.schema === 'hris_configuration' && p.governancePort.owner.stream === 'platform-hris-configuration', 'root proposed exact SYS source namespace');
  const nativeV1 = fs.readFileSync(sourceContract.nativePins[0].path, 'utf8'), nativeV49 = fs.readFileSync(sourceContract.nativePins[1].path, 'utf8');
  const nativeV41 = fs.readFileSync(sourceContract.nativePins.find(p => p.path.endsWith('V41__harden_hcm_entity_boundaries.sql')).path, 'utf8');
  let nativeSourceColumns = 0;
  for (const [field, source] of Object.entries(sourceContract.employmentCarrierSources)) {
    const [table, column] = source.split('.');
    const block = nativeV1.match(new RegExp('CREATE TABLE ' + table + ' \\(([\\s\\S]*?)\\n\\);'));
    check(!!block, 'actual native owner table ' + table);
    const addedNativeUuid = column === 'public_id' && (table === 'ppl_legal_employers' ? /ADD COLUMN public_id UUID NOT NULL/.test(nativeV49) : new RegExp('ALTER TABLE ' + table + '\\s+ADD COLUMN public_id UUID NOT NULL').test(nativeV41));
    check(new RegExp('^\\s*' + column + '\\s', 'm').test(block[1]) || addedNativeUuid, 'actual native source column ' + field + '=' + source); nativeSourceColumns++;
  }
  check(new Set(allocation.rows.map(x => x.file)).size === allocation.rows.length && allocation.rows.every(x => x.file.endsWith('.java') && !x.file.includes('...')), 'exact unique planned Java/test files not shorthand');
  const expectedNativeReport = JSON.parse(fs.readFileSync(path.join(D.dir, '../reports/pay-v2-draft-native-root-type-rls-pass-2026-09-14.json')));
  for (const row of nullable.declarations) { const native = expectedNativeReport.catalog.columns.find(c => 'public.' + c.table === row.table && c.column === row.column); check(!!native && row.nullable === !native.notNull, 'saved root complete native catalog nullability'); }
  const mutations = [];
  function rejects(name, fn, code) { assert.throws(fn, code); assertions++; mutations.push(name); }
  const oldSql = fs.readFileSync(path.join(D.dir, D.oldPrefix + '.planned.sql'), 'utf8');
  const changed = structuredClone(D.frozen), entityFk = changed.tablePlans.find(t => t.table === 'pay_pay_groups');
  entityFk.columns.find(c => c.name === 'legal_payroll_entity_id').sqlType = 'TEXT';
  entityFk.sourceBindings.find(c => c.column === 'legal_payroll_entity_id').sqlType = 'TEXT';
  const changedSql = oldSql.replace(/(CREATE TABLE public\.pay_pay_groups \([\s\S]*?\n\s*legal_payroll_entity_id\s+)BIGINT/, '$1TEXT');
  rejects('joint FK SQL type + sourceBinding + DDL mutation fatal', () => S.validatePhysical(changed, changedSql), /FK_SQL_TYPE/);
  const diagnostic = {status: 'AUTHOR_STRUCTURE_FIXTURE_VERIFIED_G3_CLOSED', sourceIssues: ['real issue'], executionDrift: [], proposalInputPinDrift: [], nativeExecution: 0, productionOwnerRegistration: 0, all119ExactMutationSourceClosed: false, sourceFamilyMeaningIndependentlyApproved: false, openInitialSources: 856, unmatchedFullAPINegativePayloads: ['open']};
  rejects('nonempty sourceIssues actual fatal', () => S.validateReceipt(diagnostic), /UNREJECTED_sourceIssues/);
  delete diagnostic.sourceIssues;
  rejects('missing sourceIssues mandatory fatal', () => S.validateReceipt(diagnostic), /sourceIssues/);
  const badSchema = structuredClone(fixtures.positive[0]); badSchema.body.legalEmployerRef.publicId = 42;
  check(validators.get(badSchema.bodySchemaRef)(badSchema.body) === false, 'native UUID scalar numeric mutation rejected'); mutations.push('UUID as numeric rejected');
  const badToken = structuredClone(fixtures.positive[0].authority); badToken.permissionRevision = 17;
  check(validators.get('PAYV3.Authority')(badToken) === false, 'native permission token not numeric governance counter'); mutations.push('numeric native token rejected');
  const badPayload = structuredClone(fixtures.positive[0]); badPayload.body.untypedCompanyConstant = 999;
  check(validators.get(badPayload.bodySchemaRef)(badPayload.body) === false, 'untyped/company input schema rejected'); mutations.push('extra arbitrary payload field rejected');
  check(!M.sqlValueValid('BIGINT', fixtures.positive[0].allocated.payloadId, false), 'actual UUID value cannot fill local BIGINT FK'); mutations.push('UUID value as localBIGINT rejected');
  check(!M.sqlValueValid('DATE', '2026-09-14T00:00:00Z', false), 'Instant cannot fill inclusive DATE native column'); mutations.push('Instant value as DATE rejected');
  const after = sourceFiles.map(D.pin); assert.deepEqual(after, before); assertions++;
  const original39 = D.read(D.oldPrefix + '.evidence.json').unmatchedFullAPINegativePayloads;
  const remaining39 = original39.filter(id => !fixtures.former39ConcreteCaseIds.includes(id));
  delete strictUnits.stdout; delete strictCli.stdout;
  console.log(JSON.stringify({status: 'AUTHOR_SELECTED_SOURCE_STRUCTURE_AND_CONCRETE_FIXTURE_VERIFIED_G3_CLOSED', startedAt, finishedAt: new Date().toISOString(), actualArgv: process.argv, node: process.version, ajv: rf('ajv/package.json').version, schemaEngine: 'installed Ajv full Draft07, no coerce/default/removeAdditional, all recursive refs/leaf values', assertions, compiledDefinitions: validators.size, recursiveSchemaNodes, normalizedBodyLeaves: normalizedLeaves, physicalSourceColumns, actualMaterializedPrimitiveValues, nativeSourceColumns, plannedSourceAndTestFiles: allocation.rows.length, actualLocalArtifactSchemas: localRowSchemas, ownerRequestResponseCases: ownerCases, foundationPositive: fixtures.positive.length, inputPositive: fixtures.input.length, concreteNegatives: fixtures.negative.length, former39Concrete: fixtures.former39ConcreteCaseIds, remainingFormer39: remaining39, originalOpen856Unmodified: true, nullableDeclarations: nullable.declarations.length, strictIndependentReplay: {units: strictUnits, cli: strictCli, strictResult}, mutations, actualOutputArtifact: {...D.pin(path.join(D.dir, D.prefix + '.record-outputs.json')), outputDigest: D.digest(outputs), syntheticOnly: true, actualOutputCount: outputs.length}, outputDigest: D.digest(outputs), sourcePinsBefore: before, sourcePinsAfter: after, sourcesUnchanged: true, sourceIssues: [], publication: {CURRENT_PUBLISHED: false, all119ExactSourceClosed: false, sourceFamilyMeaningIndependentlyApproved: false, actualDomainDml: 0, actualNativeOwnerAuthorization: 0, nativePgReproducedByThisAuthor: 0, G3Approval: false}}, null, 2));
} catch (e) { console.error(JSON.stringify({status: 'ACTUAL_AUTHOR_CHECK_FAIL', startedAt, finishedAt: new Date().toISOString(), error: e.message, stack: e.stack})); process.exitCode = 1; }
