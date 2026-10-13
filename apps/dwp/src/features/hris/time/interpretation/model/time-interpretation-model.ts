export type TimeRuleOperator =
  | 'QUANTITY_LITERAL'
  | 'RATE_LITERAL'
  | 'BOOLEAN_LITERAL'
  | 'INPUT'
  | 'ADD'
  | 'SUBTRACT'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'MIN'
  | 'MAX'
  | 'COMPARE_LT'
  | 'COMPARE_EQ'
  | 'AND'
  | 'OR'
  | 'IF'
  | 'ROUND';

export type TimeRuleValueType =
  'BOOLEAN' | 'NUMBER' | 'RATE' | 'QUANTITY_MINUTE' | 'QUANTITY_HOUR' | 'QUANTITY_DAY';

export type TimeRuleOwnerRef = Readonly<{
  owner: 'HRM' | 'PER' | 'TIM' | 'PAY' | 'SYS' | 'AUTH' | 'APPROVAL';
  schemaId: string;
  publicId: string;
  revision: number;
  contentHash: string;
  validFrom?: string;
  validToExclusive?: string | null;
}>;

export type TypedTimeRuleNode = Readonly<{
  nodeId: string;
  operator: TimeRuleOperator;
  arguments: readonly string[];
  returnType: TimeRuleValueType;
  value: string | boolean | null;
  inputRef: TimeRuleOwnerRef | null;
  roundingRef: TimeRuleOwnerRef | null;
}>;

export type TypedTimeRuleAst = Readonly<{
  registryId: 'TIM_RULE_AST_V1';
  registryVersion: 1;
  rootNodeId: string;
  nodes: readonly TypedTimeRuleNode[];
}>;

export type TimeRuleContractErrorCode =
  | 'SCHEMA_INVALID'
  | 'UNKNOWN_INPUT'
  | 'UNKNOWN_OPERATOR'
  | 'ARITY_MISMATCH'
  | 'TYPE_MISMATCH'
  | 'UNIT_MISMATCH'
  | 'CYCLE'
  | 'LIMIT_EXCEEDED';

export class TimeRuleContractError extends Error {
  constructor(
    readonly code: TimeRuleContractErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'TimeRuleContractError';
  }
}

export type TimeInterpretationAction = Readonly<{
  actionKey: 'hris.action.tim.interpretation.run';
  method: 'POST';
  hrefTemplate: '/api/time/v1/interpretation-runs';
  idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY';
  stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED';
}>;

export type TimeInterpretationFieldDecision<T> =
  | Readonly<{ decision: 'VIEW'; value: T }>
  | Readonly<{
      decision: 'MASK';
      value: null;
      maskReason: string;
      maskedDisplayKey: string;
    }>
  | Readonly<{ decision: 'OMIT'; value: null }>;

export type TimeInterpretationItem = Readonly<{
  runId: string;
  title: string;
  statusCode: string;
  result: TimeInterpretationFieldDecision<Readonly<{ code: string; revision: number }>>;
  ruleVersion: TimeInterpretationFieldDecision<
    Readonly<{
      policyKey: string;
      revision: number;
      effectiveFrom: string;
      effectiveTo: string | null;
      status: string;
    }>
  >;
  traceSummary: TimeInterpretationFieldDecision<
    Readonly<{ itemCount: number; revision: number; asOf: string }>
  >;
  availableActions: readonly TimeInterpretationAction[];
}>;

export type TimeInterpretationWorkbench = Readonly<{
  queryState: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
  asOf: string;
  scopeDecisionRevision: string;
  authorizationDecisionRevision: string;
  nextCursor: string | null;
  partialFailures: readonly string[];
  items: readonly TimeInterpretationItem[];
}>;

export type TimeInterpretationTraceStep = Readonly<{
  sequence: number;
  ruleCode: string;
  inputMinutes: number;
  outputMinutes: number;
}>;

export type TimeInterpretationTrace = Readonly<{
  runId: string;
  inputDigest: string;
  ruleDigest: string;
  steps: readonly TimeInterpretationTraceStep[];
}>;

