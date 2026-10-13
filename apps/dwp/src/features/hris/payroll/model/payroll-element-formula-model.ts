import { isPayrollFoundationCurrencyCode } from './payroll-foundation-currency';

export const PAY_FORMULA_REGISTRY_ID = 'PAY_RULE_AST_V1' as const;
export const PAY_FORMULA_SAFETY_LIMITS = Object.freeze({
  maxNodes: 2_048,
  maxDepth: 64,
  maxTimeoutMillis: 2_000,
});
export const PAY_FORMULA_GOLDEN_CASES = Object.freeze({
  moneyRateHalfUp: Object.freeze({
    money: '100.00',
    currency: 'TST',
    rate: '0.125',
    scale: 2,
    mode: 'HALF_UP',
    expected: '12.50',
  }),
  rejectionCodes: Object.freeze({
    stringRoot: 'TYPE',
    cycle: 'CYCLE',
    mixedCurrency: 'CURRENCY_MISMATCH',
    mixedUnit: 'UNIT_MISMATCH',
    unknownFunction: 'FUNCTION_NOT_ALLOWED',
    timeout: 'TIMEOUT',
  }),
});

export const PAY_VALUE_TYPES = [
  'BOOLEAN',
  'NUMBER',
  'RATE',
  'MONEY',
  'QUANTITY_MINUTE',
  'QUANTITY_HOUR',
  'QUANTITY_DAY',
  'UNIT_PRICE_PER_MINUTE',
  'UNIT_PRICE_PER_HOUR',
  'UNIT_PRICE_PER_DAY',
] as const;
export type PayValueType = (typeof PAY_VALUE_TYPES)[number];

export const PAY_FORMULA_OPERATORS = [
  'INPUT',
  'LITERAL',
  'ADD',
  'SUBTRACT',
  'MULTIPLY',
  'DIVIDE',
  'MIN',
  'MAX',
  'COMPARE_EQ',
  'COMPARE_LT',
  'AND',
  'OR',
  'IF',
  'ROUND',
  'CONVERT_MINUTE_HOUR',
  'LOOKUP',
  'SUM',
  'DATE_DIFFERENCE',
] as const;
export type PayFormulaOperator = (typeof PAY_FORMULA_OPERATORS)[number];

export const PAY_ROUNDING_MODES = [
  'HALF_UP',
  'HALF_EVEN',
  'DOWN',
  'UP',
  'FLOOR',
  'CEILING',
] as const;
export type PayRoundingMode = (typeof PAY_ROUNDING_MODES)[number];

export type PayOwnerRef = Readonly<{
  owner: 'HRM' | 'PER' | 'TIM' | 'PAY' | 'SYS' | 'AUTH' | 'APPROVAL';
  schemaId: string;
  publicId: string;
  revision: number;
  contentHash: string;
  validFrom?: string | null;
  validToExclusive?: string | null;
}>;

export type PayRounding = Readonly<{
  scale: number;
  mode: PayRoundingMode;
  increment: string;
}>;

export type PayFormulaNode = Readonly<{
  nodeId: string;
  operator: PayFormulaOperator;
  arguments: readonly string[];
  returnType: PayValueType;
  value?: string | boolean | null;
  currency?: string | null;
  inputKey?: string | null;
  roundingRef?: PayOwnerRef | null;
  lookupRef?: PayOwnerRef | null;
  collectionInputKey?: string | null;
}>;

export type PayFormulaAst = Readonly<{
  registryId: typeof PAY_FORMULA_REGISTRY_ID;
  registryVersion: 1;
  declaredReturnType: PayValueType;
  rootNodeId: string;
  nodes: readonly PayFormulaNode[];
}>;

export type CreatePayrollElementVersion = Readonly<{
  elementId?: string;
  expectedVersion?: number;
  legalEntityId: string;
  payrollGroupId: string;
  elementCode: string;
  displayName: string;
  valueType: PayValueType;
  currency?: string;
  rounding: PayRounding;
  effectiveFrom: string;
}>;

