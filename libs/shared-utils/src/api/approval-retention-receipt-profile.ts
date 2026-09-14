import {
  approvalRetentionId,
  approvalRetentionKey,
  approvalRetentionVersion,
  readApprovalRetentionRules,
} from './approval-retention-contract';
import type {
  ApprovalRetentionClaimInput,
  ApprovalRetentionSaveInput,
} from './approval-retention-contract';

export const APPROVAL_RETENTION_RECEIPT_PROFILE =
  'RETENTION_COMMAND_RECEIPT_STEP_UP_TYPED_JSON_V1' as const;
export const APPROVAL_RETENTION_RECEIPT_HASH = 'APPROVAL_STEP_UP_TYPED_JSON_SHA256_V1' as const;

type PublishInput = Readonly<{
  expectedVersion: number;
  idempotencyKey: string;
  reviewComment: string;
}>;
export type ApprovalRetentionReceiptCommand =
  | Readonly<{
      operation: 'INITIALIZE_POLICY';
      originalTargetId: null;
      body: Readonly<{ expectedAbsent: true; idempotencyKey: string }>;
    }>
  | Readonly<{
      operation: 'SAVE_POLICY';
      originalTargetId: string;
      body: ApprovalRetentionSaveInput;
    }>
  | Readonly<{
      operation: 'PUBLISH_POLICY';
      originalTargetId: string;
      body: PublishInput;
    }>
  | Readonly<{
      operation: 'CLAIM_RECORD';
      originalTargetId: string;
      body: ApprovalRetentionClaimInput;
    }>;
export type ApprovalRetentionReceiptOriginal = Readonly<{
  command: ApprovalRetentionReceiptCommand;
  actorUserId: number;
  resourceSetKey: string;
  originalExpectedVersion: number | null;
  canonicalBody: string;
  requestBodySha256: string;
}>;
const originals = new WeakSet<ApprovalRetentionReceiptOriginal>();

export function assertApprovalRetentionReceiptOriginal(
  value: unknown
): asserts value is ApprovalRetentionReceiptOriginal {
  if (
    !value ||
    typeof value !== 'object' ||
    !originals.has(value as ApprovalRetentionReceiptOriginal)
  )
    invalid();
}

function invalid(): never {
  throw new Error('Invalid approval retention original command profile');
}
function fields(value: unknown, keys: readonly string[]) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.hasOwn(row, key)))
    invalid();
  return row;
}
function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) invalid();
  return value;
}
function resourceSet(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{2,79}$/.test(value)) invalid();
  return value;
}
function snapshot(command: ApprovalRetentionReceiptCommand): ApprovalRetentionReceiptCommand {
  fields(command, ['operation', 'originalTargetId', 'body']);
  if (command.operation === 'INITIALIZE_POLICY') {
    fields(command.body, ['expectedAbsent', 'idempotencyKey']);
    if (command.originalTargetId !== null || command.body.expectedAbsent !== true) invalid();
    return Object.freeze({
      ...command,
      body: Object.freeze({
        expectedAbsent: true,
        idempotencyKey: approvalRetentionKey(command.body.idempotencyKey),
      }),
    });
  }
  const originalTargetId = approvalRetentionId(command.originalTargetId);
  switch (command.operation) {
    case 'SAVE_POLICY':
      fields(command.body, ['expectedVersion', 'idempotencyKey', 'rules']);
      return Object.freeze({
        operation: command.operation,
        originalTargetId,
        body: Object.freeze({
          expectedVersion: approvalRetentionVersion(
            command.body.expectedVersion,
            Number.MAX_SAFE_INTEGER - 1
          ),
          idempotencyKey: approvalRetentionKey(command.body.idempotencyKey),
          rules: readApprovalRetentionRules(command.body.rules),
        }),
      });
    case 'PUBLISH_POLICY': {
      fields(command.body, ['expectedVersion', 'idempotencyKey', 'reviewComment']);
      const comment = command.body.reviewComment;
      if (
        typeof comment !== 'string' ||
        comment.trim().length < 10 ||
        comment.length > 1000 ||
        comment.includes('\0') ||
        new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(comment)) !==
          comment
      )
        invalid();
      return Object.freeze({
        operation: command.operation,
        originalTargetId,
        body: Object.freeze({
          expectedVersion: approvalRetentionVersion(
            command.body.expectedVersion,
            Number.MAX_SAFE_INTEGER - 1
          ),
          idempotencyKey: approvalRetentionKey(command.body.idempotencyKey),
          reviewComment: comment,
        }),
      });
    }
    case 'CLAIM_RECORD':
      fields(command.body, [
        'expectedVersion',
        'policyId',
        'expectedPolicyVersion',
        'expectedHoldVersion',
        'inventorySha256',
        'idempotencyKey',
      ]);
      return Object.freeze({
        operation: command.operation,
        originalTargetId,
        body: Object.freeze({
          expectedVersion: approvalRetentionVersion(command.body.expectedVersion),
          policyId: approvalRetentionId(command.body.policyId),
          expectedPolicyVersion: approvalRetentionVersion(command.body.expectedPolicyVersion),
          expectedHoldVersion: approvalRetentionVersion(command.body.expectedHoldVersion),
          inventorySha256: digest(command.body.inventorySha256),
          idempotencyKey: approvalRetentionKey(command.body.idempotencyKey),
        }),
      });
    default:
      return invalid();
  }
}