export type TimeInterpretationReceipt = Readonly<{
  receiptId: string;
  commandType: string;
  originatingAction: string;
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: string;
  authorizationRevision: number;
  status: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN';
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion: number | null;
  resultRef: string | null;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DIGEST = /^[0-9a-f]{64}$/u;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const NODE_ID = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;
const POLICY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const MASK_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const DECIMAL = /^(?!-0(?:\.0+)?$)-?(0|[1-9][0-9]*)(\.[0-9]{1,12})?$/u;

const OPERATORS = new Set<TimeRuleOperator>([
  'QUANTITY_LITERAL',
  'RATE_LITERAL',
  'BOOLEAN_LITERAL',
  'INPUT',
  'ADD',
  'SUBTRACT',
  'MULTIPLY',
  'DIVIDE',
  'MIN',
  'MAX',
  'COMPARE_LT',
  'COMPARE_EQ',
  'AND',
  'OR',
  'IF',
  'ROUND',
]);
const RETURN_TYPES = new Set<TimeRuleValueType>([
  'BOOLEAN',
  'NUMBER',
  'RATE',
  'QUANTITY_MINUTE',
  'QUANTITY_HOUR',
  'QUANTITY_DAY',
]);
const OWNER_CODES = new Set<TimeRuleOwnerRef['owner']>([
  'HRM',
  'PER',
  'TIM',
  'PAY',
  'SYS',
  'AUTH',
  'APPROVAL',
]);
const ARITY: Readonly<Record<TimeRuleOperator, number>> = {
  QUANTITY_LITERAL: 0,
  RATE_LITERAL: 0,
  BOOLEAN_LITERAL: 0,
  INPUT: 0,
  ADD: 2,
  SUBTRACT: 2,
  MULTIPLY: 2,
  DIVIDE: 2,
  MIN: 2,
  MAX: 2,
  COMPARE_LT: 2,
  COMPARE_EQ: 2,
  AND: 2,
  OR: 2,
  IF: 3,
  ROUND: 1,
};

function invalid(label: string): never {
  throw new Error(`Invalid TIM interpretation ${label}.`);
}

function ruleError(code: TimeRuleContractErrorCode, detail: string): never {
  throw new TimeRuleContractError(code, `Invalid TIM typed rule: ${detail}.`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(label);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid(label);
  return value as Record<string, unknown>;
}

function ruleRecord(value: unknown, label: string): Record<string, unknown> {
  try {
    return record(value, label);
  } catch {
    return ruleError('SCHEMA_INVALID', label);
  }
}

function exactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  label: string
): void {
  const keys = Object.keys(source);
  if (keys.some((key) => !allowed.includes(key)) || required.some((key) => !keys.includes(key))) {
    invalid(label);
  }
}

function ruleExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  label: string
): void {
  try {
    exactKeys(source, allowed, required, label);
  } catch {
    ruleError('SCHEMA_INVALID', label);
  }
}

function text(value: unknown, maximum: number, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim() ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f);
    })
  ) {
    return invalid(label);
  }
  return value;
}

function patterned(value: unknown, pattern: RegExp, maximum: number, label: string): string {
  const candidate = text(value, maximum, label);
  if (!pattern.test(candidate)) return invalid(label);
  return candidate;
}

function integer(value: unknown, minimum: number, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) return invalid(label);
  return value as number;
}

function finiteInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) return invalid(label);
  return value as number;
}

function instant(value: unknown, label: string): string {
  const candidate = text(value, 80, label);
  if (!/^\d{4}-\d{2}-\d{2}T/u.test(candidate) || !Number.isFinite(Date.parse(candidate))) {
    return invalid(label);
  }
  return candidate;
}

function civilDate(value: unknown, label: string): string {
  const candidate = text(value, 10, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(candidate);
  if (!match) return invalid(label);
  const normalized = new Date(`${candidate}T00:00:00Z`).toISOString().slice(0, 10);
  if (normalized !== candidate) return invalid(label);
  return candidate;
}

function literal<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) return invalid(label);
  return value as T;
}