export type CreatePayrollFormulaVersion = Readonly<{
  formulaId?: string;
  expectedVersion?: number;
  legalEntityId: string;
  payrollGroupId: string;
  formulaCode: string;
  displayName: string;
  effectiveFrom: string;
  goldenTestDigest: string;
  ast: PayFormulaAst;
}>;

export type PayFormulaValue = Readonly<{
  type: PayValueType;
  value?: string | null;
  booleanValue?: boolean | null;
  currency?: string | null;
}>;

export type SimulatePayrollFormula = Readonly<{
  expectedVersion: number;
  inputs: Readonly<Record<string, PayFormulaValue>>;
  rounding: PayRounding;
  timeoutMillis: number;
}>;

export type PayrollFormulaReceipt = Readonly<{
  receiptId: string;
  commandType:
    | 'CREATE_ELEMENT_VERSION'
    | 'CREATE_FORMULA_VERSION'
    | 'VALIDATE_FORMULA'
    | 'SIMULATE_FORMULA'
    | 'PUBLISH_FORMULA';
  originatingAction:
    | 'PAY_ELEMENT_CONFIGURE'
    | 'PAY_FORMULA_CONFIGURE'
    | 'PAY_FORMULA_VALIDATE'
    | 'PAY_FORMULA_SIMULATE'
    | 'PAY_FORMULA_PUBLISH';
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: string;
  purposeCode: 'PAYROLL_CONFIGURATION';
  authorizationRevision: string;
  status: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN';
  correlationId: string;
  requestDigest: string;
  createdAt: string;
}>;

export type FormulaFindingCode =
  | 'CYCLE'
  | 'DUPLICATE_NODE'
  | 'MISSING_NODE'
  | 'FUNCTION_NOT_ALLOWED'
  | 'TYPE'
  | 'NODE_LIMIT'
  | 'DEPTH_LIMIT'
  | 'TYPE_MISMATCH'
  | 'UNIT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'CURRENCY_REQUIRED'
  | 'ROUNDING_REQUIRED'
  | 'LOOKUP_REF_REQUIRED'
  | 'INPUT_KEY_REQUIRED'
  | 'COLLECTION_KEY_REQUIRED'
  | 'INVALID_LITERAL';

export type FormulaDraftFinding = Readonly<{
  code: FormulaFindingCode;
  nodeId: string | null;
}>;

const VALUE_TYPES = new Set<string>(PAY_VALUE_TYPES);
const OPERATORS = new Set<string>(PAY_FORMULA_OPERATORS);
const ROUNDING_MODES = new Set<string>(PAY_ROUNDING_MODES);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const KEY = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function isPayCurrencyCode(value: string) {
  return value === 'TST' || isPayrollFoundationCurrencyCode(value);
}

function invalid(path: string): never {
  throw new Error(`Invalid payroll element/formula source: ${path}`);
}

function exact(value: unknown, path: string, allowed: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !allowed.includes(key))) invalid(path);
  return source;
}

function text(value: unknown, path: string, pattern?: RegExp, max = 512) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > max ||
    (pattern && !pattern.test(value))
  )
    invalid(path);
  return value;
}

function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) invalid(path);
  return Number(value);
}

function uuid(value: unknown, path: string) {
  return text(value, path, UUID, 36);
}

function date(value: unknown, path: string) {
  const result = text(value, path, DATE, 10);
  const parsed = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== result) invalid(path);
  return result;
}

function instant(value: unknown, path: string) {
  const result = text(value, path, undefined, 64);
  if (!Number.isFinite(Date.parse(result))) invalid(path);
  return result;
}

function valueType(value: unknown, path: string): PayValueType {
  const result = text(value, path, undefined, 40);
  if (!VALUE_TYPES.has(result)) invalid(path);
  return result as PayValueType;
}

function currency(value: unknown, path: string) {
  const result = text(value, path, undefined, 3);
  if (!isPayCurrencyCode(result)) invalid(path);
  return result;
}

