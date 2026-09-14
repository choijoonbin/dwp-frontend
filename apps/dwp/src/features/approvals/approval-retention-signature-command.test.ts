import { describe, expect, it } from 'vitest';
import { PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG } from '../../components/product-surface-high-risk-command-catalog';
import {
  approvalRetentionPolicyPublishCommand,
  approvalRetentionRecordClaimCommand,
} from './approval-retention-command';
import { approvalSignatureSignCommand } from './approval-signature-command';

const requestId = '00000000-0000-4000-8000-000000000001';
const policyId = '00000000-0000-4000-8000-000000000002';
const signatureId = '00000000-0000-4000-8000-000000000003';
const consentId = '00000000-0000-4000-8000-000000000004';
const inventory = 'a'.repeat(64);
const claim = {
  expectedVersion: 2,
  policyId,
  expectedPolicyVersion: 3,
  expectedHoldVersion: 4,
  inventorySha256: inventory,
  idempotencyKey: 'retention-claim-1',
};
const sign = {
  expectedVersion: 5,
  sourceDigest: 'b'.repeat(64),
  consentReceiptId: consentId,
  idempotencyKey: 'signature-sign-1',
};

describe('retention and signature exact HIGH command descriptors', () => {
  it('binds publication to the retention policy rather than an approval or document policy', () => {
    const command = approvalRetentionPolicyPublishCommand(
      policyId,
      3,
      'Independent policy review accepted.',
      'publish-retention-1'
    );
    expect(command).toMatchObject({
      operation: 'RETENTION_POLICY_PUBLISH',
      commandMethod: 'POST',
      targetType: 'RETENTION_POLICY',
      targetId: policyId,
      expectedObjectVersion: 3,
      commandPath: `/api/approvals/v1/admin/retention/policies/${policyId}/publish`,
      idempotencyKey: 'publish-retention-1',
      idempotencyPayloadPath: 'ROOT',
    });
    expect(command.payload).toEqual({
      expectedVersion: 3,
      idempotencyKey: 'publish-retention-1',
      reviewComment: 'Independent policy review accepted.',
    });
  });
  it('freezes the full inventory, hold, policy and record versions without borrowing an execution claim ID', () => {
    const mutable = { ...claim, injected: 'discard' };
    const command = approvalRetentionRecordClaimCommand(requestId, mutable);
    mutable.expectedHoldVersion = 999;
    mutable.inventorySha256 = 'c'.repeat(64);
    expect(command).toMatchObject({
      operation: 'RETENTION_RECORD_CLAIM',
      targetType: 'RETENTION_RECORD',
      targetId: requestId,
      commandPath: `/api/approvals/v1/admin/retention/records/${requestId}/claims`,
      expectedObjectVersion: 2,
    });
    expect(command.payload).toEqual(claim);
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.payload)).toBe(true);
  });
  it('binds signature to its ceremony and captures only the original four native body fields', () => {
    const mutable = { ...sign, injected: 'discard' };
    const command = approvalSignatureSignCommand(signatureId, mutable);
    mutable.expectedVersion = 99;
    expect(command).toMatchObject({
      operation: 'SIGNATURE_SIGN',
      commandMethod: 'POST',
      targetType: 'APPROVAL_SIGNATURE_REQUEST',
      targetId: signatureId,
      commandPath: `/api/approvals/v1/signature-requests/${signatureId}/sign`,
      expectedObjectVersion: 5,
      idempotencyKey: sign.idempotencyKey,
      idempotencyPayloadPath: 'ROOT',
    });
    expect(command.payload).toEqual(sign);
    expect(Object.isFrozen(command.payload)).toBe(true);
  });
  it.each([
    ['RETENTION_POLICY_PUBLISH', 'approvals.admin', 'retention-policy-publish'],
    ['RETENTION_RECORD_CLAIM', 'approvals.admin', 'retention-record-claim'],
    ['SIGNATURE_SIGN', 'approvals.work', 'signature-sign'],
  ])('installs exactly one catalog binding for %s', (operation, surfaceKey, route) => {
    expect(
      PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG.filter((entry) => entry.operation === operation)
    ).toEqual([
      {
        operation,
        productKey: 'approvals',
        surfaceKey,
        routeContractKey: `route.${surfaceKey}.${route}.action`,
      },
    ]);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects noncanonical version %s',
    (expectedVersion) => {
      expect(() =>
        approvalRetentionRecordClaimCommand(requestId, { ...claim, expectedVersion })
      ).toThrow();
      expect(() =>
        approvalSignatureSignCommand(signatureId, { ...sign, expectedVersion })
      ).toThrow();
      expect(() =>
        approvalRetentionPolicyPublishCommand(
          policyId,
          expectedVersion,
          'Independent review.',
          'key'
        )
      ).toThrow();
    }
  );
  it.each(['../escape', 'ABCDEFAB-0000-4000-8000-000000000003', '', `${signatureId}?alias=1`])(
    'rejects path aliases %s',
    (id) => {
      expect(() => approvalSignatureSignCommand(id, sign)).toThrow();
      expect(() => approvalRetentionRecordClaimCommand(id, claim)).toThrow();
    }
  );
  it.each(['short', 'a'.repeat(1001), 'review\0not-accepted'])(
    'rejects an invalid checker reason',
    (reason) => {
      expect(() => approvalRetentionPolicyPublishCommand(policyId, 1, reason, 'key')).toThrow();
    }
  );
  it('rejects malformed or changed inventory, hold and consent pins', () => {
    expect(() =>
      approvalRetentionRecordClaimCommand(requestId, { ...claim, expectedPolicyVersion: -1 })
    ).toThrow();
    expect(() =>
      approvalRetentionRecordClaimCommand(requestId, { ...claim, expectedHoldVersion: -1 })
    ).toThrow();
    expect(() =>
      approvalRetentionRecordClaimCommand(requestId, { ...claim, inventorySha256: 'a'.repeat(63) })
    ).toThrow();
    expect(() =>
      approvalSignatureSignCommand(signatureId, { ...sign, consentReceiptId: 'wrong' })
    ).toThrow();
    expect(() =>
      approvalSignatureSignCommand(signatureId, { ...sign, sourceDigest: 'A'.repeat(64) })
    ).toThrow();
    expect(() =>
      approvalSignatureSignCommand(signatureId, { ...sign, idempotencyKey: 'key/escape' })
    ).toThrow();
  });
});