function parseOwnerRef(value: unknown, label: string): TimeRuleOwnerRef {
  const source = ruleRecord(value, label);
  ruleExactKeys(
    source,
    ['owner', 'schemaId', 'publicId', 'revision', 'contentHash', 'validFrom', 'validToExclusive'],
    ['owner', 'schemaId', 'publicId', 'revision', 'contentHash'],
    label
  );
  if (
    typeof source.owner !== 'string' ||
    !OWNER_CODES.has(source.owner as TimeRuleOwnerRef['owner'])
  ) {
    return ruleError('SCHEMA_INVALID', `${label} owner`);
  }
  try {
    const validFrom = source.validFrom === undefined ? undefined : instant(source.validFrom, label);
    const validToExclusive =
      source.validToExclusive === undefined
        ? undefined
        : source.validToExclusive === null
          ? null
          : instant(source.validToExclusive, label);
    return Object.freeze({
      owner: source.owner as TimeRuleOwnerRef['owner'],
      schemaId: text(source.schemaId, 160, label),
      publicId: patterned(source.publicId, UUID, 36, label),
      revision: integer(source.revision, 0, label),
      contentHash: patterned(source.contentHash, DIGEST, 64, label),
      ...(validFrom === undefined ? {} : { validFrom }),
      ...(validToExclusive === undefined ? {} : { validToExclusive }),
    });
  } catch {
    return ruleError('SCHEMA_INVALID', label);
  }
}

function parseRuleNode(rawNode: unknown): TypedTimeRuleNode {
  const source = ruleRecord(rawNode, 'node');
  ruleExactKeys(
    source,
    ['nodeId', 'operator', 'arguments', 'returnType', 'value', 'inputRef', 'roundingRef'],
    ['nodeId', 'operator', 'arguments', 'returnType'],
    'node'
  );
  let nodeId: string;
  let returnType: TimeRuleValueType;
  try {
    nodeId = patterned(source.nodeId, NODE_ID, 64, 'rule node identifier');
    if (
      typeof source.returnType !== 'string' ||
      !RETURN_TYPES.has(source.returnType as TimeRuleValueType)
    ) {
      ruleError('SCHEMA_INVALID', `${nodeId} return type`);
    }
    returnType = source.returnType as TimeRuleValueType;
  } catch (error) {
    if (error instanceof TimeRuleContractError) throw error;
    return ruleError('SCHEMA_INVALID', 'node identity');
  }
  if (typeof source.operator !== 'string' || !OPERATORS.has(source.operator as TimeRuleOperator)) {
    return ruleError('UNKNOWN_OPERATOR', `${nodeId} operator`);
  }
  const operator = source.operator as TimeRuleOperator;
  if (!Array.isArray(source.arguments) || source.arguments.length > 3) {
    return ruleError('SCHEMA_INVALID', `${nodeId} arguments`);
  }
  const args = source.arguments.map((argument) => {
    try {
      return patterned(argument, NODE_ID, 64, 'rule argument');
    } catch {
      return ruleError('SCHEMA_INVALID', `${nodeId} argument`);
    }
  });
  const value = source.value === undefined ? null : source.value;
  if (value !== null && typeof value !== 'string' && typeof value !== 'boolean') {
    return ruleError('SCHEMA_INVALID', `${nodeId} value`);
  }
  if (typeof value === 'string' && !DECIMAL.test(value)) {
    return ruleError('SCHEMA_INVALID', `${nodeId} literal`);
  }
  const inputRef =
    source.inputRef == null ? null : parseOwnerRef(source.inputRef, 'input reference');
  const roundingRef =
    source.roundingRef == null ? null : parseOwnerRef(source.roundingRef, 'rounding reference');
  if (
    (operator === 'INPUT') !== (inputRef !== null) ||
    (operator === 'ROUND') !== (roundingRef !== null) ||
    (operator === 'BOOLEAN_LITERAL') !== (typeof value === 'boolean') ||
    (operator === 'QUANTITY_LITERAL' || operator === 'RATE_LITERAL') !== (typeof value === 'string')
  ) {
    return ruleError('TYPE_MISMATCH', `${nodeId} payload`);
  }
  if (operator === 'BOOLEAN_LITERAL' && returnType !== 'BOOLEAN') {
    return ruleError('TYPE_MISMATCH', `${nodeId} return type`);
  }
  if (operator === 'RATE_LITERAL' && returnType !== 'RATE') {
    return ruleError('TYPE_MISMATCH', `${nodeId} return type`);
  }
  if (operator === 'QUANTITY_LITERAL' && !returnType.startsWith('QUANTITY_')) {
    return ruleError('UNIT_MISMATCH', `${nodeId} quantity unit`);
  }
  return Object.freeze({
    nodeId,
    operator,
    arguments: Object.freeze(args),
    returnType,
    value,
    inputRef,
    roundingRef,
  });
}