function rounding(value: unknown, path: string): PayRounding {
  const source = exact(value, path, ['scale', 'mode', 'increment']);
  const mode = text(source.mode, `${path}.mode`, undefined, 16);
  if (!ROUNDING_MODES.has(mode)) invalid(`${path}.mode`);
  const increment = text(source.increment, `${path}.increment`, DECIMAL, 80);
  if (Number(increment) <= 0) invalid(`${path}.increment`);
  return Object.freeze({
    scale: integer(source.scale, `${path}.scale`, 0, 8),
    mode: mode as PayRoundingMode,
    increment,
  });
}

function ownerRef(value: unknown, path: string): PayOwnerRef {
  const source = exact(value, path, [
    'owner',
    'schemaId',
    'publicId',
    'revision',
    'contentHash',
    'validFrom',
    'validToExclusive',
  ]);
  const owners = new Set(['HRM', 'PER', 'TIM', 'PAY', 'SYS', 'AUTH', 'APPROVAL']);
  const owner = text(source.owner, `${path}.owner`, undefined, 16);
  if (!owners.has(owner)) invalid(`${path}.owner`);
  const nullableInstant = (entry: unknown, child: string) =>
    entry === undefined || entry === null ? entry : instant(entry, child);
  return Object.freeze({
    owner: owner as PayOwnerRef['owner'],
    schemaId: text(source.schemaId, `${path}.schemaId`, KEY, 128),
    publicId: uuid(source.publicId, `${path}.publicId`),
    revision: integer(source.revision, `${path}.revision`),
    contentHash: text(source.contentHash, `${path}.contentHash`, DIGEST, 64),
    ...('validFrom' in source
      ? { validFrom: nullableInstant(source.validFrom, `${path}.validFrom`) }
      : {}),
    ...('validToExclusive' in source
      ? {
          validToExclusive: nullableInstant(source.validToExclusive, `${path}.validToExclusive`),
        }
      : {}),
  });
}

function node(value: unknown, index: number): PayFormulaNode {
  const path = `ast.nodes[${index}]`;
  const source = exact(value, path, [
    'nodeId',
    'operator',
    'arguments',
    'returnType',
    'value',
    'currency',
    'inputKey',
    'roundingRef',
    'lookupRef',
    'collectionInputKey',
  ]);
  const operator = text(source.operator, `${path}.operator`, undefined, 40);
  if (!OPERATORS.has(operator)) invalid(`${path}.FUNCTION_NOT_ALLOWED`);
  if (!Array.isArray(source.arguments) || source.arguments.length > 16)
    invalid(`${path}.arguments`);
  const argumentsList = source.arguments.map((entry, argumentIndex) =>
    text(entry, `${path}.arguments[${argumentIndex}]`, KEY, 128)
  );
  if (new Set(argumentsList).size !== argumentsList.length) invalid(`${path}.arguments`);
  const optionalText = (entry: unknown, child: string) =>
    entry === undefined || entry === null ? entry : text(entry, child, KEY, 128);
  return Object.freeze({
    nodeId: text(source.nodeId, `${path}.nodeId`, KEY, 128),
    operator: operator as PayFormulaOperator,
    arguments: Object.freeze(argumentsList),
    returnType: valueType(source.returnType, `${path}.returnType`),
    ...('value' in source
      ? {
          value:
            source.value === null || typeof source.value === 'boolean'
              ? source.value
              : text(source.value, `${path}.value`, DECIMAL, 120),
        }
      : {}),
    ...('currency' in source
      ? {
          currency: source.currency === null ? null : currency(source.currency, `${path}.currency`),
        }
      : {}),
    ...('inputKey' in source
      ? { inputKey: optionalText(source.inputKey, `${path}.inputKey`) }
      : {}),
    ...('roundingRef' in source
      ? {
          roundingRef:
            source.roundingRef === null
              ? null
              : ownerRef(source.roundingRef, `${path}.roundingRef`),
        }
      : {}),
    ...('lookupRef' in source
      ? {
          lookupRef:
            source.lookupRef === null ? null : ownerRef(source.lookupRef, `${path}.lookupRef`),
        }
      : {}),
    ...('collectionInputKey' in source
      ? {
          collectionInputKey: optionalText(source.collectionInputKey, `${path}.collectionInputKey`),
        }
      : {}),
  });
}

