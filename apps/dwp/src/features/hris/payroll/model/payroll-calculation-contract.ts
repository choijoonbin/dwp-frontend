export const PAYROLL_CALCULATION_PURPOSE = 'PAYROLL_PROCESSING' as const;
export const PAYROLL_RECEIPT_PURPOSE = 'COMMAND_STATUS' as const;

export const PAYROLL_CALCULATION_OPERATION_BINDINGS = Object.freeze([
  {
    contractId: 'PEP-PAY-012',
    method: 'POST',
    path: '/api/payroll/v1/runs/{runId}/attempts',
    capability: 'hcm.operations.payroll-run.execute',
    purpose: PAYROLL_CALCULATION_PURPOSE,
    stepUp: false,
  },
  {
    contractId: 'PEP-PAY-013',
    method: 'GET',
    path: '/api/payroll/v1/runs/{runId}',
    capability: 'hcm.operations.payroll-run.execute|hcm.operations.payroll-support.view',
    purpose: PAYROLL_CALCULATION_PURPOSE,
    stepUp: false,
  },
  {
    contractId: 'PEP-PAY-017',
    method: 'POST',
    path: '/api/payroll/v1/runs/{runId}/approvals',
    capability: 'hcm.operations.payroll.approve',
    purpose: PAYROLL_CALCULATION_PURPOSE,
    stepUp: true,
    segregationOfDuties: 'RUN_MAKER_NE_APPROVER',
  },
  {
    contractId: 'PEP-PAY-018',
    method: 'POST',
    path: '/api/payroll/v1/runs/{runId}/finalize',
    capability: 'hcm.operations.payroll.release',
    purpose: PAYROLL_CALCULATION_PURPOSE,
    stepUp: true,
    segregationOfDuties: 'RUN_MAKER_NE_FINALIZER',
  },
  {
    contractId: 'PEP-PAY-033',
    method: 'GET',
    path: '/api/payroll/v1/command-receipts/{receiptId}',
    capability: 'hcm.command-receipt.view',
    purpose: PAYROLL_RECEIPT_PURPOSE,
    stepUp: false,
    contextMismatch: 'OPAQUE_404',
  },
] as const);

export const PAYROLL_RUN_TYPES = ['REGULAR', 'OFF_CYCLE', 'RETRO', 'CORRECTION'] as const;
export type PayrollRunType = (typeof PAYROLL_RUN_TYPES)[number];

export const PAYROLL_RUN_STATES = [
  'PREPARING',
  'READY',
  'CALCULATING',
  'VALIDATED',
  'APPROVED',
  'FINALIZED',
  'FAILED',
  'RESULT_UNKNOWN',
] as const;
export type PayrollRunState = (typeof PAYROLL_RUN_STATES)[number];

export type PayrollPostedMoney = Readonly<{ amount: string; currency: string }>;

export type PayrollCalculationRun = Readonly<{
  runId: string;
  runType: PayrollRunType;
  payPeriodId: string;
  state: PayrollRunState;
  workerCount: number;
  gross: PayrollPostedMoney;
  net: PayrollPostedMoney;
  version: number;
}>;

export type PayrollActionCommand = Readonly<{
  reasonCode: string;
  approvalReceiptId?: string;
  comment?: string;
}>;

export const PAYROLL_CALCULATION_COMMANDS = Object.freeze({
  CALCULATE: Object.freeze({
    commandType: 'RUN_CALCULATE',
    originatingAction: 'PAY_RUN_CALCULATE',
  }),
  APPROVE: Object.freeze({
    commandType: 'RUN_APPROVE',
    originatingAction: 'PAY_RUN_APPROVE',
  }),
  FINALIZE: Object.freeze({
    commandType: 'RUN_FINALIZE',
    originatingAction: 'PAY_RUN_FINALIZE',
  }),
} as const);