function verifyRuleGraph(nodes: readonly TypedTimeRuleNode[], rootNodeId: string): void {
  const byId = new Map<string, TypedTimeRuleNode>();
  for (const node of nodes) {
    if (byId.has(node.nodeId)) ruleError('SCHEMA_INVALID', `duplicate node ${node.nodeId}`);
    byId.set(node.nodeId, node);
  }
  if (!byId.has(rootNodeId)) ruleError('UNKNOWN_INPUT', 'root node');
  for (const node of nodes) {
    if (node.arguments.some((argument) => !byId.has(argument))) {
      ruleError('UNKNOWN_INPUT', `${node.nodeId} argument`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string, depth: number) => {
    if (depth > 32) ruleError('LIMIT_EXCEEDED', 'graph depth');
    if (visiting.has(nodeId)) ruleError('CYCLE', nodeId);
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    byId.get(nodeId)?.arguments.forEach((argument) => visit(argument, depth + 1));
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  nodes.forEach((node) => visit(node.nodeId, 1));

  for (const node of nodes) {
    if (node.arguments.length !== ARITY[node.operator]) {
      ruleError('ARITY_MISMATCH', `${node.nodeId} arity`);
    }
  }

  const typeOf = (id: string) => byId.get(id)!.returnType;
  const equalArguments = (node: TypedTimeRuleNode) =>
    node.arguments.length > 0 &&
    node.arguments.every((argument) => typeOf(argument) === typeOf(node.arguments[0]!));
  for (const node of nodes) {
    const argumentTypes = node.arguments.map(typeOf);
    if (['ADD', 'SUBTRACT', 'MIN', 'MAX'].includes(node.operator)) {
      if (
        !equalArguments(node) ||
        node.returnType !== argumentTypes[0] ||
        node.returnType === 'BOOLEAN'
      ) {
        ruleError('UNIT_MISMATCH', `${node.nodeId} signature`);
      }
    } else if (node.operator === 'COMPARE_LT' || node.operator === 'COMPARE_EQ') {
      if (!equalArguments(node) || node.returnType !== 'BOOLEAN') {
        ruleError('TYPE_MISMATCH', `${node.nodeId} signature`);
      }
    } else if (node.operator === 'AND' || node.operator === 'OR') {
      if (node.returnType !== 'BOOLEAN' || argumentTypes.some((type) => type !== 'BOOLEAN')) {
        ruleError('TYPE_MISMATCH', `${node.nodeId} signature`);
      }
    } else if (node.operator === 'IF') {
      if (
        argumentTypes[0] !== 'BOOLEAN' ||
        argumentTypes[1] !== argumentTypes[2] ||
        node.returnType !== argumentTypes[1]
      ) {
        ruleError('TYPE_MISMATCH', `${node.nodeId} signature`);
      }
    } else if (node.operator === 'ROUND') {
      if (node.returnType !== argumentTypes[0] || node.returnType === 'BOOLEAN') {
        ruleError('TYPE_MISMATCH', `${node.nodeId} signature`);
      }
    } else if (node.operator === 'MULTIPLY' || node.operator === 'DIVIDE') {
      if (argumentTypes.some((type) => type === 'BOOLEAN') || node.returnType === 'BOOLEAN') {
        ruleError('TYPE_MISMATCH', `${node.nodeId} signature`);
      }
    }
  }
}

export function parseTypedTimeRuleAst(value: unknown): TypedTimeRuleAst {
  const source = ruleRecord(value, 'root');
  ruleExactKeys(
    source,
    ['registryId', 'registryVersion', 'rootNodeId', 'nodes'],
    ['registryId', 'registryVersion', 'rootNodeId', 'nodes'],
    'root'
  );
  if (source.registryId !== 'TIM_RULE_AST_V1' || source.registryVersion !== 1) {
    return ruleError('SCHEMA_INVALID', 'registry version');
  }
  if (!Array.isArray(source.nodes) || source.nodes.length < 1 || source.nodes.length > 512) {
    return ruleError(
      source.nodes instanceof Array && source.nodes.length > 512
        ? 'LIMIT_EXCEEDED'
        : 'SCHEMA_INVALID',
      'node collection'
    );
  }
  let rootNodeId: string;
  try {
    rootNodeId = patterned(source.rootNodeId, NODE_ID, 64, 'root node identifier');
  } catch {
    return ruleError('SCHEMA_INVALID', 'root node identifier');
  }
  const nodes = source.nodes.map(parseRuleNode);
  verifyRuleGraph(nodes, rootNodeId);
  return Object.freeze({
    registryId: 'TIM_RULE_AST_V1',
    registryVersion: 1,
    rootNodeId,
    nodes: Object.freeze(nodes),
  });
}

type Decision = 'VIEW' | 'MASK' | 'OMIT';

function parseField<T>(
  groups: Record<string, unknown>,
  key: string,
  parseValue: (value: unknown) => T
): TimeInterpretationFieldDecision<T> {
  if (!Object.hasOwn(groups, key)) return Object.freeze({ decision: 'OMIT', value: null });
  const source = record(groups[key], `${key} field group`);
  const decision = literal(source.decision, ['VIEW', 'MASK'] as const, `${key} decision`);
  if (decision === 'MASK') {
    exactKeys(
      source,
      ['decision', 'value', 'maskReason', 'maskedDisplayKey'],
      ['decision', 'value', 'maskReason', 'maskedDisplayKey'],
      `${key} masked field group`
    );
    if (source.value !== null) return invalid(`${key} masked value`);
    return Object.freeze({
      decision,
      value: null,
      maskReason: patterned(source.maskReason, CODE, 64, `${key} mask reason`),
      maskedDisplayKey: patterned(source.maskedDisplayKey, MASK_KEY, 128, `${key} mask key`),
    });
  }
  exactKeys(source, ['decision', 'value'], ['decision', 'value'], `${key} viewed field group`);
  return Object.freeze({ decision, value: Object.freeze(parseValue(source.value)) });
}

function parseStatusValue(value: unknown) {
  const source = record(value, 'status value');
  exactKeys(source, ['code', 'revision'], ['code', 'revision'], 'status value');
  return {
    code: patterned(source.code, CODE, 64, 'result code'),
    revision: integer(source.revision, 1, 'result revision'),
  };
}

function parsePolicyValue(value: unknown) {
  const source = record(value, 'policy value');
  exactKeys(
    source,
    ['policyKey', 'revision', 'effectiveFrom', 'effectiveTo', 'status'],
    ['policyKey', 'revision', 'effectiveFrom', 'effectiveTo', 'status'],
    'policy value'
  );
  return {
    policyKey: patterned(source.policyKey, POLICY_KEY, 128, 'policy key'),
    revision: integer(source.revision, 1, 'policy revision'),
    effectiveFrom: civilDate(source.effectiveFrom, 'policy effective from'),
    effectiveTo:
      source.effectiveTo === null ? null : civilDate(source.effectiveTo, 'policy effective to'),
    status: patterned(source.status, CODE, 64, 'policy status'),
  };
}

function parseAggregateValue(value: unknown) {
  const source = record(value, 'aggregate value');
  exactKeys(
    source,
    ['itemCount', 'revision', 'asOf'],
    ['itemCount', 'revision', 'asOf'],
    'aggregate value'
  );
  return {
    itemCount: integer(source.itemCount, 0, 'trace item count'),
    revision: integer(source.revision, 1, 'trace revision'),
    asOf: instant(source.asOf, 'trace timestamp'),
  };
}

function parseAction(value: unknown): TimeInterpretationAction {
  const source = record(value, 'available action');
  exactKeys(
    source,
    ['actionKey', 'method', 'hrefTemplate', 'idempotencyPolicy', 'stepUpPolicy'],
    ['actionKey', 'method', 'hrefTemplate', 'idempotencyPolicy', 'stepUpPolicy'],
    'available action'
  );
  if (
    source.actionKey !== 'hris.action.tim.interpretation.run' ||
    source.method !== 'POST' ||
    source.hrefTemplate !== '/api/time/v1/interpretation-runs' ||
    source.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
    source.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED'
  ) {
    return invalid('available action');
  }
  return Object.freeze({
    actionKey: 'hris.action.tim.interpretation.run',
    method: 'POST',
    hrefTemplate: '/api/time/v1/interpretation-runs',
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  });
}

function parseQueryState(value: unknown, itemCount: number) {
  const source = record(value, 'query state');
  exactKeys(
    source,
    [
      'state',
      'scopeDecisionRevision',
      'freshness',
      'nextCursor',
      'fieldDecisionSummary',
      'partialFailures',
      'correlationId',
      'cachePolicy',
    ],
    [
      'state',
      'scopeDecisionRevision',
      'freshness',
      'nextCursor',
      'fieldDecisionSummary',
      'partialFailures',
      'correlationId',
      'cachePolicy',
    ],
    'query state'
  );
  const state = literal(
    source.state,
    ['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'] as const,
    'query state'
  );
  const freshness = literal(
    source.freshness,
    ['CURRENT', 'STALE', 'UNAVAILABLE'] as const,
    'query freshness'
  );
  const scopeDecisionRevision = patterned(
    source.scopeDecisionRevision,
    PUBLIC_ID,
    128,
    'scope decision revision'
  );
  patterned(source.correlationId, UUID, 36, 'query correlation identifier');
  const nextCursor =
    source.nextCursor === null ? null : patterned(source.nextCursor, CURSOR, 1024, 'next cursor');
  const summary = record(source.fieldDecisionSummary, 'field decision summary');
  exactKeys(
    summary,
    ['viewCount', 'maskedCount', 'omittedCount'],
    ['viewCount', 'maskedCount', 'omittedCount'],
    'field decision summary'
  );
  const counts = Object.freeze({
    VIEW: integer(summary.viewCount, 0, 'view count'),
    MASK: integer(summary.maskedCount, 0, 'mask count'),
    OMIT: integer(summary.omittedCount, 0, 'omit count'),
  });
  if (!Array.isArray(source.partialFailures) || source.partialFailures.length > 32) {
    return invalid('partial failures');
  }
  const partialFailures = source.partialFailures.map((entry) => {
    const failure = record(entry, 'partial failure');
    exactKeys(
      failure,
      ['componentKey', 'errorCode', 'correlationId', 'retryable'],
      ['componentKey', 'errorCode', 'correlationId', 'retryable'],
      'partial failure'
    );
    patterned(failure.componentKey, /^[a-z][a-z0-9._-]{0,127}$/u, 128, 'failure component');
    patterned(failure.correlationId, UUID, 36, 'failure correlation identifier');
    if (typeof failure.retryable !== 'boolean') return invalid('partial failure retryability');
    return patterned(failure.errorCode, CODE, 64, 'failure code');
  });
  const cache = record(source.cachePolicy, 'cache policy');
  exactKeys(
    cache,
    ['authorizationDecisionRevision', 'invalidationEvent', 'maxAgeSeconds'],
    ['authorizationDecisionRevision', 'invalidationEvent', 'maxAgeSeconds'],
    'cache policy'
  );
  const authorizationDecisionRevision = patterned(
    cache.authorizationDecisionRevision,
    PUBLIC_ID,
    128,
    'authorization decision revision'
  );
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') {
    return invalid('cache invalidation event');
  }
  const maxAgeSeconds = integer(cache.maxAgeSeconds, 0, 'cache maximum age');
  if (maxAgeSeconds > 300) return invalid('cache maximum age');
  if ((state === 'EMPTY' || state === 'UNAVAILABLE') && itemCount !== 0) {
    return invalid('empty query state');
  }
  if (state === 'PARTIAL' && partialFailures.length === 0) return invalid('partial query state');
  if (state === 'COMPLETE' && partialFailures.length !== 0) return invalid('complete query state');
  if (
    (state === 'UNAVAILABLE' || freshness === 'UNAVAILABLE') &&
    (state !== 'UNAVAILABLE' ||
      freshness !== 'UNAVAILABLE' ||
      nextCursor !== null ||
      itemCount !== 0)
  ) {
    return invalid('unavailable query state');
  }
  return {
    state,
    freshness,
    scopeDecisionRevision,
    authorizationDecisionRevision,
    nextCursor,
    counts,
    partialFailures: Object.freeze(partialFailures),
  };
}

export function parseTimeInterpretationWorkbench(value: unknown): TimeInterpretationWorkbench {
  const source = record(value, 'workbench');
  exactKeys(
    source,
    ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items'],
    ['projectionVersion', 'asOf', 'variantKey', 'queryState', 'items'],
    'workbench'
  );
  if (source.projectionVersion !== '1' || source.variantKey !== 'INTERPRETATION') {
    return invalid('projection identity');
  }
  if (!Array.isArray(source.items) || source.items.length > 500) {
    return invalid('projection items');
  }
  const decisions: Decision[] = [];
  const itemIds = new Set<string>();
  const items = source.items.map((entry): TimeInterpretationItem => {
    const item = record(entry, 'item');
    exactKeys(
      item,
      ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions'],
      ['itemPublicId', 'title', 'statusCode', 'fieldGroups', 'deepLink', 'availableActions'],
      'item'
    );
    const runId = patterned(item.itemPublicId, PUBLIC_ID, 128, 'item identifier');
    if (itemIds.has(runId)) return invalid('duplicate item identifier');
    itemIds.add(runId);
    const deepLink = record(item.deepLink, 'deep link');
    exactKeys(deepLink, ['route', 'resourcePublicId'], ['route', 'resourcePublicId'], 'deep link');
    if (deepLink.route !== '/hr/operations/time/interpretation') return invalid('deep link route');
    if (patterned(deepLink.resourcePublicId, PUBLIC_ID, 128, 'deep link target') !== runId) {
      return invalid('deep link target');
    }
    const groups = record(item.fieldGroups, 'field groups');
    exactKeys(
      groups,
      ['INTERPRETATION_RESULT', 'RULE_VERSION', 'TRACE_SUMMARY'],
      [],
      'field groups'
    );
    if (Object.keys(groups).length === 0) return invalid('field groups');
    const result = parseField(groups, 'INTERPRETATION_RESULT', parseStatusValue);
    const ruleVersion = parseField(groups, 'RULE_VERSION', parsePolicyValue);
    const traceSummary = parseField(groups, 'TRACE_SUMMARY', parseAggregateValue);
    decisions.push(result.decision, ruleVersion.decision, traceSummary.decision);
    if (!Array.isArray(item.availableActions) || item.availableActions.length > 1) {
      return invalid('available actions');
    }
    return Object.freeze({
      runId,
      title: text(item.title, 512, 'item title'),
      statusCode: patterned(item.statusCode, CODE, 64, 'item status'),
      result,
      ruleVersion,
      traceSummary,
      availableActions: Object.freeze(item.availableActions.map(parseAction)),
    });
  });
  const query = parseQueryState(source.queryState, items.length);
  const actual = decisions.reduce(
    (counts, decision) => ({ ...counts, [decision]: counts[decision] + 1 }),
    { VIEW: 0, MASK: 0, OMIT: 0 }
  );
  if (
    actual.VIEW !== query.counts.VIEW ||
    actual.MASK !== query.counts.MASK ||
    actual.OMIT !== query.counts.OMIT
  ) {
    return invalid('field decision summary');
  }
  return Object.freeze({
    queryState: query.state,
    freshness: query.freshness,
    asOf: instant(source.asOf, 'projection timestamp'),
    scopeDecisionRevision: query.scopeDecisionRevision,
    authorizationDecisionRevision: query.authorizationDecisionRevision,
    nextCursor: query.nextCursor,
    partialFailures: query.partialFailures,
    items: Object.freeze(items),
  });
}

export function parseTimeInterpretationTrace(value: unknown): TimeInterpretationTrace {
  const source = record(value, 'trace');
  exactKeys(
    source,
    ['runId', 'inputDigest', 'ruleDigest', 'steps'],
    ['runId', 'inputDigest', 'ruleDigest', 'steps'],
    'trace'
  );
  if (!Array.isArray(source.steps)) return invalid('trace steps');
  const steps = source.steps.map((entry, index): TimeInterpretationTraceStep => {
    const step = record(entry, 'trace step');
    exactKeys(
      step,
      ['sequence', 'ruleCode', 'inputMinutes', 'outputMinutes'],
      ['sequence', 'ruleCode', 'inputMinutes', 'outputMinutes'],
      'trace step'
    );
    const sequence = integer(step.sequence, 1, 'trace sequence');
    if (sequence !== index + 1) return invalid('trace sequence');
    return Object.freeze({
      sequence,
      ruleCode: text(step.ruleCode, 160, 'trace rule code'),
      inputMinutes: finiteInteger(step.inputMinutes, 'trace input minutes'),
      outputMinutes: finiteInteger(step.outputMinutes, 'trace output minutes'),
    });
  });
  return Object.freeze({
    runId: patterned(source.runId, UUID, 36, 'trace run identifier'),
    inputDigest: patterned(source.inputDigest, DIGEST, 64, 'trace input digest'),
    ruleDigest: patterned(source.ruleDigest, DIGEST, 64, 'trace rule digest'),
    steps: Object.freeze(steps),
  });
}

export function parseTimeInterpretationReceipt(value: unknown): TimeInterpretationReceipt {
  const source = record(value, 'receipt');
  exactKeys(
    source,
    [
      'receiptId',
      'commandType',
      'originatingAction',
      'subjectPrincipalPublicId',
      'populationScopeDigest',
      'fieldPolicyRevision',
      'purposeCode',
      'authorizationRevision',
      'status',
      'correlationId',
      'requestDigest',
      'createdAt',
      'aggregateVersion',
      'resultRef',
    ],
    [
      'receiptId',
      'commandType',
      'originatingAction',
      'subjectPrincipalPublicId',
      'populationScopeDigest',
      'fieldPolicyRevision',
      'purposeCode',
      'authorizationRevision',
      'status',
      'correlationId',
      'requestDigest',
      'createdAt',
    ],
    'receipt'
  );
  return Object.freeze({
    receiptId: patterned(source.receiptId, UUID, 36, 'receipt identifier'),
    commandType: text(source.commandType, 128, 'command type'),
    originatingAction: text(source.originatingAction, 128, 'originating action'),
    subjectPrincipalPublicId: patterned(
      source.subjectPrincipalPublicId,
      UUID,
      36,
      'subject principal identifier'
    ),
    populationScopeDigest: patterned(
      source.populationScopeDigest,
      DIGEST,
      64,
      'population scope digest'
    ),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1, 'field policy revision'),
    purposeCode: text(source.purposeCode, 64, 'purpose code'),
    authorizationRevision: integer(source.authorizationRevision, 1, 'authorization revision'),
    status: literal(
      source.status,
      ['ACCEPTED', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      'receipt status'
    ),
    correlationId: patterned(source.correlationId, UUID, 36, 'receipt correlation identifier'),
    requestDigest: patterned(source.requestDigest, DIGEST, 64, 'request digest'),
    createdAt: instant(source.createdAt, 'receipt timestamp'),
    aggregateVersion:
      source.aggregateVersion == null
        ? null
        : integer(source.aggregateVersion, 0, 'aggregate version'),
    resultRef:
      source.resultRef == null
        ? null
        : patterned(source.resultRef, UUID, 36, 'receipt result reference'),
  });
}

export function assertTimeInterpretationReplayInvariant(
  observed: TimeInterpretationReceipt,
  replay: TimeInterpretationReceipt
): void {
  if (
    observed.receiptId !== replay.receiptId ||
    observed.commandType !== replay.commandType ||
    observed.originatingAction !== replay.originatingAction ||
    observed.subjectPrincipalPublicId !== replay.subjectPrincipalPublicId ||
    observed.populationScopeDigest !== replay.populationScopeDigest ||
    observed.purposeCode !== replay.purposeCode ||
    observed.correlationId !== replay.correlationId ||
    observed.requestDigest !== replay.requestDigest ||
    observed.resultRef !== replay.resultRef
  ) {
    throw new Error('TIM interpretation replay changed sealed command identity.');
  }
}

export function assertTimeInterpretationTraceDeterminism(
  observed: TimeInterpretationTrace,
  replay: TimeInterpretationTrace
): void {
  if (
    observed.runId !== replay.runId ||
    observed.inputDigest !== replay.inputDigest ||
    observed.ruleDigest !== replay.ruleDigest ||
    observed.steps.length !== replay.steps.length ||
    observed.steps.some((step, index) => {
      const candidate = replay.steps[index];
      return (
        !candidate ||
        step.sequence !== candidate.sequence ||
        step.ruleCode !== candidate.ruleCode ||
        step.inputMinutes !== candidate.inputMinutes ||
        step.outputMinutes !== candidate.outputMinutes
      );
    })
  ) {
    throw new Error('TIM interpretation replay changed deterministic trace evidence.');
  }
}

export function timeInterpretationTotalMinutes(trace: TimeInterpretationTrace): number | null {
  return trace.steps.at(-1)?.outputMinutes ?? null;
}
