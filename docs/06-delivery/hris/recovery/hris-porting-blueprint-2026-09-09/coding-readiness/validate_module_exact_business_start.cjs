#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const FILES = {
  contract: path.join(ROOT, 'module-exact-business-start-canonical.v1.json'),
  schemas: path.join(ROOT, 'module-exact-business-schemas.v1.json'),
  fixtures: path.join(ROOT, 'module-exact-business-fixtures.v1.json'),
  lineage: path.join(ROOT, 'module-exact-business-lineage-register.v1.csv'),
  targets: path.join(ROOT, 'target-family-resolution-register.csv'),
  transport: path.join(ROOT, 'transport-schema-resolution-register.csv'),
  serviceBindings: path.join(ROOT, 'service-api-auth-binding-register.csv'),
  apiSor: path.join(ROOT, 'hris-api-sor-transition-register.csv'),
  pin: path.join(ROOT, 'module-exact-business-start-pin.v1.json')
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((v) => v !== ''));
  const header = nonEmpty.shift();
  return nonEmpty.map((values, index) => {
    if (values.length !== header.length) throw new Error(`CSV_COLUMN_COUNT:${index + 2}:${values.length}:${header.length}`);
    return Object.fromEntries(header.map((name, i) => [name, values[i]]));
  });
}

function readCsv(file) {
  return parseCsvText(fs.readFileSync(file, 'utf8'));
}

function splitRefs(value) {
  return value === 'NONE' || value === '' ? [] : value.split('|');
}

function pointerGet(root, pointer) {
  if (!pointer.startsWith('#/')) return undefined;
  return pointer.slice(2).split('/').reduce((cur, raw) => {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    return cur == null ? undefined : cur[key];
  }, root);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mutate(root, mutation) {
  if (!mutation) return root;
  const parts = mutation.path.split('/').slice(1).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (mutation.op === 'replace-root') {
    if (parts.length !== 1) throw new Error('REPLACE_ROOT_PATH_INVALID');
    root[parts[0]] = deepClone(mutation.value);
    return root;
  }
  const key = parts.pop();
  const parent = parts.reduce((cur, part) => cur[part], root);
  if (mutation.op === 'delete') delete parent[key];
  else if (mutation.op === 'set') parent[key] = deepClone(mutation.value);
  else throw new Error(`UNKNOWN_MUTATION:${mutation.op}`);
  return root;
}

function collectKeys(value, found = []) {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, found));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      found.push(key);
      collectKeys(item, found);
    }
  }
  return found;
}