export type PayrollCalculationCommandKind = keyof typeof PAYROLL_CALCULATION_COMMANDS;
export type PayrollCalculationCommandType =
  (typeof PAYROLL_CALCULATION_COMMANDS)[PayrollCalculationCommandKind]['commandType'];
export type PayrollCalculationOriginatingAction =
  (typeof PAYROLL_CALCULATION_COMMANDS)[PayrollCalculationCommandKind]['originatingAction'];

export const PAYROLL_RECEIPT_STATUSES = [
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'RESULT_UNKNOWN',
] as const;
export type PayrollReceiptStatus = (typeof PAYROLL_RECEIPT_STATUSES)[number];

export type PayrollCalculationReceipt = Readonly<{
  receiptId: string;
  commandType: PayrollCalculationCommandType;
  originatingAction: PayrollCalculationOriginatingAction;
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: typeof PAYROLL_CALCULATION_PURPOSE;
  authorizationRevision: number;
  status: PayrollReceiptStatus;
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion?: number;
  resultRef?: string;
}>;

export type PayrollReceiptExpectation = Readonly<{
  correlationId?: string;
  kind?: PayrollCalculationCommandKind;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DIGEST = /^[0-9a-f]{64}$/u;
const POSTED_AMOUNT = /^-?(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,4})?$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const RFC3339_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function invalid(path: string): never {
  throw new Error(`Invalid PAY-011 transport source: ${path}`);
}

function exact(value: unknown, path: string, keys: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !keys.includes(key))) invalid(path);
  return source;
}

function text(value: unknown, path: string, maximum: number, pattern?: RegExp, minimum = 1) {
  if (
    typeof value !== 'string' ||
    value.length < minimum ||
    value.length > maximum ||
    (pattern && !pattern.test(value))
  ) {
    invalid(path);
  }
  return value;
}

function uuid(value: unknown, path: string) {
  return text(value, path, 36, UUID);
}

function integer(value: unknown, path: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) invalid(path);
  return Number(value);
}

function instant(value: unknown, path: string) {
  const candidate = text(value, path, 64, RFC3339_INSTANT);
  if (!Number.isFinite(Date.parse(candidate))) invalid(path);
  return candidate;
}

function money(value: unknown, path: string): PayrollPostedMoney {
  const source = exact(value, path, ['amount', 'currency']);
  return Object.freeze({
    amount: text(source.amount, `${path}.amount`, 21, POSTED_AMOUNT),
    currency: text(source.currency, `${path}.currency`, 3, CURRENCY),
  });
}

export function selectPayrollCalculationRun(value: unknown): PayrollCalculationRun {
  const source = exact(value, 'run', [
    'runId',
    'runType',
    'payPeriodId',
    'state',
    'workerCount',
    'gross',
    'net',
    'version',
  ]);
  if (!PAYROLL_RUN_TYPES.includes(source.runType as PayrollRunType)) invalid('run.runType');
  if (!PAYROLL_RUN_STATES.includes(source.state as PayrollRunState)) invalid('run.state');
  const gross = money(source.gross, 'run.gross');
  const net = money(source.net, 'run.net');
  return Object.freeze({
    runId: uuid(source.runId, 'run.runId'),
    runType: source.runType as PayrollRunType,
    payPeriodId: uuid(source.payPeriodId, 'run.payPeriodId'),
    state: source.state as PayrollRunState,
    workerCount: integer(source.workerCount, 'run.workerCount'),
    gross,
    net,
    version: integer(source.version, 'run.version'),
  });
}

