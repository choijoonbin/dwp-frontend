import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import golden from './__fixtures__/approval-retention-command-java-golden.json';
import golden2 from './__fixtures__/approval-retention-command-java-golden2.json';
import golden3 from './__fixtures__/approval-retention-command-java-golden3.json';
import {
  APPROVAL_RETENTION_RECEIPT_HASH,
  APPROVAL_RETENTION_RECEIPT_PROFILE,
  bindApprovalRetentionReceipt,
  prepareApprovalRetentionReceiptOriginal,
} from './approval-retention-receipt-profile';
import type {
  ApprovalRetentionReceiptCommand,
  ApprovalRetentionReceiptOriginal,
} from './approval-retention-receipt-profile';

const target = golden.originalTargetId;
const commandId = '00000000-0000-0000-0000-000000000043';
const intentId = '00000000-0000-0000-0000-000000000044';
const publication = (): Extract<
  ApprovalRetentionReceiptCommand,
  { operation: 'PUBLISH_POLICY' }
> => ({
  operation: 'PUBLISH_POLICY',
  originalTargetId: target,
  body: { ...golden.body },
});
function receipt(original: ApprovalRetentionReceiptOriginal) {
  const operation = original.command.operation;
  return {
    commandId,
    operation,
    idempotencyKey: original.command.body.idempotencyKey,
    actorUserId: original.actorUserId,
    resourceSetKey: original.resourceSetKey,
    originalTargetId: original.command.originalTargetId,
    resultReferenceId: operation === 'CLAIM_RECORD' ? intentId : target,
    requestBodySha256: original.requestBodySha256,
    originalExpectedVersion: original.originalExpectedVersion,
    resultVersion:
      operation === 'SAVE_POLICY' || operation === 'PUBLISH_POLICY'
        ? original.originalExpectedVersion! + 1
        : 0,
    status: 'COMMITTED',
    committedAt: '2026-09-14T20:10:00.123456789+09:00',
    originAuthorityProfile:
      operation === 'CLAIM_RECORD'
        ? 'RETENTION_RECORD_EXECUTE_SIGNED_HIGH'
        : operation === 'PUBLISH_POLICY'
          ? 'POLICY_PUBLISH_SIGNED_HIGH_INDEPENDENT_CHECKER'
          : 'POLICY_UPDATE_TRUSTED',
    profileVersion: APPROVAL_RETENTION_RECEIPT_PROFILE,
  };
}
const commands: ApprovalRetentionReceiptCommand[] = [
  {
    operation: 'INITIALIZE_POLICY',
    originalTargetId: null,
    body: { expectedAbsent: true, idempotencyKey: 'initialize:original' },
  },
  {
    operation: 'SAVE_POLICY',
    originalTargetId: target,
    body: {
      expectedVersion: 7,
      idempotencyKey: 'save:original',
      rules: {
        allowPurge: false,
        allowedClassifications: ['INTERNAL', 'CONFIDENTIAL'],
        recordRetentionDays: 365,
        deletedDraftRecoveryDays: 30,
        receiptRetentionDays: 365,
        holdEvidenceRetentionDays: 365,
        auditEvidenceRetentionDays: 365,
        maxInventoryRows: 50000,
        maxObjectsPerRecord: 1000,
      },
    },
  },
  publication(),
  {
    operation: 'CLAIM_RECORD',
    originalTargetId: target,
    body: {
      expectedVersion: Number.MAX_SAFE_INTEGER,
      expectedPolicyVersion: 7,
      expectedHoldVersion: 4,
      policyId: commandId,
      inventorySha256: 'a'.repeat(64),
      idempotencyKey: 'claim:original',
    },
  },
];