export function selectPayFormulaAst(value: unknown): PayFormulaAst {
  if (typeof value === 'string') invalid('ast.TYPE');
  if (value && typeof value === 'object' && 'expression' in value) invalid('ast.TYPE');
  const source = exact(value, 'ast', [
    'registryId',
    'registryVersion',
    'declaredReturnType',
    'rootNodeId',
    'nodes',
  ]);
  if (source.registryId !== PAY_FORMULA_REGISTRY_ID || source.registryVersion !== 1)
    invalid('ast.registry');
  if (!Array.isArray(source.nodes) || source.nodes.length === 0) invalid('ast.nodes');
  const result = Object.freeze({
    registryId: PAY_FORMULA_REGISTRY_ID,
    registryVersion: 1 as const,
    declaredReturnType: valueType(source.declaredReturnType, 'ast.declaredReturnType'),
    rootNodeId: text(source.rootNodeId, 'ast.rootNodeId', KEY, 128),
    nodes: Object.freeze(source.nodes.map(node)),
  });
  const findings = validatePayFormulaAst(result);
  if (findings.length) invalid(`ast.${findings[0]!.code}`);
  return result;
}

function moneyLike(type: PayValueType) {
  return type === 'MONEY' || type.startsWith('UNIT_PRICE_');
}

export function validatePayFormulaAst(ast: PayFormulaAst): readonly FormulaDraftFinding[] {
  const findings: FormulaDraftFinding[] = [];
  if (ast.registryId !== PAY_FORMULA_REGISTRY_ID || ast.registryVersion !== 1)
    findings.push({ code: 'TYPE', nodeId: null });
  if (ast.nodes.length > PAY_FORMULA_SAFETY_LIMITS.maxNodes)
    findings.push({ code: 'NODE_LIMIT', nodeId: null });
  const map = new Map<string, PayFormulaNode>();
  for (const current of ast.nodes) {
    if (!OPERATORS.has(current.operator))
      findings.push({ code: 'FUNCTION_NOT_ALLOWED', nodeId: current.nodeId });
    if (map.has(current.nodeId)) findings.push({ code: 'DUPLICATE_NODE', nodeId: current.nodeId });
    map.set(current.nodeId, current);
    if (moneyLike(current.returnType) && !current.currency)
      findings.push({ code: 'CURRENCY_REQUIRED', nodeId: current.nodeId });
    if (current.operator === 'INPUT' && !current.inputKey)
      findings.push({ code: 'INPUT_KEY_REQUIRED', nodeId: current.nodeId });
    if (current.operator === 'ROUND' && !current.roundingRef)
      findings.push({ code: 'ROUNDING_REQUIRED', nodeId: current.nodeId });
    if (current.operator === 'LOOKUP' && !current.lookupRef)
      findings.push({ code: 'LOOKUP_REF_REQUIRED', nodeId: current.nodeId });
    if (current.operator === 'SUM' && !current.collectionInputKey)
      findings.push({ code: 'COLLECTION_KEY_REQUIRED', nodeId: current.nodeId });
    if (
      current.operator === 'LITERAL' &&
      ((current.returnType === 'BOOLEAN' && typeof current.value !== 'boolean') ||
        (current.returnType !== 'BOOLEAN' &&
          (typeof current.value !== 'string' || !DECIMAL.test(current.value))))
    )
      findings.push({ code: 'INVALID_LITERAL', nodeId: current.nodeId });
  }
  const root = map.get(ast.rootNodeId);
  if (!root) findings.push({ code: 'MISSING_NODE', nodeId: ast.rootNodeId });
  else if (root.returnType !== ast.declaredReturnType)
    findings.push({ code: 'TYPE_MISMATCH', nodeId: root.nodeId });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (nodeId: string, depth: number) => {
    if (visiting.has(nodeId)) {
      findings.push({ code: 'CYCLE', nodeId });
      return;
    }
    if (visited.has(nodeId)) return;
    if (depth > PAY_FORMULA_SAFETY_LIMITS.maxDepth) {
      findings.push({ code: 'DEPTH_LIMIT', nodeId });
      return;
    }
    const current = map.get(nodeId);
    if (!current) {
      findings.push({ code: 'MISSING_NODE', nodeId });
      return;
    }
    visiting.add(nodeId);
    for (const argument of current.arguments) walk(argument, depth + 1);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const current of ast.nodes) walk(current.nodeId, 1);

  const sameUnitOperators = new Set(['ADD', 'SUBTRACT', 'MIN', 'MAX']);
  for (const current of ast.nodes) {
    if (!sameUnitOperators.has(current.operator)) continue;
    for (const argumentId of current.arguments) {
      const argument = map.get(argumentId);
      if (argument && argument.returnType !== current.returnType)
        findings.push({ code: 'UNIT_MISMATCH', nodeId: current.nodeId });
      if (argument && moneyLike(current.returnType) && argument.currency !== current.currency)
        findings.push({ code: 'CURRENCY_MISMATCH', nodeId: current.nodeId });
    }
  }
  return Object.freeze(
    findings.filter(
      (finding, index) =>
        findings.findIndex(
          (candidate) => candidate.code === finding.code && candidate.nodeId === finding.nodeId
        ) === index
    )
  );
}