export function selectPayrollCalculationReceipt(
  value: unknown,
  expectation: PayrollReceiptExpectation = {}
): PayrollCalculationReceipt {
  const source = exact(value, 'receipt', [
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
  ]);
  const binding = Object.values(PAYROLL_CALCULATION_COMMANDS).find(
    (candidate) =>
      candidate.commandType === source.commandType &&
      candidate.originatingAction === source.originatingAction
  );
  if (
    !binding ||
    source.purposeCode !== PAYROLL_CALCULATION_PURPOSE ||
    !PAYROLL_RECEIPT_STATUSES.includes(source.status as PayrollReceiptStatus)
  ) {
    invalid('receipt.binding');
  }
  const receipt: PayrollCalculationReceipt = Object.freeze({
    receiptId: uuid(source.receiptId, 'receipt.receiptId'),
    commandType: binding.commandType,
    originatingAction: binding.originatingAction,
    subjectPrincipalPublicId: uuid(
      source.subjectPrincipalPublicId,
      'receipt.subjectPrincipalPublicId'
    ),
    populationScopeDigest: text(
      source.populationScopeDigest,
      'receipt.populationScopeDigest',
      64,
      DIGEST
    ),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 'receipt.fieldPolicyRevision', 1),
    purposeCode: PAYROLL_CALCULATION_PURPOSE,
    authorizationRevision: integer(
      source.authorizationRevision,
      'receipt.authorizationRevision',
      1
    ),
    status: source.status as PayrollReceiptStatus,
    correlationId: uuid(source.correlationId, 'receipt.correlationId'),
    requestDigest: text(source.requestDigest, 'receipt.requestDigest', 64, DIGEST),
    createdAt: instant(source.createdAt, 'receipt.createdAt'),
    ...(source.aggregateVersion !== undefined
      ? { aggregateVersion: integer(source.aggregateVersion, 'receipt.aggregateVersion') }
      : {}),
    ...(source.resultRef !== undefined
      ? { resultRef: text(source.resultRef, 'receipt.resultRef', Number.MAX_SAFE_INTEGER) }
      : {}),
  });
  const expectedBinding = expectation.kind
    ? PAYROLL_CALCULATION_COMMANDS[expectation.kind]
    : undefined;
  if (
    (expectation.correlationId && receipt.correlationId !== expectation.correlationId) ||
    (expectedBinding &&
      (receipt.commandType !== expectedBinding.commandType ||
        receipt.originatingAction !== expectedBinding.originatingAction))
  ) {
    invalid('receipt.expectation');
  }
  return receipt;
}

export function validatePayrollActionCommand(value: PayrollActionCommand): PayrollActionCommand {
  const source = exact(value, 'command', ['reasonCode', 'approvalReceiptId', 'comment']);
  const result: PayrollActionCommand = Object.freeze({
    reasonCode: text(source.reasonCode, 'command.reasonCode', 64),
    ...(source.approvalReceiptId !== undefined
      ? { approvalReceiptId: uuid(source.approvalReceiptId, 'command.approvalReceiptId') }
      : {}),
    ...(source.comment !== undefined
      ? { comment: text(source.comment, 'command.comment', 1000, undefined, 0) }
      : {}),
  });
  return result;
}

const EXCEPTION_ORDER: Readonly<Record<PayrollRunState, number>> = Object.freeze({
  RESULT_UNKNOWN: 0,
  FAILED: 1,
  CALCULATING: 2,
  PREPARING: 3,
  READY: 4,
  VALIDATED: 5,
  APPROVED: 6,
  FINALIZED: 7,
});

export function orderPayrollRunsExceptionFirst(runs: readonly PayrollCalculationRun[]) {
  return [...runs].sort(
    (left, right) =>
      EXCEPTION_ORDER[left.state] - EXCEPTION_ORDER[right.state] ||
      left.payPeriodId.localeCompare(right.payPeriodId) ||
      left.runId.localeCompare(right.runId)
  );
}

export function payrollRunCommandAvailability(run: PayrollCalculationRun | null) {
  return Object.freeze({
    calculate: run?.state === 'READY',
    approve: run?.state === 'VALIDATED',
    finalize: run?.state === 'APPROVED',
    uncertain: run?.state === 'RESULT_UNKNOWN',
  });
}

export function isPayrollReceiptPending(receipt: PayrollCalculationReceipt) {
  return ['ACCEPTED', 'RUNNING', 'RESULT_UNKNOWN'].includes(receipt.status);
}
