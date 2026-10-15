import type { components } from '@dwp-frontend/api-contracts';

export type HrisCommandReceipt = components['schemas']['people_CommandReceiptV1'];
export type HrisCommandReceiptStatus = HrisCommandReceipt['status'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COMMAND_CODE = /^[A-Z][A-Z0-9._-]{0,127}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const RECEIPT_KEYS = [
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
] as const;
const RECEIPT_STATUSES = new Set<HrisCommandReceiptStatus>([
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const TERMINAL_RECEIPT_STATUSES = new Set<HrisCommandReceiptStatus>([
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
]);

function invalid(): never {
  throw new Error('HRIS command receipt is invalid.');
}

function exactRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const source = value as Record<string, unknown>;
  const actual = Object.keys(source).sort();
  const expected = [...RECEIPT_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return invalid();
  }
  return source;
}

function text(value: unknown, maximum: number, pattern?: RegExp): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > maximum ||
    (pattern && !pattern.test(value))
  ) {
    return invalid();
  }
  return value;
}

function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return invalid();
  return value;
}

function uuid(value: unknown): string {
  return text(value, 36, UUID);
}

function instant(value: unknown): string {
  const candidate = text(value, 100);
  if (!candidate.includes('T') || !Number.isFinite(Date.parse(candidate))) return invalid();
  return candidate;
}

/** Parses the closed PEP-HRM-014 wire projection and rejects additive/raw result data. */
export function parseHrisCommandReceipt(value: unknown): HrisCommandReceipt {
  const source = exactRecord(value);
  uuid(source.receiptId);
  text(source.commandType, 128, COMMAND_CODE);
  text(source.originatingAction, 128, COMMAND_CODE);
  uuid(source.subjectPrincipalPublicId);
  text(source.populationScopeDigest, 64, DIGEST);
  positiveInteger(source.fieldPolicyRevision);
  text(source.purposeCode, 128, COMMAND_CODE);
  positiveInteger(source.authorizationRevision);
  if (!RECEIPT_STATUSES.has(source.status as HrisCommandReceiptStatus)) invalid();
  uuid(source.correlationId);
  text(source.requestDigest, 64, DIGEST);
  instant(source.createdAt);
  return Object.freeze(source) as unknown as HrisCommandReceipt;
}

export function hrisCommandReceiptIsTerminal(receipt: HrisCommandReceipt): boolean {
  return TERMINAL_RECEIPT_STATUSES.has(receipt.status);
}

export function assertSameHrisCommandReceipt(
  expected: HrisCommandReceipt,
  candidate: HrisCommandReceipt
): void {
  const identityKeys = [
    'receiptId',
    'commandType',
    'originatingAction',
    'subjectPrincipalPublicId',
    'correlationId',
    'requestDigest',
    'createdAt',
  ] as const;
  if (identityKeys.some((key) => expected[key] !== candidate[key])) {
    throw new Error('HRIS command receipt identity changed during recovery.');
  }
}