describe('native retention typed original command and commit witness binding', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it('matches the actual Java UTF8/safe-integer golden without relabeling Signature/JCS', async () => {
    const original = await prepareApprovalRetentionReceiptOriginal(
      publication(),
      42,
      'RS_APPROVALS'
    );
    expect(APPROVAL_RETENTION_RECEIPT_HASH).toBe(golden.algorithm);
    expect(APPROVAL_RETENTION_RECEIPT_PROFILE).toBe(golden.profileVersion);
    expect(original.canonicalBody).toBe(golden.expectedCanonical1);
    expect(original.requestBodySha256).toBe(golden.requestBodySha256);
  });

  it.each([...golden2.vectors, ...golden3.vectors])(
    'matches actual Java bytewriter $name',
    async (vector) => {
      const command = publication();
      const original = await prepareApprovalRetentionReceiptOriginal(
        { ...command, body: { ...command.body, reviewComment: vector.reviewComment } },
        42,
        'RS_APPROVALS'
      );
      expect(original.canonicalBody).toBe(vector.expectedCanonical1);
      expect(original.requestBodySha256).toBe(vector.requestBodySha256);
    }
  );

  it.each(commands)('binds only the actual original $operation witness', async (command) => {
    const original = await prepareApprovalRetentionReceiptOriginal(command, 42, 'RS_APPROVALS');
    const result = bindApprovalRetentionReceipt(receipt(original), original);
    expect(result.status).toBe('COMMITTED');
    expect(result.originalTargetId).toBe(command.originalTargetId);
    expect(result.originalExpectedVersion).toBe(original.originalExpectedVersion);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('snapshots caller data before asynchronous hashing and never mutates the original body', async () => {
    const command = publication();
    const pending = prepareApprovalRetentionReceiptOriginal(command, 42, 'RS_APPROVALS');
    const body = command.body as { reviewComment: string; idempotencyKey: string };
    body.reviewComment = 'another different original review';
    body.idempotencyKey = 'another-key';
    const original = await pending;
    expect(original.requestBodySha256).toBe(golden.requestBodySha256);
    expect(original.command.body.idempotencyKey).toBe('original-key');
    expect(Object.isFrozen(original)).toBe(true);
    expect(Object.isFrozen(original.command.body)).toBe(true);
  });

  it('keeps classification array ordering in the native typed-body hash', async () => {
    const command = commands[1]!;
    if (command.operation !== 'SAVE_POLICY') throw new Error('Wrong test command');
    const first = await prepareApprovalRetentionReceiptOriginal(command, 42, 'RS_APPROVALS');
    const second = await prepareApprovalRetentionReceiptOriginal(
      {
        ...command,
        body: {
          ...command.body,
          rules: { ...command.body.rules, allowedClassifications: ['CONFIDENTIAL', 'INTERNAL'] },
        },
      },
      42,
      'RS_APPROVALS'
    );
    expect(second.requestBodySha256).not.toBe(first.requestBodySha256);
    expect(Object.isFrozen(first.command.body)).toBe(true);
  });

  it.each([
    ['operation', 'SAVE_POLICY'],
    ['idempotencyKey', 'new-key'],
    ['actorUserId', 43],
    ['resourceSetKey', 'RS_OTHER'],
    ['originalTargetId', commandId],
    ['originalExpectedVersion', 7],
    ['requestBodySha256', 'a'.repeat(64)],
    ['resultReferenceId', intentId],
    ['resultVersion', 7],
    ['status', 'PENDING'],
    ['status', 'PURGED'],
    ['originAuthorityProfile', 'POLICY_UPDATE_TRUSTED'],
    ['profileVersion', 'SIGNATURE_JCS_V1'],
    ['committedAt', '2026-02-30T12:00:00Z'],
    ['committedAt', '2026-09-14T12:00:00'],
    ['commandId', 'not-a-uuid'],
  ])(
    'cannot confirm a mismatched %s from a current head or unrelated receipt',
    async (field, value) => {
      const original = await prepareApprovalRetentionReceiptOriginal(
        publication(),
        42,
        'RS_APPROVALS'
      );
      expect(() =>
        bindApprovalRetentionReceipt({ ...receipt(original), [field]: value }, original)
      ).toThrow();
    }
  );

  it('rejects missing or extra private metadata instead of inferring success', async () => {
    const original = await prepareApprovalRetentionReceiptOriginal(
      publication(),
      42,
      'RS_APPROVALS'
    );
    const { originalExpectedVersion: omitted, ...partial } = receipt(original);
    expect(omitted).toBe(golden.body.expectedVersion);
    expect(() => bindApprovalRetentionReceipt(partial, original)).toThrow();
    expect(() =>
      bindApprovalRetentionReceipt({ ...receipt(original), sourceAuthority: {} }, original)
    ).toThrow();
    expect(() => bindApprovalRetentionReceipt(receipt(original), { ...original })).toThrow();
  });

  it('treats CLAIM COMMITTED as the original intent only, never execution or erasure', async () => {
    const original = await prepareApprovalRetentionReceiptOriginal(
      commands[3]!,
      42,
      'RS_APPROVALS'
    );
    const result = bindApprovalRetentionReceipt(receipt(original), original);
    expect(result.resultReferenceId).toBe(intentId);
    expect(result.resultVersion).toBe(0);
    expect(result).not.toHaveProperty('executionClaimId');
    expect(() =>
      bindApprovalRetentionReceipt({ ...receipt(original), executionClaimId: intentId }, original)
    ).toThrow();
    expect(() =>
      bindApprovalRetentionReceipt({ ...receipt(original), resultVersion: 1 }, original)
    ).toThrow();
  });

  it.each([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, 1.5, NaN])(
    'rejects an unsafe incrementing policy version %s before hashing',
    async (expectedVersion) => {
      const command = publication();
      if (command.operation !== 'PUBLISH_POLICY') throw new Error('Wrong test command');
      await expect(
        prepareApprovalRetentionReceiptOriginal(
          { ...command, body: { ...command.body, expectedVersion } },
          42,
          'RS_APPROVALS'
        )
      ).rejects.toThrow();
    }
  );

  it.each(['.', '..', 'encoded%3Akey', 'slash/key'])(
    'rejects an unreadable receipt key %s',
    async (key) => {
      const command = publication();
      if (command.operation !== 'PUBLISH_POLICY') throw new Error('Wrong test command');
      await expect(
        prepareApprovalRetentionReceiptOriginal(
          { ...command, body: { ...command.body, idempotencyKey: key } },
          42,
          'RS_APPROVALS'
        )
      ).rejects.toThrow();
    }
  );

  it('rejects actor/scope ambiguity and extra original body fields', async () => {
    await expect(
      prepareApprovalRetentionReceiptOriginal(publication(), 0, 'RS_APPROVALS')
    ).rejects.toThrow();
    await expect(
      prepareApprovalRetentionReceiptOriginal(publication(), 42, 'opaque-other')
    ).rejects.toThrow();
    const command = publication();
    const body = { ...command.body, authority: 'caller-owned' };
    await expect(
      prepareApprovalRetentionReceiptOriginal({ ...command, body }, 42, 'RS_APPROVALS')
    ).rejects.toThrow();
  });

  it.each(['\ud800', '\udc00'])(
    'rejects an unpaired UTF16 surrogate before hashing',
    async (surrogate) => {
      const command = publication();
      await expect(
        prepareApprovalRetentionReceiptOriginal(
          {
            ...command,
            body: { ...command.body, reviewComment: `Independent review ${surrogate}` },
          },
          42,
          'RS_APPROVALS'
        )
      ).rejects.toThrow();
    }
  );
});
