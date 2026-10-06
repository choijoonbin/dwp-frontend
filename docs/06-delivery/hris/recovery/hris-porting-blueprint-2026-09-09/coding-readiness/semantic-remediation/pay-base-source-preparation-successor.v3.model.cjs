'use strict';
// Executable planned-contract oracle, synthetic only. No SQL, native authorization or DML.
const D = require('./pay-base-source-preparation-successor.v3.design.cjs');
const clone = value => structuredClone(value);
const uuid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
function withoutDigest(value) { const c = clone(value); delete c.payloadDigest; return c; }
const fail = (code, trace = []) => ({status: 'REJECTED', code, businessWrites: [], outboxWrites: [], mockOwnerQueryTrace: trace.slice(), mockOwnerQueryCount: trace.length});
function collectRefs(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (value.artifactId && value.artifactType) out.push(value);
  for (const child of Object.values(value)) collectRefs(child, out);
  return out;
}
function basicGuard(f) {
  if (!f.authority.appEntitled) return fail('403_ENTITLEMENT_REVOKED');
  const expectedPurpose = f.operationId === 'pay.input.source.ingest' ? 'PAY_INPUT_SOURCE_INGEST' : 'PAY_CONFIG_MANAGE';
  if (f.authority.purpose !== expectedPurpose) return fail('403_PURPOSE_DENIED');
  if (Date.parse(f.authority.expiresAt) <= Date.parse(f.clock)) return fail('403_AUTHORITY_EXPIRED');
  if (f.registryPublished === false) return fail('503_OWNER_UNAVAILABLE');
  return null;
}
function materializedPayload(route, f) {
  const b = f.body;
  const loadedRef = reference => reference === null ? null : f.localRows.find(r => r.publicId === reference.artifactId && r.tenantId === f.actor.tenantId);
  const row = {public_id: f.allocated.payloadId, tenant_id: f.actor.tenantId, status: 'DRAFT', valid_from: b.validFrom, valid_to: b.validTo, row_version: 0, created_at: f.clock, created_by: f.actor.principalPublicId, [route.internalId]: f.syntheticReturning.payloadInternalId};
  const byKind = {
    ENTITY: () => ({entity_key: b.entityKey, legal_entity_public_id: f.legalEmployer.publicId, jurisdiction_code: b.jurisdictionCode, base_currency: b.baseCurrency, time_zone: b.timeZone}),
    PAYGROUP: () => ({legal_payroll_entity_id: f.localRows.find(r => r.kind === 'ENTITY' && r.payloadId === b.legalPayrollEntityId && r.tenantId === f.actor.tenantId).internalId, group_key: b.groupKey, frequency_code: b.frequency, currency_code: b.currency, payment_method: b.paymentMethod, eligibility_policy_ref: loadedRef(b.eligibilityArtifact).payloadId}),
    CALENDAR: () => ({calendar_key: b.calendarKey, version_no: f.counter.loadedNextVersionNo, periods_payload: D.sorted(b.periods), payload_digest: D.digest(D.sorted(b)), time_zone_policy: 'PER_PERIOD_OWNER_ZONE'}),
    ROUNDING: () => ({policy_key: b.policyKey, version_no: f.counter.loadedNextVersionNo, jurisdiction_code: null}),
    ELIGIBILITY: () => ({policy_key: b.policyKey, version_no: f.counter.loadedNextVersionNo, input_schema: D.sorted(b.inputs), ast_payload: D.sorted(b.expression), output_type: b.outputType.valueType, payload_digest: D.digest(D.sorted(b))}),
    ELEMENT: () => ({element_key: b.elementKey, version_no: f.counter.loadedNextVersionNo, name_key: b.nameKey, element_type: b.elementType, unit: b.valueType.unit, currency_code: b.valueType.currency, processing_priority: b.processingPriority, eligibility_policy_ref: loadedRef(b.eligibilityArtifact)?.payloadId ?? null, formula_public_id: loadedRef(b.formulaArtifact)?.payloadId ?? null, tax_classification: b.classification.taxCode, insurance_classification: b.classification.insuranceCode, accounting_classification: b.classification.accountingCode, validation_digest: null, approved_by: null, approved_at: null, published_at: null}),
    FORMULA: () => ({formula_key: b.formulaKey, version_no: f.counter.loadedNextVersionNo, language_version: b.languageVersion, input_schema: D.sorted(b.inputs), output_type: b.outputType.valueType, output_unit: b.outputType.unit, ast_payload: D.sorted(b.expression), function_set_version: f.ownerGovernance.operatorRegistryVersion, rounding_policy_public_id: loadedRef(b.roundingArtifact).payloadId, compiled_digest: null, golden_digest: null, max_nodes: b.limits.maxNodes, max_depth: b.limits.maxDepth, timeout_millis: b.limits.timeoutMillis, approved_by: null, approved_at: null, published_at: null}),
    GL_MAPPING: () => ({mapping_key: b.mappingKey, version_no: f.counter.loadedNextVersionNo, source_element_key: null, debit_account_ref: null, credit_account_ref: null, cost_object_mapping_ref: null})
  };
  return {...row, ...byKind[route.kind]()};
}
function sqlValueValid(sqlType, value, nullable) {
  if (value === null) return nullable === true;
  if (/^(BIGSERIAL|BIGINT|INTEGER|SERIAL)$/.test(sqlType)) return Number.isSafeInteger(value);
  if (sqlType === 'UUID') return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
  if (sqlType === 'JSONB') return value !== null && typeof value === 'object';
  if (sqlType === 'DATE') return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
  if (sqlType === 'TIMESTAMPTZ') return typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (sqlType === 'BOOLEAN') return typeof value === 'boolean';
  const bounded = sqlType.match(/^(?:VAR)?CHAR\((\d+)\)$/);
  if (bounded) return typeof value === 'string' && value.length <= Number(bounded[1]);
  return false; // No untyped numeric/text fallback accepted in this bounded primitive subset.
}
function foundation(f) {
  const denied = basicGuard(f); if (denied) return denied;
  const trace = [], deny = code => fail(code, trace);
  const readMockOwner = (name, response) => {trace.push(name); return clone(response);};
  const route = D.foundations.find(r => r.operationId === f.operationId);
  if (f.authority.originatingAction !== D.historical.operationDeltas.find(o => o.operationId === f.operationId).action) return deny('403_ACTION_MISMATCH');
  const body = D.sorted(f.body), gov = readMockOwner('SYS_GOVERNANCE_' + route.kind, f.ownerGovernance);
  if (gov.artifactKind !== route.kind || f.body.governance.artifactKind !== route.kind) return deny('409_OWNER_KIND_MISMATCH');
  if (f.sourceTenantId !== f.actor.tenantId) return deny('404_OPAQUE');
  if (Date.parse(gov.expiresAt) <= Date.parse(f.clock)) return deny('409_OWNER_STALE');
  if (D.digest(withoutDigest(gov)) !== gov.payloadDigest || body.governance.expectedPayloadDigest !== gov.payloadDigest) return deny('409_OWNER_DIGEST');
  if (body.governance.expectedOwnerRevision !== gov.ownerRevision || body.governance.expectedPolicyRevision !== gov.policyRevision) return deny('409_OWNER_REVISION');
  if (D.digest(body.governance.scope) !== D.digest(gov.scope) || body.governance.asOf !== gov.asOf || body.validFrom !== gov.validFrom || body.validTo !== gov.validTo) return deny('409_OWNER_SCOPE_OR_ASOF');
  if (route.kind === 'PAYGROUP' && gov.scope.payGroupId !== null) return deny('409_FUTURE_GROUP_PREREQUISITE');
  if (route.kind === 'ENTITY') {
    const employer = readMockOwner('PEOPLE_NATIVE_LEGAL_EMPLOYER', f.legalEmployer);
    if (employer.tenantId !== f.actor.tenantId) return deny('404_OPAQUE');
    if (employer.publicId !== body.legalEmployerRef.publicId || employer.version !== body.legalEmployerRef.expectedVersion) return deny('409_NATIVE_EMPLOYER_STALE');
    if (employer.lifecycleState !== 'ACTIVE') return deny('409_NATIVE_EMPLOYER_INACTIVE');
  }
  for (const reference of collectRefs(body)) {
    const row = f.localRows.find(r => r.publicId === reference.artifactId && r.tenantId === f.actor.tenantId);
    if (!row) return deny('404_OPAQUE');
    if (row.kind !== ({LEGAL_ENTITY: 'ENTITY', PAY_GROUP: 'PAYGROUP'}[reference.artifactType] || reference.artifactType)) return deny('404_OPAQUE');
    if (row.versionNo !== reference.versionNo || row.payloadDigest !== reference.payloadDigest || D.digest(row.payload) !== row.payloadDigest) return deny('409_LOCAL_REF_STALE_OR_DIGEST');
    if (row.status !== 'PUBLISHED') return deny('409_LOCAL_REF_UNPUBLISHED');
  }
  if (route.kind === 'PAYGROUP') {
    const entity = f.localRows.find(r => r.payloadId === body.legalPayrollEntityId && r.kind === 'ENTITY' && r.tenantId === f.actor.tenantId);
    if (!entity) return deny('404_OPAQUE');
  }
  if (body.rules && new Set(body.rules.map(r => r.stage)).size !== body.rules.length) return deny('422_DUPLICATE_ROUNDING_STAGE');
  const requestDigest = D.digest({operationId: f.operationId, path: f.path, body, tenantId: f.actor.tenantId, actorId: f.actor.principalPublicId, originatingAction: f.authority.originatingAction});
  if (f.existingReceipt) {
    if (f.existingReceipt.requestDigest !== requestDigest) return deny('409_IDEMPOTENCY_CONFLICT');
    return {status: 'REPLAY', businessWrites: [], outboxWrites: [], mockOwnerQueryTrace: trace.slice(), mockOwnerQueryCount: trace.length, receipt: f.existingReceipt};
  }
  const artifactId = f.allocated.artifactId, payloadId = f.allocated.payloadId;
  const artifact = {public_id: artifactId, tenant_id: f.actor.tenantId, artifact_kind: route.kind, artifact_key: body[route.key], version_no: f.counter.loadedNextVersionNo, payload_table: route.table, payload_public_id: payloadId, schema_version: route.bodySchemaRef, normalized_payload: body, payload_digest: D.digest(body), owner_bindings: {governance: gov, legalEmployer: route.kind === 'ENTITY' ? f.legalEmployer : null, actingAuthorityTokens: {permissionRevision: f.authority.permissionRevision, populationRevision: f.authority.populationRevision, fieldPolicyRevision: f.authority.fieldPolicyRevision}}, normalization_version: 'SORT_OBJECT_KEYS_PRESERVE_ORDERED_ARRAYS_NO_COERCION_V1', row_version: 0, status: 'DRAFT', created_at: f.clock, created_by: f.actor.principalPublicId};
  const receipt = {receiptId: f.allocated.receiptId, commandType: f.authority.originatingAction, originatingAction: f.authority.originatingAction, subjectPrincipalPublicId: f.actor.principalPublicId, populationScopeDigest: f.authority.populationDigest, fieldPolicyRevision: f.legacyPayCounters.fieldPolicy, purposeCode: f.authority.purpose, authorizationRevision: f.legacyPayCounters.authorization, status: 'SUCCEEDED', aggregateId: artifactId, aggregateRevision: 0, resultRef: artifactId, requestDigest, correlationId: f.headers['X-Correlation-Id'], createdAt: f.clock, completedAt: f.clock};
  const event = {eventId: f.allocated.eventId, artifactId, payloadId, artifactKind: route.kind, versionNo: artifact.version_no, rowVersion: artifact.row_version, payloadDigest: artifact.payload_digest, governanceRef: gov.snapshotId, governanceOwnerRevision: gov.ownerRevision, governanceDigest: gov.payloadDigest};
  const payloadRow = materializedPayload(route, f);
  return {status: 'SUCCEEDED', businessWrites: [{table: route.table, row: payloadRow}, {table: 'pay_config_artifact_versions', row: artifact}, {table: 'pay_artifact_revision_counters', next_version_no: artifact.version_no + 1, row_version: f.counter.loadedRowVersion + 1}], outboxWrites: [{table: 'pay_outbox_events', event, digest: D.digest(event)}], mockOwnerQueryTrace: trace.slice(), mockOwnerQueryCount: trace.length, receipt, artifact, event, payloadRow, unavailableNativeProduction: ['current production authority/PEP and source transport', ...(route.kind === 'GL_MAPPING' ? ['Finance.AccountRegistrySnapshot full owner query+source/owner assignment not defined in current common registry; fixture validates local/type/schema only, not account ownership validity'] : [])]};
}
function ingest(f) {
  const denied = basicGuard(f); if (denied) return denied;
  const trace = [], deny = code => fail(code, trace);
  const readMockOwner = (name, response) => {trace.push(name); return clone(response);};
  if (f.loadedRun.tenantId !== f.actor.tenantId || f.loadedSnapshot.tenantId !== f.actor.tenantId) return deny('404_OPAQUE');
  if (f.body.runId !== f.path.runId || f.body.runId !== f.loadedRun.publicId || f.loadedRun.snapshotInternalId !== f.loadedSnapshot.internalId) return deny('409_PARENT_BINDING');
  if (Number(f.headers['If-Match'].slice(1, -1)) !== f.loadedRun.rowVersion) return deny('409_CAS');
  if (f.loadedSnapshot.status !== 'DRAFT') return deny('409_SNAPSHOT_IMMUTABLE');
  const source = readMockOwner('TIM_CLOSED_TIME', f.source);
  if (f.body.sourceKind !== 'TIM_CLOSED_TIME' || source.contractRef !== f.body.sourceSelector.contractRef) return deny('409_SOURCE_KIND');
  if (source.tenantId !== f.actor.tenantId) return deny('404_OPAQUE');
  if (source.ownerObjectId !== f.body.sourceSelector.ownerObjectId || source.ownerRevision !== f.body.sourceSelector.ownerRevision) return deny('409_OWNER_REVISION');
  if (Date.parse(source.asOf) !== Date.parse(f.loadedSnapshot.asOf) || Date.parse(source.asOf) !== Date.parse(f.body.sourceSelector.asOf)) return deny('422_SOURCE_STALE');
  if (source.status !== 'CLOSED') return deny('422_SOURCE_SUPERSEDED');
  if (D.digest(withoutDigest(f.source)) !== source.payloadDigest || source.payloadDigest !== f.body.sourceSelector.payloadDigest) return deny('422_SOURCE_DIGEST_MISMATCH');
  if (source.lines.length !== source.declaredLineCount || source.lines.some((l, i) => l.lineNo !== i + 1)) return deny('422_SOURCE_SEQUENCE_OR_COUNT');
  const normalized = D.sorted(f.body), requestDigest = D.digest({body: normalized, operationId: f.operationId, actor: f.actor.principalPublicId, tenantId: f.actor.tenantId, path: f.path});
  if (f.existingReceipt) return f.existingReceipt.requestDigest === requestDigest ? {status: 'REPLAY', businessWrites: [], outboxWrites: [], mockOwnerQueryTrace: trace.slice(), mockOwnerQueryCount: trace.length, requestDigest} : deny('409_IDEMPOTENCY_CONFLICT');
  return {status: 'SUCCEEDED', requestDigest, mockOwnerQueryTrace: trace.slice(), mockOwnerQueryCount: trace.length, businessWrites: [{table: 'pay_input_source_ingest_receipts', input_snapshot_id: f.loadedSnapshot.internalId, public_id: f.allocated.ingestId, expected_digest: f.body.sourceSelector.payloadDigest, actual_digest: source.payloadDigest, actual_line_count: source.lines.length, status: 'VERIFIED'}, {table: 'pay_owner_snapshot_payloads', ingest_receipt_id: f.returning.ingestInternalId, public_payload: source, payload_digest: source.payloadDigest}, {table: 'pay_input_source_vectors', input_snapshot_id: f.loadedSnapshot.internalId, ingest_receipt_public_id: f.allocated.ingestId, contract_ref: source.contractRef, owner_object_public_id: source.ownerObjectId, owner_revision: source.ownerRevision}], outboxWrites: [{table: 'pay_outbox_events', eventId: f.allocated.eventId, sourceReceiptRef: f.allocated.ingestId}], actualNative: false};
}
function fixtures() {
  const originals = D.read(D.oldPrefix + '.foundation-fixtures.json').fixtures;
  const positive = [];
  for (const set of ['A', 'B']) {
    const selected = originals.filter(f => f.fixtureId.startsWith('PAY_CONFIG_' + set + '_'));
    const n = set === 'A' ? 10000 : 20000;
    const bodies = Object.fromEntries(selected.map(f => [f.body.governance.artifactKind, clone(f.body)]));
    // Foundation can be created tenant-wide before group master exists. No future UUID dependency.
    for (const [kind, body] of Object.entries(bodies)) {
      body.governance.scope = {legalPayrollEntityId: null, payGroupId: null};
      body.governance.expectedSchemaVersion = 'PAYROLL_CONFIG_GOVERNANCE_V3';
      if (body.scope) body.scope = clone(body.governance.scope);
      if (kind === 'PAYGROUP') body.governance.scope.legalPayrollEntityId = uuid(n + 200);
    }
    // Native allowance needs only configured literal; the original fixture's dangling worker-entry
    // ELEMENT reference is not valid restored source evidence. Separate closed native formula here.
    bodies.FORMULA.inputs = [];
    bodies.FORMULA.expression = {op: 'LITERAL', nodeId: 'NATIVE_MONEY_CONFIG', value: {valueType: 'MONEY', unit: 'CURRENCY', amount: set === 'A' ? '125.00000000' : '210.00000000', currency: 'TST'}};
    bodies.PAYGROUP.legalPayrollEntityId = uuid(n + 200);
    const governance = {};
    for (const route of D.foundations) {
      const old = selected.find(f => f.body.governance.artifactKind === route.kind);
      const g = clone(old.ownerGovernanceResponse); g.schemaVersion = 'PAYROLL_CONFIG_GOVERNANCE_V3'; g.scope = clone(bodies[route.kind].governance.scope);
      g.payloadDigest = D.digest(withoutDigest(g)); bodies[route.kind].governance.expectedPayloadDigest = g.payloadDigest; governance[route.kind] = g;
    }
    const rows = D.foundations.map((r, i) => ({tenantId: set === 'A' ? 1 : 2, publicId: uuid(n + 100 + i), payloadId: uuid(n + 200 + i), internalId: n + i + 1, kind: r.kind, key: bodies[r.kind][r.key], versionNo: 1, schemaVersion: r.bodySchemaRef, payload: bodies[r.kind], payloadDigest: '', status: 'PUBLISHED', validFrom: '2026-09-01', validTo: '2026-10-01'}));
    // Restore acyclic referenced full payloads before computing immutable source digests.
    // ELEMENT uses its explicit CURRENT_ELEMENT_INPUT worker entry, without a formula cycle.
    // GL resolves this full element; worker-entry query/materialization itself remains G3 source OPEN.
    bodies.ELEMENT.formulaArtifact = null;
    const referenceFor = kind => {const row = rows.find(r => r.kind === kind); return {artifactType: kind, artifactId: row.publicId, versionNo: 1, schemaVersion: 'PAY_BASE_PROPOSAL_V1', payloadDigest: row.payloadDigest};};
    function finalize(kind) {
      const row = rows.find(r => r.kind === kind), body = bodies[kind];
      const refs = collectRefs(body);
      for (const ref of refs) Object.assign(ref, referenceFor(ref.artifactType));
      row.payloadDigest = D.digest(body);
    }
    for (const kind of ['ENTITY', 'ROUNDING', 'ELIGIBILITY', 'CALENDAR', 'ELEMENT', 'FORMULA', 'PAYGROUP', 'GL_MAPPING']) finalize(kind);
    for (const [i, r] of D.foundations.entries()) {
      const old = selected.find(f => f.body.governance.artifactKind === r.kind);
      positive.push({fixtureId: 'PAYV3_' + set + '_' + r.kind, operationId: r.operationId, bodySchemaRef: r.bodySchemaRef, path: {}, headers: {'Idempotency-Key': 'native-' + set + '-' + r.kind, 'X-Correlation-Id': uuid(n + 900)}, body: bodies[r.kind], actor: {tenantId: set === 'A' ? 1 : 2, principalPublicId: uuid(n + 1), authRowVersion: 6, authAccessRevision: 7}, authority: {purpose: 'PAY_CONFIG_MANAGE', originatingAction: D.historical.operationDeltas.find(o => o.operationId === r.operationId).action, permissionRevision: 'auth-policy-example-v3', populationRevision: 'psc-native-example-v3', fieldPolicyRevision: 'policy-field-example-v3', populationDigest: D.digest({scope: governance[r.kind].scope}), appEntitled: true, expiresAt: '2026-09-14T01:00:00Z'}, legacyPayCounters: {authorization: 11, fieldPolicy: 12}, sourceTenantId: set === 'A' ? 1 : 2, ownerGovernance: governance[r.kind], legalEmployer: clone(old.ownerNativeLegalEmployer), localRows: clone(rows), clock: '2026-09-14T00:00:00Z', registryPublished: true, counter: {loadedNextVersionNo: 2, loadedRowVersion: 3}, allocated: {artifactId: uuid(n + 300 + i), payloadId: uuid(n + 400 + i), receiptId: uuid(n + 500 + i), eventId: uuid(n + 600 + i)}, syntheticReturning: {payloadInternalId: n + 700 + i}, syntheticOnly: true, actualOwnerPublished: false});
    }
  }
  const input = [];
  for (const [i, set] of ['A', 'B'].entries()) {
    const n = 30000 + i * 10000, actor = clone(positive[i * 8].actor), authority = clone(positive[i * 8].authority);
    authority.purpose = 'PAY_INPUT_SOURCE_INGEST';
    authority.originatingAction = 'PAY_INPUT_SOURCE_INGEST';
    const source = {tenantId: actor.tenantId, ownerObjectId: uuid(n + 1), ownerRevision: 4, schemaVersion: 'PAYV3_TEST_SOURCE_V1', contractRef: 'TIM.ClosedTimeManifest.proposal.v3', asOf: '2026-09-14T00:00:00Z', status: 'CLOSED', lines: [{lineNo: 1, workerPublicId: uuid(n + 2), assignmentPublicId: uuid(n + 3), unit: 'HOUR', quantity: set === 'A' ? '8.000000' : '7.500000', sourceEntryDigest: D.digest({nativeEntry: n})}, {lineNo: 2, workerPublicId: uuid(n + 2), assignmentPublicId: uuid(n + 3), unit: 'HOUR', quantity: '1.000000', sourceEntryDigest: D.digest({nativeEntry: n + 1})}], declaredLineCount: 2};
    source.payloadDigest = D.digest(source);
    input.push({fixtureId: 'PAYV3_' + set + '_TIM_INGEST', operationId: 'pay.input.source.ingest', bodySchemaRef: 'PAYV3.InputIngest', path: {runId: uuid(n + 4)}, headers: {'Idempotency-Key': 'ingest-' + set, 'X-Correlation-Id': uuid(n + 9), 'If-Match': '"7"'}, body: {runId: uuid(n + 4), sourceSelector: {contractRef: source.contractRef, ownerObjectId: source.ownerObjectId, ownerRevision: source.ownerRevision, asOf: source.asOf, payloadDigest: source.payloadDigest}, sourceKind: 'TIM_CLOSED_TIME', requestedFieldSetVersion: 'PAYV3_TEST_SOURCE_V1'}, source, actor, authority, clock: source.asOf, loadedRun: {tenantId: actor.tenantId, publicId: uuid(n + 4), internalId: n + 4, rowVersion: 7, snapshotInternalId: n + 5}, loadedSnapshot: {tenantId: actor.tenantId, publicId: uuid(n + 5), internalId: n + 5, rowVersion: 2, status: 'DRAFT', asOf: source.asOf}, allocated: {ingestId: uuid(n + 6), eventId: uuid(n + 7)}, returning: {ingestInternalId: n + 6}, registryPublished: true, syntheticOnly: true, actualOwnerPublished: false});
  }
  const negative = [];
  function add(caseId, f, mutate, expected) { const x = clone(f); mutate(x); x.caseId = caseId; x.expectedCode = expected; negative.push(x); }
  const group = positive.find(f => f.fixtureId === 'PAYV3_A_PAYGROUP'), element = positive.find(f => f.fixtureId === 'PAYV3_A_ELEMENT'), sample = input[0];
  add('PAY_NEG_001_CROSS_TENANT_ENTITY', group, f => f.localRows.find(r => r.kind === 'ENTITY').tenantId = 2, '404_OPAQUE');
  add('PAY_NEG_008_LOCAL_REF_WRONG_ENTITY', group, f => f.localRows.find(r => r.kind === 'ELIGIBILITY').kind = 'CALENDAR', '404_OPAQUE');
  add('PAY_NEG_010_SOURCE_DIGEST_MISMATCH', sample, f => f.source.lines[0].quantity = '9.000000', '422_SOURCE_DIGEST_MISMATCH');
  add('PAY_NEG_011_SOURCE_AS_OF_STALE', sample, f => f.source.asOf = '2026-09-13T00:00:00Z', '422_SOURCE_STALE');
  add('PAY_NEG_012_TIME_RESULT_REOPENED', sample, f => f.source.status = 'REOPENED', '422_SOURCE_SUPERSEDED');
  add('PAY_NEG_013_TIME_LINES_DUPLICATE_GAP_COUNT', sample, f => {f.source.lines[1].lineNo = 1; f.source.payloadDigest = D.digest(withoutDigest(f.source)); f.body.sourceSelector.payloadDigest = f.source.payloadDigest;}, '422_SOURCE_SEQUENCE_OR_COUNT');
  add('V3_INGEST_CAS_STALE_NOT_RUN_FINALIZE_COVERAGE', sample, f => f.headers['If-Match'] = '"6"', '409_CAS');
  add('V3_INGEST_REPLAY_ENTITLEMENT_REVOKED_NOT_RECEIPT_QUERY_COVERAGE', sample, f => {f.existingReceipt = {requestDigest: ingest(f).requestDigest}; f.authority.appEntitled = false;}, '403_ENTITLEMENT_REVOKED');
  add('V3_OWNER_NUMERIC_REVISION_STALE', positive[0], f => f.body.governance.expectedOwnerRevision += 1, '409_OWNER_REVISION');
  add('V3_FUTURE_GROUP_PREREQUISITE', group, f => {f.body.governance.scope.payGroupId = uuid(999); f.ownerGovernance.scope.payGroupId = uuid(999); f.ownerGovernance.payloadDigest = D.digest(withoutDigest(f.ownerGovernance)); f.body.governance.expectedPayloadDigest = f.ownerGovernance.payloadDigest;}, '409_FUTURE_GROUP_PREREQUISITE');
  add('V3_NATIVE_EMPLOYER_OWNER_STALE', positive[0], f => f.legalEmployer.version += 1, '409_NATIVE_EMPLOYER_STALE');
  add('V3_PRIMARY_OR_MISSING_OWNER_NO_FALLBACK', sample, f => f.registryPublished = false, '503_OWNER_UNAVAILABLE');
  add('V3_SNAPSHOT_WRONG_PARENT', sample, f => f.loadedRun.snapshotInternalId += 1, '409_PARENT_BINDING');
  add('V3_FROZEN_SNAPSHOT_INGEST', sample, f => f.loadedSnapshot.status = 'FROZEN', '409_SNAPSHOT_IMMUTABLE');
  add('V3_AUTHORITY_TOKEN_EXPIRED', sample, f => f.clock = '2026-09-14T02:00:00Z', '403_AUTHORITY_EXPIRED');
  return {status: 'CONCRETE_TYPED_API_AND_OWNER_ROW_SYNTHETIC_AUTHOR_ONLY', positive, input, negative, former39ConcreteCaseIds: negative.filter(f => f.caseId.startsWith('PAY_NEG_')).map(f => f.caseId), nonCoverage: 'other33 original full-API negatives and all native/HTTP actions remain OPEN; ingest CAS/replay does not close run.finalize/command.receipt.query, inherited generic model cases not relabeled full API'};
}
function recordOutputs() {
  const f = fixtures();
  const outputs = f.positive.map(fixture => {
    const out = foundation(fixture), a = out.artifact;
    const queryResponse = {artifactId: a.public_id, kind: a.artifact_kind, key: a.artifact_key, versionNo: a.version_no, payloadId: a.payload_public_id, payload: a.normalized_payload, payloadDigest: a.payload_digest, validFrom: fixture.body.validFrom, validTo: fixture.body.validTo, status: a.status, rowVersion: a.row_version, governance: fixture.ownerGovernance};
    return {fixtureId: fixture.fixtureId, ...out, queryResponse};
  });
  outputs.push(...f.input.map(fixture => ({fixtureId: fixture.fixtureId, ...ingest(fixture)})));
  return {status: 'ACTUAL_EXECUTED_SYNTHETIC_PLANNED_ORACLE_OUTPUTS_NOT_NATIVE_SQL_HTTP_OR_AUTHORITY', outputs, outputDigest: D.digest(outputs), actualNativeAuthorization: 0, actualDml: 0, G3Approval: false};
}
module.exports = {foundation, ingest, fixtures, collectRefs, withoutDigest, uuid, materializedPayload, sqlValueValid, recordOutputs};
