import { describe, expect, it } from 'vitest';
import {
  approvalFormPublishCommand,
  approvalFormReviewedPublishCommand,
  buildApprovalStepUpIssuerRequest,
  createApprovalHighRiskAttempt,
  productSurfaceHighRiskOperationBinding,
} from './product-surface-high-risk-command-model';

const formId = '10000000-0000-0000-0000-000000000001';
const input = () => ({
  expectedFormRevision: 7,
  expectedWorkspaceRevision: 3,
  draftFormVersionId: '20000000-0000-0000-0000-000000000002',
  basePublishedVersionId: '30000000-0000-0000-0000-000000000003',
  schemaSha256: 'a'.repeat(64),
  reviewContentDigest: 'b'.repeat(64),
  reviewRequestId: '40000000-0000-4000-8000-000000000004',
  expectedReviewRequestVersion: 0,
  reviewComment: 'Independent publisher verified the exact review evidence.',
});

describe('reviewed form publication command', () => {
  it('has a separate exact operation, action route and endpoint from legacy publication', () => {
    const command = approvalFormReviewedPublishCommand(formId, input(), 'original-key');
    expect(command).toMatchObject({
      operation: 'FORM_REVIEWED_PUBLISH',
      commandMethod: 'POST',
      commandPath: `/api/approvals/v1/admin/forms/${formId}/publish-reviewed`,
      targetType: 'FORM',
      targetId: formId,
      expectedObjectVersion: 7,
      idempotencyKey: 'original-key',
    });
    expect(productSurfaceHighRiskOperationBinding(command.operation)).toEqual({
      routeContractKey: 'route.approvals.admin.form-reviewed-publish.action',
      target: { productKey: 'approvals', surfaceKey: 'approvals.admin' },
    });
    expect(approvalFormPublishCommand(formId, 7).commandPath).not.toBe(command.commandPath);
  });

  it('captures private review material and preserves its original key through the issuer request', () => {
    const original = input();
    const command = approvalFormReviewedPublishCommand(formId, original, 'original-key');
    original.reviewContentDigest = 'c'.repeat(64);
    original.expectedFormRevision = 8;
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.payload)).toBe(true);
    const attempt = createApprovalHighRiskAttempt(command, {
      rolloutState: '111',
      expectedDecisionRevision: `psr-${'d'.repeat(64)}`,
      contextKey: 'approval-management',
      contextScopeKey: 'opaque-scope',
    });
    const issuer = buildApprovalStepUpIssuerRequest(attempt);
    expect(issuer.request.idempotencyKey).toBe('original-key');
    expect(issuer.request).toMatchObject({
      commandPath: command.commandPath,
      expectedObjectVersion: 7,
      payload: { ...input(), reviewContentDigest: 'b'.repeat(64) },
    });
  });

  it('rejects missing review material, unsafe revisions and noncanonical targets before creating an attempt', () => {
    for (const invalid of [
      { ...input(), expectedWorkspaceRevision: -1 },
      { ...input(), expectedFormRevision: Number.MAX_SAFE_INTEGER + 1 },
      { ...input(), reviewContentDigest: '' },
      { ...input(), schemaSha256: 'A'.repeat(64) },
      { ...input(), draftFormVersionId: 'other' },
      { ...input(), reviewRequestId: 'other' },
      { ...input(), expectedReviewRequestVersion: -1 },
      { ...input(), reviewComment: 'short' },
      { ...input(), reviewComment: ' padded independent review ' },
    ]) {
      expect(() => approvalFormReviewedPublishCommand(formId, invalid, 'original-key')).toThrow();
    }
    expect(() => approvalFormReviewedPublishCommand(formId, input(), ' ')).toThrow();
    expect(() => approvalFormReviewedPublishCommand('other', input(), 'original-key')).toThrow();
  });
});