// This closed typed-body profile matches ApprovalStepUpVerifier, not Signature/JCS.
function bytewriterString(value: string): string {
  // Consume escaped backslashes as a unit so literal "\\u" text is never rewritten.
  return JSON.stringify(value).replace(
    /\\u[0-9a-f]{4}|\\.|[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
    (token) => {
      if (token.startsWith('\\u')) return `\\u${token.slice(2).toUpperCase()}`;
      if (token.startsWith('\\')) return token;
      return [token.charCodeAt(0), token.charCodeAt(1)]
        .map((unit) => `\\u${unit.toString(16).toUpperCase().padStart(4, '0')}`)
        .join('');
    }
  );
}
function sortedTypedJson(value: unknown): string {
  if (typeof value === 'string') return bytewriterString(value);
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(approvalRetentionVersion(value));
  if (Array.isArray(value)) return `[${value.map(sortedTypedJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row)
      .sort()
      .map((key) => `${bytewriterString(key)}:${sortedTypedJson(row[key])}`)
      .join(',')}}`;
  }
  return invalid();
}
export async function prepareApprovalRetentionReceiptOriginal(
  command: ApprovalRetentionReceiptCommand,
  actorUserId: number,
  resourceSetKey: string
): Promise<ApprovalRetentionReceiptOriginal> {
  if (approvalRetentionVersion(actorUserId) < 1) invalid();
  resourceSet(resourceSetKey);
  const original = snapshot(command);
  if (original.body.idempotencyKey === '.' || original.body.idempotencyKey === '..') invalid();
  const canonicalBody = sortedTypedJson(original.body);
  const hash = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalBody)
  );
  const prepared = Object.freeze({
    command: original,
    actorUserId,
    resourceSetKey,
    originalExpectedVersion:
      original.operation === 'INITIALIZE_POLICY' ? null : original.body.expectedVersion,
    canonicalBody,
    requestBodySha256: Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join(''),
  });
  originals.add(prepared);
  return prepared;
}

export type ApprovalRetentionReceiptMetadata = Readonly<{
  commandId: string;
  operation: ApprovalRetentionReceiptCommand['operation'];
  idempotencyKey: string;
  actorUserId: number;
  resourceSetKey: string;
  originalTargetId: string | null;
  resultReferenceId: string;
  requestBodySha256: string;
  originalExpectedVersion: number | null;
  resultVersion: number;
  status: 'COMMITTED';
  committedAt: string;
  originAuthorityProfile:
    | 'POLICY_UPDATE_TRUSTED'
    | 'POLICY_PUBLISH_SIGNED_HIGH_INDEPENDENT_CHECKER'
    | 'RETENTION_RECORD_EXECUTE_SIGNED_HIGH';
  profileVersion: typeof APPROVAL_RETENTION_RECEIPT_PROFILE;
}>;

/** Only the original same-transaction command witness confirms a write, never a current head. */
export function bindApprovalRetentionReceipt(
  value: unknown,
  original: ApprovalRetentionReceiptOriginal
): ApprovalRetentionReceiptMetadata {
  assertApprovalRetentionReceiptOriginal(original);
  const row = fields(value, [
    'commandId',
    'operation',
    'idempotencyKey',
    'actorUserId',
    'resourceSetKey',
    'originalTargetId',
    'resultReferenceId',
    'requestBodySha256',
    'originalExpectedVersion',
    'resultVersion',
    'status',
    'committedAt',
    'originAuthorityProfile',
    'profileVersion',
  ]);
  const operation = original.command.operation;
  const expectedProfile =
    operation === 'CLAIM_RECORD'
      ? 'RETENTION_RECORD_EXECUTE_SIGNED_HIGH'
      : operation === 'PUBLISH_POLICY'
        ? 'POLICY_PUBLISH_SIGNED_HIGH_INDEPENDENT_CHECKER'
        : 'POLICY_UPDATE_TRUSTED';
  const expectedResultVersion =
    operation === 'SAVE_POLICY' || operation === 'PUBLISH_POLICY'
      ? original.originalExpectedVersion! + 1
      : 0;
  if (
    row.operation !== operation ||
    approvalRetentionKey(row.idempotencyKey) !== original.command.body.idempotencyKey ||
    approvalRetentionVersion(row.actorUserId) !== original.actorUserId ||
    resourceSet(row.resourceSetKey) !== original.resourceSetKey ||
    row.originalTargetId !== original.command.originalTargetId ||
    row.originalExpectedVersion !== original.originalExpectedVersion ||
    digest(row.requestBodySha256) !== original.requestBodySha256 ||
    row.status !== 'COMMITTED' ||
    row.profileVersion !== APPROVAL_RETENTION_RECEIPT_PROFILE ||
    row.originAuthorityProfile !== expectedProfile ||
    approvalRetentionVersion(row.resultVersion) !== expectedResultVersion ||
    typeof row.committedAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(row.committedAt) ||
    !Number.isFinite(Date.parse(row.committedAt))
  )
    invalid();
  const civilDate = row.committedAt.slice(0, 10);
  if (!new Date(`${civilDate}T00:00:00Z`).toISOString().startsWith(civilDate)) invalid();
  const resultReferenceId = approvalRetentionId(row.resultReferenceId);
  if (
    (operation === 'SAVE_POLICY' || operation === 'PUBLISH_POLICY') &&
    resultReferenceId !== original.command.originalTargetId
  )
    invalid();
  return Object.freeze({
    commandId: approvalRetentionId(row.commandId),
    operation,
    idempotencyKey: original.command.body.idempotencyKey,
    actorUserId: original.actorUserId,
    resourceSetKey: original.resourceSetKey,
    originalTargetId: original.command.originalTargetId,
    resultReferenceId,
    requestBodySha256: original.requestBodySha256,
    originalExpectedVersion: original.originalExpectedVersion,
    resultVersion: expectedResultVersion,
    status: 'COMMITTED',
    committedAt: row.committedAt,
    originAuthorityProfile: expectedProfile,
    profileVersion: APPROVAL_RETENTION_RECEIPT_PROFILE,
  });
}
