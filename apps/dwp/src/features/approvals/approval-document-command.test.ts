import { describe, expect, it } from 'vitest';
import {
  buildApprovalStepUpIssuerRequest,
  createApprovalHighRiskAttempt,
  restartApprovalHighRiskAttempt,
} from './approval-high-risk-command-model';
import {
  approvalDocumentHoldPublishCommand,
  approvalDocumentPolicyPublishCommand,
} from './approval-document-command';
import { buildApprovalHighRiskActionEvaluationRequest } from './use-approval-high-risk-command';

const id = '00000000-0000-0000-0000-000000000001';
const proposalId = '00000000-0000-0000-0000-000000000002';
const authority = {
  rolloutState: '111',
  expectedDecisionRevision: 'current-revision',
  contextKey: 'approvals-admin',
  contextScopeKey: 'RS_APPROVALS',
} as const;
describe('document publication exact HIGH descriptor', () => {
  it.each(['POLICY', 'HOLD'] as const)(
    'binds %s without borrowing old policy action authority',
    (type) => {
      const descriptor =
        type === 'POLICY'
          ? approvalDocumentPolicyPublishCommand(id, 0, 'Independent review', 'publish:original')
          : approvalDocumentHoldPublishCommand(
              id,
              0,
              proposalId,
              'Independent review',
              'publish:original'
            );
      const action = buildApprovalHighRiskActionEvaluationRequest(descriptor.operation, authority);
      expect(action.routeContractKey).toBe(
        `route.approvals.admin.document-${type.toLowerCase()}-publish.action`
      );
      const attempt = createApprovalHighRiskAttempt(descriptor, authority);
      const issuer = buildApprovalStepUpIssuerRequest(attempt);
      expect(JSON.stringify(issuer)).toContain(`DOCUMENT_${type}`);
      expect(JSON.stringify(issuer)).toContain(descriptor.commandPath);
      if (type === 'POLICY') {
        expect(descriptor.commandPath).toBe(
          `/api/approvals/v1/admin/document-tools/policies/${id}/publish`
        );
        expect(descriptor.payload).not.toHaveProperty('policyId');
      }
      expect(JSON.stringify(issuer)).toContain('publish:original');
      const restarted = restartApprovalHighRiskAttempt(attempt, authority, 'publish:new');
      expect(restarted.descriptor.payload.idempotencyKey).toBe('publish:new');
      expect(restarted.descriptor.payload).not.toHaveProperty('command');
      expect(attempt.descriptor.payload.idempotencyKey).toBe('publish:original');
      if (type === 'HOLD') expect(restarted.descriptor.payload.proposalId).toBe(proposalId);
    }
  );
  it('rejects substituted path targets, proposal IDs, short reasons and invalid versions', () => {
    expect(() =>
      approvalDocumentPolicyPublishCommand('../policies', 0, 'Independent review', 'key')
    ).toThrow();
    expect(() =>
      approvalDocumentPolicyPublishCommand(id, -1, 'Independent review', 'key')
    ).toThrow();
    expect(() => approvalDocumentPolicyPublishCommand(id, 0, 'short', 'key')).toThrow();
    expect(() =>
      approvalDocumentHoldPublishCommand(id, 0, '../holds', 'Independent review', 'key')
    ).toThrow();
  });
});
