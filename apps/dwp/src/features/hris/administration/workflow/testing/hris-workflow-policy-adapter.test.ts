import { beforeEach, describe, expect, it, vi } from 'vitest';

const owner = vi.hoisted(() => ({
  list: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/approval-management-api', () => ({
  getApprovalPolicies: owner.list,
}));

vi.mock('@dwp-frontend/shared-utils/api/approval-api', () => ({
  publishApprovalPolicy: owner.publish,
}));

import { hrisWorkflowPolicyDataSource } from '../api/hris-workflow-policy-adapter';

describe('HRIS workflow policy Approval adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reuses only the shared policy list client with the installed scope and abort signal', async () => {
    const signal = new AbortController().signal;
    owner.list.mockResolvedValue([]);

    await hrisWorkflowPolicyDataSource.list('approval-scope-42', signal);

    expect(owner.list).toHaveBeenCalledWith('approval-scope-42', signal);
  });

  it('preserves policy version, review comment, idempotency and owner execution', async () => {
    const execution = {
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: 'decision-7',
      contextKey: 'approval-admin',
      contextScopeKey: 'approval-scope-42',
      objectVersion: 7,
      idempotencyKey: 'publish-policy-7',
      stepUp: {
        challenge: 'challenge-proof',
        challengeId: 'challenge-7',
        decisionRevision: 'decision-7',
        expiresAt: '2026-10-18T00:00:00Z',
      },
    } as const;
    owner.publish.mockResolvedValue([]);

    await hrisWorkflowPolicyDataSource.publish(
      'policy-7',
      { expectedVersion: 7, reviewComment: 'Independent review complete' },
      execution
    );

    expect(owner.publish).toHaveBeenCalledWith(
      'policy-7',
      { expectedVersion: 7, reviewComment: 'Independent review complete' },
      execution
    );
  });
});
