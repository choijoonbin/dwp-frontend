import { describe, expect, it } from 'vitest';
import {
  approvalAttachmentPolicyPublishCommand,
  buildApprovalStepUpIssuerRequest,
  createApprovalHighRiskAttempt,
  productSurfaceHighRiskOperationBinding,
} from './product-surface-high-risk-command-model';

const policyId = '11111111-1111-1111-1111-111111111111';
const input = () => ({
  expectedVersion: 4,
  idempotencyKey: 'original-policy:1',
  reviewComment: 'Independent review',
});
describe('attachment policy independent HIGH command', () => {
  it('uses a separate attachment policy purpose and exact owner URL', () => {
    const command = approvalAttachmentPolicyPublishCommand(policyId, input());
    expect(command).toMatchObject({
      operation: 'ATTACHMENT_POLICY_PUBLISH',
      targetType: 'ATTACHMENT_POLICY',
      commandPath: `/api/approvals/v1/admin/attachments/policies/${policyId}/publish`,
      expectedObjectVersion: 4,
      idempotencyKey: 'original-policy:1',
    });
    expect(productSurfaceHighRiskOperationBinding(command.operation).routeContractKey).toBe(
      'route.approvals.admin.attachment-policy-publish.action'
    );
  });
  it('preserves original private review material and key in the issuer request', () => {
    const value = input();
    const command = approvalAttachmentPolicyPublishCommand(policyId, value);
    value.reviewComment = 'Changed review';
    value.expectedVersion = 5;
    const attempt = createApprovalHighRiskAttempt(command, {
      rolloutState: '111',
      expectedDecisionRevision: 'psr-current',
      contextKey: 'management',
      contextScopeKey: 'opaque-scope',
    });
    expect(Object.isFrozen(command.payload)).toBe(true);
    expect(buildApprovalStepUpIssuerRequest(attempt).request).toMatchObject({
      idempotencyKey: 'original-policy:1',
      expectedObjectVersion: 4,
      payload: input(),
    });
  });
  it('rejects invalid targets, unsafe CAS, empty reviews and extra fields', () => {
    expect(() => approvalAttachmentPolicyPublishCommand('other', input())).toThrow();
    for (const value of [
      { ...input(), expectedVersion: 4.5 },
      { ...input(), reviewComment: '' },
      { ...input(), idempotencyKey: '' },
      { ...input(), extra: true },
    ])
      expect(() => approvalAttachmentPolicyPublishCommand(policyId, value)).toThrow();
  });
});