export function validateSimulationCommand(command: SimulatePayrollFormula) {
  const errors: string[] = [];
  if (
    !Number.isSafeInteger(command.timeoutMillis) ||
    command.timeoutMillis < 1 ||
    command.timeoutMillis > PAY_FORMULA_SAFETY_LIMITS.maxTimeoutMillis
  )
    errors.push('TIMEOUT_LIMIT');
  try {
    rounding(command.rounding, 'rounding');
    Object.entries(command.inputs).forEach(([key, value]) => {
      text(key, `inputs.${key}`, KEY, 128);
      const parsedType = valueType(value.type, `inputs.${key}.type`);
      if (parsedType === 'BOOLEAN') {
        if (typeof value.booleanValue !== 'boolean' || value.value !== undefined)
          errors.push(`INPUT_${key}`);
      } else if (!value.value || !DECIMAL.test(value.value)) errors.push(`INPUT_${key}`);
      if (moneyLike(parsedType) && (!value.currency || !isPayCurrencyCode(value.currency)))
        errors.push(`INPUT_${key}_CURRENCY`);
    });
  } catch {
    errors.push('SIMULATION_INPUT');
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze([...new Set(errors)]) });
}

export const PAYROLL_ELEMENT_FORMULA_CONTRACT = Object.freeze({
  sliceId: 'BASE-TFR-PAY-006',
  pageArchetype: 'STUDIO',
  formulaRegistry: PAY_FORMULA_REGISTRY_ID,
  stringFormulaAccepted: false,
  calculatesPayroll: false,
  productionActivation: false,
  commandResponse: 'PayrollCommandReceipt.v1',
  publicationEvent: 'PayrollConfigurationPublished.v1',
  population: Object.freeze(['LEGAL_ENTITY', 'PAY_GROUP'] as const),
  permissions: Object.freeze({
    workbench: 'hcm.configuration.workbench.view',
    author: 'hcm.operations.payroll-inputs.update',
    publish: 'hcm.configuration.policy.publish',
  }),
});

export const payrollFormulaModelInternals = Object.freeze({
  exact,
  text,
  integer,
  uuid,
  date,
  instant,
  valueType,
  currency,
  rounding,
  ownerRef,
});
