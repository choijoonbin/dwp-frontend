import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planningAuthorityFixture } from '@dwp-frontend/shared-utils/test-utils/approval-workflow-planning-fixtures';
import {
  APPROVAL_RETENTION_RECEIPT_PROFILE,
  prepareApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import {
  approvalRetentionQuerySourceReady,
  approvalRetentionReceiptAttemptMatches,
  approvalRetentionReceiptCapability,
  approvalRetentionReceiptCommitsOriginal,
  approvalRetentionReceiptOnlyController,
  clearApprovalRetentionReceiptAttempt,
  preserveApprovalRetentionReceiptAttempt,
} from './approval-retention-receipt-owner';

import type {
  ApprovalRetentionReceiptMetadata,
  ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import type { RetentionReceiptAttempt } from './approval-retention-receipt-owner';

async function original(key: string) {
  return prepareApprovalRetentionReceiptOriginal(
    {
      operation: 'INITIALIZE_POLICY',
      originalTargetId: null,
      body: { expectedAbsent: true, idempotencyKey: key },
    },
    99,
    'RS_APPROVAL_FINANCE'
  );
}

function attempt(value: ApprovalRetentionReceiptOriginal): RetentionReceiptAttempt {
  return {
    original: value,
    binding: { scopeIdentity: 'retention-owner', scopeEpoch: 4 },
    authoritySnapshot: planningAuthorityFixture().source.snapshot!,
    identityFingerprint: 'original-authority-fingerprint',
    source: { kind: 'ABSENT_POLICY' },
  };
}

describe('retention receipt UNKNOWN attempt ownership', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it('maps each receipt to only its original mutation capability', () => {
    expect(approvalRetentionReceiptCapability('INITIALIZE_POLICY')).toBe('approvals.policy.update');
    expect(approvalRetentionReceiptCapability('SAVE_POLICY')).toBe('approvals.policy.update');
    expect(approvalRetentionReceiptCapability('PUBLISH_POLICY')).toBe('approvals.policy.publish');
    expect(approvalRetentionReceiptCapability('CLAIM_RECORD')).toBe('approvals.operations.execute');
  });

  it('preserves one exact private original and rejects a replacement command', async () => {
    const first = attempt(await original('initialize:first'));
    const second = attempt(await original('initialize:second'));
    expect(preserveApprovalRetentionReceiptAttempt(null, first)).toBe(first);
    expect(preserveApprovalRetentionReceiptAttempt(first, first)).toBe(first);
    expect(() => preserveApprovalRetentionReceiptAttempt(first, second)).toThrow(
      'remains uncertain'
    );
  });

  it('clears only the matching committed original object', async () => {
    const firstOriginal = await original('initialize:first');
    const otherOriginal = await original('initialize:other');
    const current = attempt(firstOriginal);
    expect(approvalRetentionReceiptAttemptMatches(current, firstOriginal)).toBe(true);
    expect(clearApprovalRetentionReceiptAttempt(current, otherOriginal)).toBe(current);
    expect(clearApprovalRetentionReceiptAttempt(current, firstOriginal)).toBeNull();
    expect(() => clearApprovalRetentionReceiptAttempt(current, { ...firstOriginal })).toThrow(
      'Invalid approval retention original'
    );
  });

  it('accepts only COMMITTED metadata bound to every original command field', async () => {
    const firstOriginal = await original('initialize:first');
    const committed: ApprovalRetentionReceiptMetadata = {
      commandId: '11111111-1111-4111-8111-111111111111',
      operation: firstOriginal.command.operation,
      idempotencyKey: firstOriginal.command.body.idempotencyKey,
      actorUserId: firstOriginal.actorUserId,
      resourceSetKey: firstOriginal.resourceSetKey,
      originalTargetId: firstOriginal.command.originalTargetId,
      resultReferenceId: '22222222-2222-4222-8222-222222222222',
      requestBodySha256: firstOriginal.requestBodySha256,
      originalExpectedVersion: firstOriginal.originalExpectedVersion,
      resultVersion: 0,
      status: 'COMMITTED',
      committedAt: '2026-09-14T21:00:00+09:00',
      originAuthorityProfile: 'POLICY_UPDATE_TRUSTED',
      profileVersion: APPROVAL_RETENTION_RECEIPT_PROFILE,
    };
    expect(approvalRetentionReceiptCommitsOriginal(committed, firstOriginal)).toBe(true);
    expect(
      approvalRetentionReceiptCommitsOriginal(
        { ...committed, actorUserId: firstOriginal.actorUserId + 1 },
        firstOriginal
      )
    ).toBe(false);
    expect(
      approvalRetentionReceiptCommitsOriginal(
        { ...committed, requestBodySha256: 'f'.repeat(64) },
        firstOriginal
      )
    ).toBe(false);
  });

  it('accepts only an idle successful source with no failure history and the same snapshot', () => {
    const source = { version: 7, digest: 'a'.repeat(64) };
    const identity = (value: typeof source) => JSON.stringify(value);
    const ready = {
      status: 'success',
      fetchStatus: 'idle',
      error: null,
      fetchFailureCount: 0,
      data: source,
    };
    expect(approvalRetentionQuerySourceReady(ready, source, identity)).toBe(true);
    expect(
      approvalRetentionQuerySourceReady({ ...ready, fetchFailureCount: 1 }, source, identity)
    ).toBe(false);
    expect(
      approvalRetentionQuerySourceReady(
        { ...ready, data: { ...source, version: 8 } },
        source,
        identity
      )
    ).toBe(false);
  });

  it('turns the generic HIGH ambiguous retry into a terminal receipt-only state', async () => {
    const confirm = vi.fn(async () => undefined);
    const controller = {
      open: true,
      busy: false,
      attempt: null,
      error: 'command-retry' as const,
      close: vi.fn(),
      confirm,
      continueWithIdentityProvider: vi.fn(),
      selectIdentityProvider: vi.fn(async () => undefined),
    };
    const receiptOnly = approvalRetentionReceiptOnlyController(controller);
    expect(receiptOnly.error).toBe('command-uncertain');
    await receiptOnly.confirm();
    expect(confirm).not.toHaveBeenCalled();
    const rejected = { ...controller, error: 'command-rejected' as const };
    expect(approvalRetentionReceiptOnlyController(rejected)).toBe(rejected);
  });
});
