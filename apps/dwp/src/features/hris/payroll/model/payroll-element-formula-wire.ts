import { payrollFormulaModelInternals as parse } from './payroll-element-formula-model';

import type { PayrollFormulaReceipt } from './payroll-element-formula-model';

export type PayrollFormulaReceiptExpectation = Readonly<{
  correlationId: string;
  commandType: PayrollFormulaReceipt['commandType'];
}>;

const COMMAND_TYPES = new Set<PayrollFormulaReceipt['commandType']>([
  'CREATE_ELEMENT_VERSION',
  'CREATE_FORMULA_VERSION',
  'VALIDATE_FORMULA',
  'SIMULATE_FORMULA',
  'PUBLISH_FORMULA',
]);
const RECEIPT_STATUSES = new Set<PayrollFormulaReceipt['status']>([
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const ACTION_BY_COMMAND: Readonly<
  Record<PayrollFormulaReceipt['commandType'], PayrollFormulaReceipt['originatingAction']>
> = Object.freeze({
  CREATE_ELEMENT_VERSION: 'PAY_ELEMENT_CONFIGURE',
  CREATE_FORMULA_VERSION: 'PAY_FORMULA_CONFIGURE',
  VALIDATE_FORMULA: 'PAY_FORMULA_VALIDATE',
  SIMULATE_FORMULA: 'PAY_FORMULA_SIMULATE',
  PUBLISH_FORMULA: 'PAY_FORMULA_PUBLISH',
});
const DIGEST = /^[0-9a-f]{64}$/u;

function invalid(path: string): never {
  throw new Error(`Invalid PayrollCommandReceipt.v1 source: ${path}`);
}

function exactReceipt(value: unknown, allowed: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('receipt');
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !allowed.includes(key))) invalid('receipt');
  return source;
}

/**
 * Selects the complete public PAY receipt and rejects composite resource or
 * outbox-event payloads. Resource state is authoritative only after IAQ-055 is
 * refreshed; PayrollConfigurationPublished.v1 is never an inline response.
 */
export function selectPayrollFormulaReceipt(
  value: unknown,
  expectation?: PayrollFormulaReceiptExpectation
): PayrollFormulaReceipt {
  const source = exactReceipt(value, [
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
  ]);
  if (
    !COMMAND_TYPES.has(source.commandType as PayrollFormulaReceipt['commandType']) ||
    !RECEIPT_STATUSES.has(source.status as PayrollFormulaReceipt['status']) ||
    source.purposeCode !== 'PAYROLL_CONFIGURATION'
  ) {
    invalid('receipt');
  }
  const commandType = source.commandType as PayrollFormulaReceipt['commandType'];
  if (source.originatingAction !== ACTION_BY_COMMAND[commandType]) {
    invalid('receipt.originatingAction');
  }
  const result: PayrollFormulaReceipt = Object.freeze({
    receiptId: parse.uuid(source.receiptId, 'receipt.receiptId'),
    commandType,
    originatingAction: source.originatingAction as PayrollFormulaReceipt['originatingAction'],
    subjectPrincipalPublicId: parse.uuid(
      source.subjectPrincipalPublicId,
      'receipt.subjectPrincipalPublicId'
    ),
    populationScopeDigest: parse.text(
      source.populationScopeDigest,
      'receipt.populationScopeDigest',
      DIGEST,
      64
    ),
    fieldPolicyRevision: parse.text(
      source.fieldPolicyRevision,
      'receipt.fieldPolicyRevision',
      undefined,
      128
    ),
    purposeCode: 'PAYROLL_CONFIGURATION',
    authorizationRevision: parse.text(
      source.authorizationRevision,
      'receipt.authorizationRevision',
      undefined,
      128
    ),
    status: source.status as PayrollFormulaReceipt['status'],
    correlationId: parse.uuid(source.correlationId, 'receipt.correlationId'),
    requestDigest: parse.text(source.requestDigest, 'receipt.requestDigest', DIGEST, 64),
    createdAt: parse.instant(source.createdAt, 'receipt.createdAt'),
  });
  if (
    expectation &&
    (result.correlationId !== expectation.correlationId ||
      result.commandType !== expectation.commandType ||
      result.originatingAction !== ACTION_BY_COMMAND[expectation.commandType])
  ) {
    invalid('receipt.expectation');
  }
  return result;
}

export function selectSuccessfulPayrollFormulaReceipt(
  value: unknown,
  expectation: PayrollFormulaReceiptExpectation
) {
  const receipt = selectPayrollFormulaReceipt(value, expectation);
  if (receipt.status !== 'SUCCEEDED') invalid(`receipt.status.${receipt.status}`);
  return receipt;
}