function collectOpenObjectSchemas(value, pointer = '#', found = []) {
  if (Array.isArray(value)) value.forEach((item, index) => collectOpenObjectSchemas(item, `${pointer}/${index}`, found));
  else if (value && typeof value === 'object') {
    if (value.type === 'object' && value.additionalProperties !== false) found.push(pointer);
    for (const [key, item] of Object.entries(value)) collectOpenObjectSchemas(item, `${pointer}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, found);
  }
  return found;
}

function sameStringSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function parseTransition(text) {
  const colon = text.indexOf(':');
  const arrow = text.indexOf('->', colon + 1);
  if (colon <= 0 || arrow < 0) throw new Error(`INVALID_TRANSITION:${text}`);
  return {
    operation: text.slice(0, colon),
    from: text.slice(colon + 1, arrow) ? text.slice(colon + 1, arrow).split('|') : [],
    to: text.slice(arrow + 2).split('|')
  };
}

function allAggregates(contract) {
  const result = [];
  for (const [module, moduleContract] of Object.entries(contract.modules || {})) {
    for (const [name, aggregate] of Object.entries(moduleContract.aggregates || {})) result.push({module, name, aggregate});
  }
  return result;
}

function findAggregate(contract, name) {
  const matches = allAggregates(contract).filter((item) => item.name === name);
  if (matches.length !== 1) throw new Error(`AGGREGATE_NOT_UNIQUE:${name}:${matches.length}`);
  return matches[0].aggregate;
}

function validateStateMachine(name, aggregate) {
  const errors = [];
  const stateSet = new Set(aggregate.states || []);
  const terminalSet = new Set(aggregate.terminalStates || []);
  if (!stateSet.size) return [`STATE_EMPTY:${name}`];
  if (stateSet.size !== (aggregate.states || []).length) errors.push(`STATE_DUPLICATE:${name}`);
  if (terminalSet.size !== (aggregate.terminalStates || []).length) errors.push(`TERMINAL_DUPLICATE:${name}`);
  if (!terminalSet.size) errors.push(`TERMINAL_EMPTY:${name}`);
  for (const state of terminalSet) if (!stateSet.has(state)) errors.push(`TERMINAL_UNKNOWN_STATE:${name}:${state}`);
  if (!Array.isArray(aggregate.transitions) || !aggregate.transitions.length) return [`TRANSITION_EMPTY:${name}`];
  const transitions = [];
  for (const text of aggregate.transitions) {
    try { transitions.push(parseTransition(text)); }
    catch (error) { errors.push(`${name}:${error.message}`); }
  }
  if (new Set(aggregate.transitions).size !== aggregate.transitions.length) errors.push(`TRANSITION_DUPLICATE:${name}`);
  const transitionSignatures = transitions.map((t) => `${t.operation}:${[...t.from].sort().join('|')}`);
  if (new Set(transitionSignatures).size !== transitionSignatures.length) errors.push(`TRANSITION_AMBIGUOUS:${name}`);
  for (const t of transitions) {
    for (const state of [...t.from, ...t.to]) if (!stateSet.has(state)) errors.push(`UNKNOWN_STATE:${name}:${state}`);
  }
  const allowedTerminalExitOperations = new Set(['correct', 'reconcile', 'amend', 'cancel.request', 'reopen', 'retire', 'retro-or-offcycle', 'reverse', 'revoke', 'invalidate', 'recapture']);
  for (const transition of transitions) {
    for (const source of transition.from) {
      if (terminalSet.has(source) && !allowedTerminalExitOperations.has(transition.operation)) errors.push(`TERMINAL_EXIT_NOT_EXCEPTIONAL:${name}:${source}:${transition.operation}`);
    }
  }
  const reachable = new Set();
  transitions.filter((t) => t.from.length === 0).forEach((t) => t.to.forEach((s) => reachable.add(s)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of transitions) {
      if (t.from.length && t.from.some((s) => reachable.has(s))) {
        for (const target of t.to) if (!reachable.has(target)) { reachable.add(target); changed = true; }
      }
    }
  }
  for (const state of stateSet) if (!reachable.has(state)) errors.push(`UNREACHABLE_STATE:${name}:${state}`);
  const canReachTerminal = new Set(terminalSet);
  changed = true;
  while (changed) {
    changed = false;
    for (const t of transitions) {
      if (t.from.length && t.to.some((state) => canReachTerminal.has(state))) {
        for (const source of t.from) if (!canReachTerminal.has(source)) { canReachTerminal.add(source); changed = true; }
      }
    }
  }
  for (const state of stateSet) if (!canReachTerminal.has(state)) errors.push(`NO_TERMINAL_PATH:${name}:${state}`);
  return errors;
}

function simulateJourney(contract, journey) {
  const aggregate = findAggregate(contract, journey.aggregate);
  const transitions = aggregate.transitions.map(parseTransition);
  let current = null;
  for (const operation of journey.steps) {
    const candidates = transitions.filter((t) => t.operation === operation && (current === null ? t.from.length === 0 : t.from.includes(current)));
    if (!candidates.length) throw new Error(`JOURNEY_STEP_INVALID:${journey.caseId}:${current}:${operation}`);
    const transition = candidates[0];
    if (transition.to.length === 1) current = transition.to[0];
    else {
      const remainingSteps = journey.steps.slice(journey.steps.indexOf(operation) + 1);
      const useful = transition.to.find((target) => remainingSteps.some((next) => transitions.some((t) => t.operation === next && t.from.includes(target))));
      current = useful || transition.to[0];
    }
  }
  if (current !== journey.expectedState) throw new Error(`JOURNEY_FINAL_STATE:${journey.caseId}:${current}:${journey.expectedState}`);
}

function graphIssue(ast, kind) {
  const nodes = ast.nodes || [];
  const byId = new Map();
  for (const node of nodes) {
    if (byId.has(node.nodeId)) return 'DUPLICATE_NODE';
    byId.set(node.nodeId, node);
  }
  if (!byId.has(ast.rootNodeId)) return 'ROOT_MISSING';
  const arity = {
    QUANTITY_LITERAL: 0, RATE_LITERAL: 0, BOOLEAN_LITERAL: 0, LITERAL: 0, INPUT: 0,
    ADD: 2, SUBTRACT: 2, MULTIPLY: 2, DIVIDE: 2, MIN: 2, MAX: 2,
    COMPARE_LT: 2, COMPARE_EQ: 2, AND: 2, OR: 2, IF: 3, ROUND: 1,
    CONVERT_MINUTE_HOUR: 1, LOOKUP: 1, SUM: 0, DATE_DIFFERENCE: 2
  };
  for (const node of nodes) {
    if (!(node.operator in arity)) return 'UNKNOWN_OPERATOR';
    if (node.arguments.length !== arity[node.operator]) return 'ARITY_MISMATCH';
    for (const ref of node.arguments) if (!byId.has(ref)) return 'ARGUMENT_MISSING';
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const child of byId.get(id).arguments) if (visit(child)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  if (visit(ast.rootNodeId)) return 'CYCLE';
  for (const node of nodes) {
    const args = node.arguments.map((id) => byId.get(id));
    const sameTypes = args.length > 0 && args.every((arg) => arg.returnType === args[0].returnType);
    const sameCurrencies = args.filter((arg) => arg.currency != null).every((arg, _, list) => arg.currency === list[0].currency);
    if (['ADD', 'SUBTRACT', 'MIN', 'MAX'].includes(node.operator) && (!sameTypes || node.returnType !== args[0].returnType || !sameCurrencies)) return sameCurrencies ? 'TYPE_MISMATCH' : 'CURRENCY_MISMATCH';
    if (['COMPARE_LT', 'COMPARE_EQ'].includes(node.operator) && (!sameTypes || node.returnType !== 'BOOLEAN' || !sameCurrencies)) return sameCurrencies ? 'TYPE_MISMATCH' : 'CURRENCY_MISMATCH';
    if (['AND', 'OR'].includes(node.operator) && (args.some((arg) => arg.returnType !== 'BOOLEAN') || node.returnType !== 'BOOLEAN')) return 'TYPE_MISMATCH';
    if (node.operator === 'IF' && (args[0].returnType !== 'BOOLEAN' || args[1].returnType !== args[2].returnType || node.returnType !== args[1].returnType)) return 'TYPE_MISMATCH';
    if (node.operator === 'ROUND' && (node.returnType !== args[0].returnType || node.roundingRef == null)) return 'ROUNDING_SOURCE_STALE';
    if (node.operator === 'DIVIDE' && node.value === '0') return 'DIVIDE_BY_ZERO';
    if (kind === 'TIM') {
      if (node.operator === 'INPUT' && node.inputRef == null) return 'UNKNOWN_INPUT';
      if (['QUANTITY_LITERAL', 'RATE_LITERAL', 'BOOLEAN_LITERAL'].includes(node.operator) && node.value == null) return 'VALUE_REQUIRED';
    }
    if (kind === 'PAY') {
      if (node.operator === 'INPUT' && node.inputKey == null) return 'UNKNOWN_INPUT';
      if (node.operator === 'LITERAL' && node.value == null) return 'VALUE_REQUIRED';
      if (node.operator === 'LOOKUP' && node.lookupRef == null) return 'LOOKUP_SOURCE_REQUIRED';
      if (node.operator === 'SUM' && node.collectionInputKey == null) return 'COLLECTION_SOURCE_REQUIRED';
      if (node.operator === 'CONVERT_MINUTE_HOUR') {
        const pair = `${args[0].returnType}->${node.returnType}`;
        if (!['QUANTITY_MINUTE->QUANTITY_HOUR', 'QUANTITY_HOUR->QUANTITY_MINUTE'].includes(pair)) return 'UNIT_MISMATCH';
      }
      if (node.operator === 'MULTIPLY') {
        const pair = [args[0].returnType, args[1].returnType].join('*');
        const allowed = new Set(['MONEY*RATE', 'RATE*MONEY', 'QUANTITY_HOUR*UNIT_PRICE_PER_HOUR', 'UNIT_PRICE_PER_HOUR*QUANTITY_HOUR', 'QUANTITY_MINUTE*UNIT_PRICE_PER_MINUTE', 'UNIT_PRICE_PER_MINUTE*QUANTITY_MINUTE', 'QUANTITY_DAY*UNIT_PRICE_PER_DAY', 'UNIT_PRICE_PER_DAY*QUANTITY_DAY', 'NUMBER*NUMBER', 'RATE*RATE']);
        if (!allowed.has(pair)) return 'TYPE_MISMATCH';
        if ((pair.includes('MONEY') || pair.includes('UNIT_PRICE')) && node.returnType !== 'MONEY') return 'TYPE_MISMATCH';
      }
    }
  }
  if (kind === 'PAY') {
    for (const node of nodes) {
      if (node.returnType === 'MONEY' || node.returnType.startsWith('UNIT_PRICE_')) {
        if (!node.currency) return 'CURRENCY_REQUIRED';
      }
    }
  }
  return null;
}

function semanticExpected(caseDef, baseCase) {
  const value = baseCase ? mutate(deepClone(baseCase), caseDef.mutation).value : caseDef.input;
  const s = caseDef.seed || {};
  switch (caseDef.caseId) {
    case 'HRM-N-FIRST-UUID': return value.payload.workerPublicId ? null : 'EXPLICIT_WORKER_REQUIRED';
    case 'HRM-N-PRIMARY-OVERLAP': return s.overlappingPrimaryAssignments > 0 ? 'PRIMARY_ASSIGNMENT_OVERLAP' : null;
    case 'HRM-N-STALE-ASSIGNMENT': return s.currentWorkerVersion !== value.payload.expectedWorkerVersion ? 'STALE_OWNER_VERSION' : null;
    case 'HRM-N-STALE-CALLBACK': return s.callbackExpectedVersion !== s.callbackActualVersion ? 'STALE_CALLBACK' : null;
    case 'HRM-N-FTE-RANGE': return Number(value.payload.assignment.fte) <= 0 || Number(value.payload.assignment.fte) > 1 ? 'FTE_OUT_OF_RANGE' : null;
    case 'HRM-N-AUTO-HIRE': return caseDef.input.sideEffect.includes('without explicit') ? 'AUTOMATED_FINAL_EMPLOYMENT_DECISION_FORBIDDEN' : null;
    case 'HRM-N-CANDIDATE-RETENTION': return caseDef.input.candidateConsent === 'REVOKED' && caseDef.input.retentionExpired ? 'CANDIDATE_RETENTION_DENIED' : null;
    case 'PER-N-FREEZE-HASH': return s.recomputedPreviewHash !== value.previewContentHash ? 'PREVIEW_HASH_MISMATCH' : null;
    case 'PER-N-FREEZE-STALE-WORKFORCE': return s.currentWorkforceRevision !== value.workforceSnapshotRef.revision ? 'STALE_WORKFORCE_SNAPSHOT' : null;
    case 'PER-N-CALLER-DISTRIBUTION': return caseDef.input.callerFields.includes('distributionImpact') ? 'CALLER_BASELINE_FORBIDDEN' : null;
    case 'PER-N-STALE-BASELINE': return caseDef.input.expectedBaselineRevision !== caseDef.input.actualBaselineRevision ? 'STALE_BASELINE' : null;
    case 'PER-N-OPTIONAL-SKILL': return caseDef.input.skillModuleState === 'NOT_INSTALLED' ? 'NONE_UNRELATED_CORE_CONTINUES' : null;
    case 'PER-N-COMP-LINE-GAP': return caseDef.input.lineCount !== caseDef.input.lineSequences.length ? 'COMPENSATION_LINE_CARDINALITY_MISMATCH' : null;
    case 'PER-N-CONSENT': return caseDef.input.growthProfileConsent === 'WITHDRAWN' ? 'FIELD_CONSENT_REQUIRED' : null;
    case 'TIM-N-RULE-ARITY': return graphIssue(value, 'TIM');
    case 'TIM-N-RULE-CYCLE': {
      const nodes = new Map(value.nodes.map((n) => [n.nodeId, n]));
      const seen = new Set();
      function visit(id, stack = new Set()) {
        if (stack.has(id)) return true;
        if (seen.has(id)) return false;
        stack.add(id);
        for (const child of (nodes.get(id)?.arguments || [])) if (visit(child, stack)) return true;
        stack.delete(id); seen.add(id); return false;
      }
      return visit(value.rootNodeId) ? 'CYCLE' : null;
    }
    case 'TIM-N-SCHEDULE-OVERLAP': return s.duplicateOverlappingSegment ? 'ASSIGNMENT_SEGMENT_OVERLAP' : null;
    case 'TIM-N-SCHEDULE-STALE': return s.currentAssignmentSnapshotRevision !== value.workerAssignmentSnapshotRef.revision ? 'STALE_ASSIGNMENT_SNAPSHOT' : null;
    case 'TIM-N-SCHEDULE-CROSS-TENANT': return s.ownerTenantMatches === false ? 'CROSS_TENANT_OWNER_REF' : null;
    case 'TIM-N-SCHEDULE-DST-GAP': return s.localTimeInGap && s.dstResolution === 'REJECT_GAP' ? 'LOCAL_TIME_GAP' : null;
    case 'TIM-N-ACCRUAL-UNIT': return value.cap.unit !== value.carryover.unit ? 'UNIT_MISMATCH' : null;
    case 'TIM-N-ACCRUAL-EXPIRY': return value.expiry.mode === 'AFTER_DAYS' && value.expiry.days == null ? 'EXPIRY_DAYS_REQUIRED' : null;
    case 'TIM-N-NEGATIVE-CAP': return Number(value.cap.quantity) < 0 ? 'NEGATIVE_ACCRUAL_BOUND' : null;
    case 'TIM-N-WFM-HRM-OWNER-MISSING': return s.hrmOwnerAvailable === false ? 'REQUIRED_OWNER_UNAVAILABLE' : null;
    case 'TIM-N-WFM-INTERVAL': return s.intervalIntersectionEmpty ? 'NO_EFFECTIVE_INTERSECTION' : null;
    case 'TIM-N-WFM-SOURCE-STALE': return s.sourceVectorMatches === false ? 'STALE_SOURCE_VECTOR' : null;
    case 'TIM-N-WFM-OPTIONAL-PER-CALL': return value.skillSourceState === 'NOT_INSTALLED' && s.perCalls !== 0 ? 'OPTIONAL_OWNER_MUST_NOT_BE_CALLED' : null;
    case 'TIM-N-LEAVE-SOURCE-STALE': return caseDef.input.policyRevision !== caseDef.input.currentPolicyRevision ? 'STALE_LEAVE_SOURCE' : null;
    case 'PAY-N-FORMULA-CYCLE': {
      const nodes = new Map(value.nodes.map((n) => [n.nodeId, n]));
      const stack = new Set();
      function visit(id) { if (stack.has(id)) return true; stack.add(id); for (const x of (nodes.get(id)?.arguments || [])) if (visit(x)) return true; stack.delete(id); return false; }
      return visit(value.rootNodeId) ? 'CYCLE' : null;
    }
    case 'PAY-N-CURRENCY': return new Set(s.inputCurrencies).size > 1 && s.explicitFxRef == null ? 'CURRENCY_MISMATCH' : null;
    case 'PAY-N-SOURCE-STALE': return s.currentTimRevision !== value.sourceVector.timClosedTimeRef.revision ? 'STALE_SOURCE_VECTOR' : null;
    case 'PAY-N-PACK-NOT-INSTALLED': return s.jurisdictionCalculationRequired && s.packState === 'NOT_INSTALLED' ? 'COUNTRY_PACK_REQUIRED' : null;
    case 'PAY-N-PARTIAL-INPUT': return s.expectedInputRows !== s.materializedInputRows ? 'INPUT_CARDINALITY_MISMATCH' : null;
    case 'PAY-N-RESULT-REWRITE': return caseDef.input.operation.includes('in place') ? 'CORRECTION_OR_REVERSAL_REQUIRED' : null;
    case 'PAY-N-HARDCODED-LAW': return caseDef.input.coreConstant.includes('jurisdiction') ? 'STATUTORY_VALUE_IN_CORE_FORBIDDEN' : null;
    case 'PAY-N-SILENT-FALLBACK': return caseDef.input.fallback ? 'SILENT_FALLBACK_FORBIDDEN' : null;
    default: return null;
  }
}

function transitionAllowed(contract, definition) {
  const aggregate = findAggregate(contract, definition.aggregate);
  return aggregate.transitions.map(parseTransition).some((t) => t.operation === definition.operation && t.from.includes(definition.from));
}

function loadAjv() {
  const candidates = [
    path.join(ROOT, '../../../../.codex-worktrees/hris/integration/frontend/node_modules/ajv'),
    '/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/node_modules/ajv',
    '/Users/a10697/Work/DWP/dwp-frontend/node_modules/ajv'
  ];
  for (const candidate of candidates) {
    try { return require(candidate); } catch (_) { /* try next deterministic workspace runtime */ }
  }
  throw new Error('AJV_RUNTIME_NOT_FOUND');
}

function makeSchemaValidators(schemas) {
  const Ajv = loadAjv();
  const ajv = new Ajv({allErrors: true, jsonPointers: true, schemaId: 'auto', unknownFormats: false});
  ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  ajv.addFormat('date', (value) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  });
  ajv.addFormat('date-time', (value) => /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/.test(value) && Number.isFinite(Date.parse(value)));
  const validators = {};
  for (const name of Object.keys(schemas.$defs)) {
    validators[name] = ajv.compile({$schema: 'http://json-schema.org/draft-07/schema#', $defs: schemas.$defs, $ref: `#/$defs/${name}`});
  }
  return validators;
}

function validateModel(input) {
  const {contract, schemas, fixtures, lineage, targets, transport, serviceBindings, apiSor, pin, verifyPins = true, verifyPrompts = true} = input;
  const errors = [];
  const checks = {};
  const add = (condition, code) => { if (!condition) errors.push(code); };

  add(contract.status === 'CANONICAL_G3_EXACT_BUSINESS_P0_SUCCESSOR', 'CONTRACT_STATUS');
  add(contract.canonicalDesignPublished === true, 'CANONICAL_DESIGN_NOT_PUBLISHED');
  add(contract.runtimeImplemented === false, 'RUNTIME_FALSE_BOUNDARY');
  add(contract.g3CodeGateAuthorization === 'NONE_CLOSED_FAIL_SAFE', 'GATE_WIDENED');
  checks.stageBoundary = true;

  const forbiddenKeys = new Set(['allOf', 'ruleExpression', 'expression']);
  const badKeys = collectKeys(schemas).filter((key) => forbiddenKeys.has(key));
  add(badKeys.length === 0, `FORBIDDEN_SCHEMA_KEYS:${[...new Set(badKeys)].join('|')}`);
  const openObjectSchemas = collectOpenObjectSchemas(schemas);
  add(openObjectSchemas.length === 0, `SCHEMA_OBJECT_NOT_CLOSED:${openObjectSchemas.join('|')}`);
  add(Object.keys(schemas.$defs || {}).length === 34, `SCHEMA_DEFINITION_COUNT:${Object.keys(schemas.$defs || {}).length}`);
  const canonicalText = JSON.stringify(contract);
  for (const phrase of ['OPEN_EXACT_SOURCE', 'DESIGN_PROPOSED_NOT_CANONICAL', 'AUTHOR_BOUNDED_DESIGN_MODEL_NOT_CANONICAL']) {
    add(!canonicalText.includes(phrase), `PROPOSAL_STATE_LEAK:${phrase}`);
  }
  const operatorBindings = [
    ['TIM_RULE_AST_V1', schemas.$defs.TypedRuleNode?.properties?.operator?.enum],
    ['PAY_RULE_AST_V1', schemas.$defs.PayFormulaNode?.properties?.operator?.enum]
  ];
  for (const [registryId, schemaOperators] of operatorBindings) {
    const registry = contract.typedOperatorRegistries?.[registryId];
    add(Boolean(registry), `OPERATOR_REGISTRY_MISSING:${registryId}`);
    if (registry) {
      const registered = Object.keys(registry.operators || {}).sort();
      const declared = [...(schemaOperators || [])].sort();
      add(JSON.stringify(registered) === JSON.stringify(declared), `OPERATOR_REGISTRY_SCHEMA_DRIFT:${registryId}`);
      for (const [operator, rule] of Object.entries(registry.operators || {})) add(Number.isInteger(rule.arity) && rule.arity >= 0 && rule.arity <= 3, `OPERATOR_ARITY:${registryId}:${operator}`);
      add(Array.isArray(registry.errors) && registry.errors.includes('CYCLE') && registry.errors.includes('TYPE_MISMATCH'), `OPERATOR_ERROR_REGISTRY:${registryId}`);
    }
  }
  checks.failClosedDialect = true;

  const expectedFindings = Array.from({length: 8}, (_, i) => `BASE-P0-${String(i + 4).padStart(3, '0')}`);
  const actualFindings = contract.auditClosure.map((x) => x.findingId);
  add(new Set(actualFindings).size === actualFindings.length, 'DUPLICATE_AUDIT_CLOSURE');
  add(actualFindings.length === expectedFindings.length, `AUDIT_CLOSURE_COUNT:${actualFindings.length}`);
  for (const id of expectedFindings) add(actualFindings.includes(id), `MISSING_AUDIT_CLOSURE:${id}`);
  for (const row of contract.auditClosure) {
    add(row.status === 'CLOSED_EXACT_DESIGN', `AUDIT_NOT_CLOSED:${row.findingId}`);
    for (const ref of row.schemaRefs) add(pointerGet(schemas, ref) !== undefined, `AUDIT_SCHEMA_REF:${row.findingId}:${ref}`);
  }
  checks.auditClosure = expectedFindings.length;

  const expectedModules = ['HRIS-HRM', 'HRIS-PER', 'HRIS-PAY', 'HRIS-TIM'];
  add(JSON.stringify(Object.keys(contract.modules || {}).sort()) === JSON.stringify([...expectedModules].sort()), 'MODULE_SET_DRIFT');
  for (const module of expectedModules) {
    add(contract.modules[module]?.exactBusinessP0 === 'PASS', `MODULE_P0_NOT_PASS:${module}`);
    add(contract.moduleStartP0Decision[module] === 'EXACT_BUSINESS_DESIGN_P0_PASS_GLOBAL_GATE_STILL_REQUIRED', `MODULE_DECISION:${module}`);
  }

  const aggregates = allAggregates(contract);
  add(aggregates.length === 30, `STATE_MACHINE_COUNT:${aggregates.length}`);
  for (const item of aggregates) {
    add(Array.isArray(item.aggregate.writeSet) && item.aggregate.writeSet.length > 0, `WRITE_SET_EMPTY:${item.module}:${item.name}`);
    errors.push(...validateStateMachine(`${item.module}:${item.name}`, item.aggregate));
  }
  checks.stateMachines = aggregates.length;

  let validators;
  try { validators = makeSchemaValidators(schemas); }
  catch (error) { errors.push(`SCHEMA_COMPILER:${error.message}`); validators = {}; }
  const fixtureIds = new Set();
  add((fixtures.validCases || []).length === 12, `VALID_FIXTURE_COUNT:${(fixtures.validCases || []).length}`);
  add((fixtures.journeyCases || []).length === 11, `JOURNEY_FIXTURE_COUNT:${(fixtures.journeyCases || []).length}`);
  add((fixtures.negativeCases || []).length === 51, `NEGATIVE_FIXTURE_COUNT:${(fixtures.negativeCases || []).length}`);
  add((fixtures.validCases || []).length + (fixtures.journeyCases || []).length + (fixtures.negativeCases || []).length === 74, 'FIXTURE_TOTAL_COUNT');
  for (const group of ['validCases', 'journeyCases', 'negativeCases']) {
    for (const item of fixtures[group] || []) {
      add(!fixtureIds.has(item.caseId), `DUPLICATE_FIXTURE:${item.caseId}`);
      fixtureIds.add(item.caseId);
    }
    const requiredPinPaths = new Set([
      'coding-readiness/module-exact-business-start-canonical.v1.json',
      'coding-readiness/module-exact-business-schemas.v1.json',
      'coding-readiness/module-exact-business-fixtures.v1.json',
      'coding-readiness/module-exact-business-lineage-register.v1.csv',
      'coding-readiness/validate_module_exact_business_start.cjs',
      'coding-readiness/audit_module_exact_business_start.py',
      'coding-readiness/target-family-resolution-register.csv',
      'coding-readiness/transport-schema-resolution-register.csv',
      'coding-readiness/service-api-auth-binding-register.csv',
      'coding-readiness/hris-api-sor-transition-register.csv',
      'coding-readiness/validate_hris_api_sor_transitions.py',
      'session-prompts/01-cloudhr-hrm-session.md',
      'session-prompts/02-cloudhr-per-session.md',
      'session-prompts/03-cloudhr-pay-session.md',
      'session-prompts/04-cloudhr-tim-session.md'
    ]);
    const pinnedPaths = new Set();
    add(pin?.gateAuthorization === 'NONE_CLOSED_FAIL_SAFE', 'PIN_GATE');
    for (const artifact of pin?.artifacts || []) {
      add(!pinnedPaths.has(artifact.path), `PIN_DUPLICATE:${artifact.path}`);
      pinnedPaths.add(artifact.path);
      const file = path.join(path.dirname(ROOT), artifact.path);
      add(fs.existsSync(file), `PIN_FILE_MISSING:${artifact.path}`);
      if (fs.existsSync(file)) add(sha256(file) === artifact.sha256, `PIN_DRIFT:${artifact.path}`);
    }
    add(sameStringSet(pinnedPaths, requiredPinPaths), 'PIN_FILE_SET');
  }
  const validById = new Map(fixtures.validCases.map((x) => [x.caseId, x]));
  for (const item of fixtures.validCases) {
    const validator = validators[item.schema];
    add(Boolean(validator), `SCHEMA_MISSING:${item.caseId}:${item.schema}`);
    if (validator) add(validator(item.value), `VALID_FIXTURE_REJECTED:${item.caseId}:${JSON.stringify(validator.errors)}`);
    if (item.schema === 'TypedRuleAst') add(graphIssue(item.value, 'TIM') === null, `VALID_TIM_GRAPH:${item.caseId}:${graphIssue(item.value, 'TIM')}`);
    if (item.schema === 'PayFormulaAst') add(graphIssue(item.value, 'PAY') === null, `VALID_PAY_GRAPH:${item.caseId}:${graphIssue(item.value, 'PAY')}`);
    if (item.schema === 'EmploymentEventCommand' && item.value.payload.assignment) {
      const fte = Number(item.value.payload.assignment.fte);
      add(fte > 0 && fte <= 1, `VALID_FTE_RANGE:${item.caseId}`);
      add(item.value.payload.assignment.validToExclusive == null || item.value.payload.assignment.validFrom < item.value.payload.assignment.validToExclusive, `VALID_ASSIGNMENT_INTERVAL:${item.caseId}`);
    }
    if (item.schema === 'ScheduleCommand') {
      add(Date.parse(item.value.periodStartsAt) < Date.parse(item.value.periodEndsAt), `VALID_SCHEDULE_PERIOD:${item.caseId}`);
      for (const segment of item.value.segments) {
        add(Date.parse(segment.startsAt) < Date.parse(segment.endsAt), `VALID_SCHEDULE_SEGMENT:${item.caseId}:${segment.segmentPublicId}`);
        add(Date.parse(item.value.periodStartsAt) <= Date.parse(segment.startsAt) && Date.parse(segment.endsAt) <= Date.parse(item.value.periodEndsAt), `VALID_SCHEDULE_CONTAINMENT:${item.caseId}:${segment.segmentPublicId}`);
      }
    }
    if (item.schema === 'AccrualPolicy') {
      add(item.value.cap.unit === item.value.carryover.unit, `VALID_ACCRUAL_UNIT:${item.caseId}`);
      add(item.value.expiry.mode !== 'AFTER_DAYS' || item.value.expiry.days != null, `VALID_ACCRUAL_EXPIRY:${item.caseId}`);
      add(Number(item.value.cap.quantity) >= 0 && (item.value.carryover.limit == null || Number(item.value.carryover.limit) >= 0), `VALID_ACCRUAL_NONNEGATIVE:${item.caseId}`);
      add(item.value.effectiveToExclusive == null || item.value.effectiveFrom < item.value.effectiveToExclusive, `VALID_ACCRUAL_INTERVAL:${item.caseId}`);
    }
    if (item.schema === 'WfmPlanningInputSnapshot' && item.value.skillSourceState !== 'PRESENT') {
      add(item.value.perSkillRef === null, `VALID_WFM_OPTIONAL_REF:${item.caseId}`);
      add(item.expectedMetrics?.perCalls === 0, `VALID_WFM_OPTIONAL_CALLS:${item.caseId}`);
    }
    if (item.schema === 'WfmPlanningInputSnapshot') add(Date.parse(item.value.effectiveFrom) < Date.parse(item.value.effectiveToExclusive), `VALID_WFM_INTERVAL:${item.caseId}`);
    if (item.schema === 'PayrollFoundationArtifact') add(item.value.effectiveToExclusive == null || item.value.effectiveFrom < item.value.effectiveToExclusive, `VALID_PAY_FOUNDATION_INTERVAL:${item.caseId}`);
  }
  checks.validSchemaFixtures = fixtures.validCases.length;

  for (const journey of fixtures.journeyCases) {
    try { simulateJourney(contract, journey); }
    catch (error) { errors.push(error.message); }
  }
  checks.journeyFixtures = fixtures.journeyCases.length;

  for (const item of fixtures.negativeCases) {
    if (item.layer === 'SCHEMA') {
      const base = validById.get(item.baseCaseId);
      add(Boolean(base), `NEGATIVE_BASE_MISSING:${item.caseId}`);
      if (base) {
        const candidate = mutate(deepClone(base), item.mutation);
        const validator = validators[base.schema];
        add(validator && validator(candidate.value) === false, `SCHEMA_NEGATIVE_ACCEPTED:${item.caseId}`);
      }
    } else if (item.layer === 'TRANSITION') {
      let allowed = false;
      try { allowed = transitionAllowed(contract, item.transition); }
      catch (error) { errors.push(`TRANSITION_NEGATIVE_SETUP:${item.caseId}:${error.message}`); }
      add(!allowed, `TRANSITION_NEGATIVE_ACCEPTED:${item.caseId}`);
    } else if (item.layer === 'SEMANTIC') {
      const base = item.baseCaseId ? validById.get(item.baseCaseId) : undefined;
      if (item.baseCaseId) add(Boolean(base), `SEMANTIC_BASE_MISSING:${item.caseId}`);
      let actual = null;
      try { actual = semanticExpected(item, base); }
      catch (error) { errors.push(`SEMANTIC_EVALUATION:${item.caseId}:${error.message}`); }
      add(actual === item.expectedError, `SEMANTIC_NEGATIVE_MISMATCH:${item.caseId}:${actual}:${item.expectedError}`);
    } else errors.push(`UNKNOWN_NEGATIVE_LAYER:${item.caseId}:${item.layer}`);
  }
  checks.negativeFixtures = fixtures.negativeCases.length;

  const targetById = new Map(targets.map((x) => [x.resolution_id, x]));
  const transportById = new Map(transport.map((x) => [x.binding_id, x]));
  const serviceBindingById = new Map(serviceBindings.map((x) => [x.binding_id, x]));
  const apiSorById = new Map(apiSor.map((x) => [x.transition_id, x]));
  const consumerIdentity = {
    'HRIS-HRM': 'dwp-people-server/hris/hrm',
    'HRIS-PER': 'dwp-people-server/hris/performance',
    'HRIS-PAY': 'dwp-payroll-server',
    'HRIS-TIM': 'dwp-time-server'
  };
  const bindingIds = new Set();
  const allocatedFixtureIds = new Set();
  for (const row of lineage) {
    add(!bindingIds.has(row.binding_id), `DUPLICATE_LINEAGE:${row.binding_id}`);
    bindingIds.add(row.binding_id);
    add(expectedModules.includes(row.module), `LINEAGE_MODULE:${row.binding_id}`);
    add(row.status === 'CANONICAL_EXACT_DESIGN_P0', `LINEAGE_STATUS:${row.binding_id}`);
    add(row.canonical_owner.length > 0, `LINEAGE_OWNER_EMPTY:${row.binding_id}`);
    add(row.read_source_contract.length > 0, `LINEAGE_READ_EMPTY:${row.binding_id}`);
    add(splitRefs(row.write_set_contract).length > 0, `LINEAGE_WRITE_EMPTY:${row.binding_id}`);
    add(splitRefs(row.source_family_refs).length > 0, `LINEAGE_SOURCE_EMPTY:${row.binding_id}`);
    add(splitRefs(row.target_family_refs).length > 0, `LINEAGE_TARGET_EMPTY:${row.binding_id}`);
    add(splitRefs(row.transport_binding_refs).length > 0, `LINEAGE_TRANSPORT_EMPTY:${row.binding_id}`);
    add(splitRefs(row.schema_refs).length > 0, `LINEAGE_SCHEMA_EMPTY:${row.binding_id}`);
    add(splitRefs(row.state_machine_ref).length > 0, `LINEAGE_STATE_EMPTY:${row.binding_id}`);
    add(splitRefs(row.positive_fixture_refs).length > 0, `LINEAGE_POSITIVE_FIXTURE_EMPTY:${row.binding_id}`);
    add(splitRefs(row.negative_fixture_refs).length > 0, `LINEAGE_NEGATIVE_FIXTURE_EMPTY:${row.binding_id}`);
    const targetSourceFamilies = new Set();
    for (const ref of splitRefs(row.target_family_refs)) {
      const target = targetById.get(ref);
      add(Boolean(target), `LINEAGE_TARGET_REF:${row.binding_id}:${ref}`);
      if (target) {
        add(`HRIS-${target.module}` === row.module, `LINEAGE_TARGET_MODULE:${row.binding_id}:${ref}:${target.module}`);
        add(target.resolution_state === 'RESOLVED_G2_CONTRACT', `LINEAGE_TARGET_STATE:${row.binding_id}:${ref}:${target.resolution_state}`);
        splitRefs(target.source_capability_ids).forEach((value) => targetSourceFamilies.add(value));
      }
    }
    const declaredSourceFamilies = new Set(splitRefs(row.source_family_refs));
    add(sameStringSet(declaredSourceFamilies, targetSourceFamilies), `LINEAGE_SOURCE_TARGET_DRIFT:${row.binding_id}`);
    for (const ref of splitRefs(row.transport_binding_refs)) {
      const local = transportById.get(ref);
      const owner = serviceBindingById.get(ref);
      add(Boolean(local || owner), `LINEAGE_TRANSPORT_REF:${row.binding_id}:${ref}`);
      if (local) {
        add(`HRIS-${local.module}` === row.module, `LINEAGE_TRANSPORT_MODULE:${row.binding_id}:${ref}:${local.module}`);
        add(local.status === 'RESOLVED_EXACT', `LINEAGE_TRANSPORT_STATE:${row.binding_id}:${ref}:${local.status}`);
      }
      if (owner) {
        add(owner.state === 'G3_BINDING_SPECIFIED_NOT_IMPLEMENTED', `LINEAGE_OWNER_BINDING_STATE:${row.binding_id}:${ref}:${owner.state}`);
        const expectedConsumer = consumerIdentity[row.module];
        const permitted = splitRefs(owner.allowed_consumers).includes(expectedConsumer) || owner.in_process_consumer === expectedConsumer;
        add(permitted, `LINEAGE_OWNER_CONSUMER:${row.binding_id}:${ref}:${expectedConsumer}`);
      }
    }
    for (const ref of splitRefs(row.api_sor_transition_refs)) {
      const transition = apiSorById.get(ref);
      add(Boolean(transition), `LINEAGE_API_SOR_REF:${row.binding_id}:${ref}`);
      if (transition) {
        add(splitRefs(transition.canonical_owner_sessions).includes(row.module), `LINEAGE_API_SOR_OWNER:${row.binding_id}:${ref}`);
        add(transition.status === 'CONTRACT_DEFINED_G3_BLOCKED_NOT_CUT_OVER', `LINEAGE_API_SOR_STATE:${row.binding_id}:${ref}:${transition.status}`);
      }
    }
    for (const ref of splitRefs(row.schema_refs)) add(pointerGet(schemas, ref) !== undefined, `LINEAGE_SCHEMA_REF:${row.binding_id}:${ref}`);
    for (const ref of splitRefs(row.state_machine_ref)) add(pointerGet(contract, ref) !== undefined, `LINEAGE_STATE_REF:${row.binding_id}:${ref}`);
    for (const id of [...splitRefs(row.positive_fixture_refs), ...splitRefs(row.negative_fixture_refs)]) {
      add(fixtureIds.has(id), `LINEAGE_FIXTURE_REF:${row.binding_id}:${id}`);
      add(id.startsWith(`${row.module.replace('HRIS-', '')}-`), `LINEAGE_FIXTURE_MODULE:${row.binding_id}:${id}`);
      allocatedFixtureIds.add(id);
    }
    if (verifyPrompts) {
      const prompt = path.resolve(ROOT, row.session_prompt_ref);
      add(fs.existsSync(prompt), `LINEAGE_PROMPT_MISSING:${row.binding_id}`);
      if (fs.existsSync(prompt)) add(fs.readFileSync(prompt, 'utf8').includes('module-exact-business-start-canonical.v1.json'), `PROMPT_CANONICAL_REF_MISSING:${row.binding_id}`);
    }
  }
  add(lineage.length === 16, `LINEAGE_COUNT:${lineage.length}`);
  add(sameStringSet(allocatedFixtureIds, fixtureIds), `LINEAGE_FIXTURE_COVERAGE:${[...fixtureIds].filter((id) => !allocatedFixtureIds.has(id)).sort().join('|')}`);
  for (const finding of expectedFindings) add(lineage.some((x) => splitRefs(x.finding_ids).includes(finding)), `FINDING_LINEAGE_MISSING:${finding}`);
  for (const item of aggregates) {
    const exact = `#/modules/${item.module}/aggregates/${item.name}`;
    const parent = `#/modules/${item.module}/aggregates`;
    add(lineage.some((row) => splitRefs(row.state_machine_ref).some((ref) => ref === exact || ref === parent)), `AGGREGATE_LINEAGE_MISSING:${item.module}:${item.name}`);
  }
  checks.lineageBindings = lineage.length;

  const historicalPaths = new Set();
  add(contract.supersession?.rule === 'Historical proposals remain immutable evidence and are not canonical wholesale. This successor adopts only the explicitly restated decisions below.', 'HISTORICAL_NON_PROMOTION_RULE');
  add((contract.supersession?.historicalArtifacts || []).length === 4, `HISTORICAL_PIN_COUNT:${(contract.supersession?.historicalArtifacts || []).length}`);
  for (const artifact of contract.supersession?.historicalArtifacts || []) {
    add(!historicalPaths.has(artifact.path), `HISTORICAL_PIN_DUPLICATE:${artifact.path}`);
    historicalPaths.add(artifact.path);
    add(artifact.disposition === 'SUPERSEDED_FOR_P0_BY_THIS_CONTRACT', `HISTORICAL_PROPOSAL_PROMOTED:${artifact.path}:${artifact.disposition}`);
  }

  if (verifyPins) {
    for (const artifact of contract.supersession.historicalArtifacts) {
      const file = path.join(ROOT, artifact.path);
      add(fs.existsSync(file), `HISTORICAL_PIN_MISSING:${artifact.path}`);
      if (fs.existsSync(file)) add(sha256(file) === artifact.sha256, `HISTORICAL_PIN_DRIFT:${artifact.path}`);
    }
  }
  checks.historicalPins = contract.supersession.historicalArtifacts.length;
  return {errors, checks};
}

function loadInputs() {
  return {
    contract: readJson(FILES.contract),
    schemas: readJson(FILES.schemas),
    fixtures: readJson(FILES.fixtures),
    lineage: readCsv(FILES.lineage),
    targets: readCsv(FILES.targets),
    transport: readCsv(FILES.transport),
    serviceBindings: readCsv(FILES.serviceBindings),
    apiSor: readCsv(FILES.apiSor),
    pin: readJson(FILES.pin)
  };
}

function runSelfTests(base) {
  const mutations = [
    ['drop-audit-closure', (x) => { x.contract.auditClosure = x.contract.auditClosure.slice(1); }],
    ['widen-gate', (x) => { x.contract.g3CodeGateAuthorization = 'OPEN_G3_CODE'; }],
    ['module-not-pass', (x) => { x.contract.modules['HRIS-TIM'].exactBusinessP0 = 'OPEN'; }],
    ['inject-allOf', (x) => { x.schemas.$defs.FreezePopulationCommand.allOf = []; }],
    ['inject-free-expression', (x) => { x.schemas.$defs.TypedRuleAst.properties.ruleExpression = {type: 'string'}; }],
    ['empty-write-set', (x) => { x.contract.modules['HRIS-PAY'].aggregates.PayrollRun.writeSet = []; }],
    ['unreachable-state', (x) => { x.contract.modules['HRIS-PER'].aggregates.Appeal.states.push('PHANTOM'); }],
    ['reachable-dead-end', (x) => { const a = x.contract.modules['HRIS-PER'].aggregates.Appeal; a.states.push('PHANTOM'); a.transitions.push('strand:OPEN->PHANTOM'); }],
    ['terminal-declaration-missing', (x) => { delete x.contract.modules['HRIS-PER'].aggregates.Appeal.terminalStates; }],
    ['terminal-illegal-exit', (x) => { x.contract.modules['HRIS-PER'].aggregates.Appeal.transitions.push('restart:CLOSED->OPEN'); }],
    ['duplicate-state', (x) => { x.contract.modules['HRIS-PER'].aggregates.Appeal.states.push('CLOSED'); }],
    ['ambiguous-transition', (x) => { x.contract.modules['HRIS-PER'].aggregates.Appeal.transitions.push('review:OPEN->CLOSED'); }],
    ['schema-count-drift', (x) => { x.schemas.$defs.PhantomClosedRecord = {type: 'object', additionalProperties: false, required: ['id'], properties: {id: {type: 'string'}}}; }],
    ['schema-open-object', (x) => { delete x.schemas.$defs.AccrualSchedule.oneOf[0].additionalProperties; }],
    ['fixture-count-drift', (x) => { const fixture = deepClone(x.fixtures.validCases[0]); fixture.caseId = 'HRM-P-HIRE-EXTRA'; x.fixtures.validCases.push(fixture); }],
    ['unknown-target', (x) => { x.lineage[0].target_family_refs = 'TFR-HRM-999'; }],
    ['unknown-transport', (x) => { x.lineage[0].transport_binding_refs = 'PEP-HRM-999'; }],
    ['unknown-api-sor', (x) => { x.lineage[0].api_sor_transition_refs = 'API-SOR-READ-999'; }],
    ['valid-cross-module-target', (x) => { x.lineage[0].target_family_refs = 'TFR-PAY-003'; }],
    ['valid-cross-module-transport', (x) => { x.lineage[0].transport_binding_refs = 'PEP-PAY-002'; }],
    ['valid-cross-module-api-sor', (x) => { x.lineage.find((row) => row.binding_id === 'EBS-TIM-SCHEDULE').api_sor_transition_refs = 'API-SOR-READ-008'; }],
    ['source-family-mismatch', (x) => { x.lineage[0].source_family_refs = 'PAY-FOUNDATION'; }],
    ['empty-source-and-target', (x) => { x.lineage[0].source_family_refs = ''; x.lineage[0].target_family_refs = ''; }],
    ['cross-module-fixture', (x) => { x.lineage[0].positive_fixture_refs = 'PAY-P-RUN-REGULAR'; }],
    ['fixture-lineage-orphan', (x) => { x.lineage[0].positive_fixture_refs = 'HRM-P-HIRE'; }],
    ['historical-proposal-promotion', (x) => { x.contract.supersession.historicalArtifacts[0].disposition = 'PROMOTED_CANONICAL'; }],
    ['lineage-status-open', (x) => { x.lineage[0].status = 'OPEN'; }],
    ['duplicate-fixture', (x) => { x.fixtures.negativeCases.push(deepClone(x.fixtures.negativeCases[0])); }]
  ];
  const results = [];
  for (const [id, change] of mutations) {
    const candidate = deepClone(base);
    candidate.verifyPins = false;
    candidate.verifyPrompts = false;
    change(candidate);
    const outcome = validateModel(candidate);
    results.push({id, rejected: outcome.errors.length > 0, firstError: outcome.errors[0] || null});
  }
  return results;
}

function main() {
  const compact = process.argv.includes('--compact');
  const selfTestRequested = process.argv.includes('--self-test');
  let input;
  let outcome;
  try {
    input = loadInputs();
    outcome = validateModel(input);
  } catch (error) {
    outcome = {errors: [`VALIDATOR_EXECUTION:${error.stack || error.message}`], checks: {}};
  }
  const selfTests = selfTestRequested && input ? runSelfTests(input) : [];
  if (selfTests.some((x) => !x.rejected)) outcome.errors.push(`SELF_TEST_NOT_REJECTED:${selfTests.filter((x) => !x.rejected).map((x) => x.id).join('|')}`);
  const report = {
    schema: 'dwp.hris.module-exact-business-start-validation.v1',
    status: outcome.errors.length === 0 ? 'PASS' : 'FAIL',
    evaluatedAt: new Date().toISOString(),
    gateAuthorization: 'NONE_CLOSED_FAIL_SAFE',
    scopeVerdict: outcome.errors.length === 0 ? 'MODULE_EXACT_BUSINESS_DESIGN_P0_PASS_GLOBAL_G3_CONTROLS_STILL_REQUIRED' : 'FAIL_CLOSED',
    checks: outcome.checks,
    counts: input ? {
      modules: Object.keys(input.contract.modules).length,
      auditFindings: input.contract.auditClosure.length,
      stateMachines: allAggregates(input.contract).length,
      schemaDefinitions: Object.keys(input.schemas.$defs).length,
      validSchemaFixtures: input.fixtures.validCases.length,
      positiveJourneyFixtures: input.fixtures.journeyCases.length,
      negativeFixtures: input.fixtures.negativeCases.length,
      lineageBindings: input.lineage.length,
      mutationSelfTests: selfTests.length,
      mutationSelfTestsRejected: selfTests.filter((x) => x.rejected).length
    } : {},
    inputSha256: Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, fs.existsSync(file) ? sha256(file) : null])),
    selfTests,
    errors: outcome.errors
  };
  process.stdout.write(JSON.stringify(report, null, compact ? 0 : 2) + '\n');
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}

main();
