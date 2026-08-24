import { describe, expect, it } from 'vitest';

import {
  applyApprovalStepUpChallenge,
  applyApprovalStepUpContinuation,
  approvalDeliveryRetryCommand,
  approvalPolicyPublishCommand,
  approvalWorkflowPublishCommand,
  beginApprovalHighRiskCommandExecution,
  buildApprovalHighRiskMutationContext,
  buildApprovalStepUpIssuerRequest,
  createApprovalHighRiskAttempt,
  restartApprovalHighRiskAttempt,
  resolveApprovalHighRiskActionAuthority,
  selectApprovalStepUpProvider,
  serializeApprovalHighRiskAttempt,
  transitionApprovalHighRiskAttempt,
} from './approval-high-risk-command-model';

describe('approval HIGH command model', () => {
  it('uses legacy direct calls only for rollout 000/100 and fails closed without enforced authority', () => {
    expect(
      resolveApprovalHighRiskActionAuthority({
        rolloutState: '100',
        evaluation: null,
        contextKey: undefined,
        contextScopeKey: undefined,
      })
    ).toEqual({ mode: 'legacy' });
    expect(
      resolveApprovalHighRiskActionAuthority({
        rolloutState: '110',
        evaluation: null,
        contextKey: 'approval-management',
        contextScopeKey: 'scope-1',
      })
    ).toEqual({ mode: 'unavailable' });
  });

  it('uses the exact action direct-evaluation revision for both enforced rollout states', () => {
    expect(
      resolveApprovalHighRiskActionAuthority({
        rolloutState: '110',
        evaluation: { decision: 'STEP_UP_REQUIRED', decisionRevision: 'action-revision-110' },
        contextKey: 'approval-management',
        contextScopeKey: 'scope-1',
      })
    ).toMatchObject({
      mode: 'secure',
      directDecision: 'STEP_UP_REQUIRED',
      authority: { expectedDecisionRevision: 'action-revision-110' },
    });
    expect(
      resolveApprovalHighRiskActionAuthority({
        rolloutState: '111',
        evaluation: { decision: 'ALLOWED', decisionRevision: 'action-revision-111' },
        contextKey: 'approval-management',
        contextScopeKey: 'scope-1',
      })
    ).toMatchObject({
      mode: 'secure',
      directDecision: 'ALLOWED',
      authority: { expectedDecisionRevision: 'action-revision-111' },
    });
  });

  it('does not infer HIGH access from a denied direct result or missing direct revision/scope', () => {
    expect(
      resolveApprovalHighRiskActionAuthority({
        rolloutState: '111',
        evaluation: { decision: 'ROUTE_DENIED', decisionRevision: 'revision-1' },
        contextKey: 'approval-management',
        contextScopeKey: 'scope-1',
      })
    ).toEqual({ mode: 'unavailable' });
    expect(
      resolveApprovalHighRiskActionAuthority({
        rolloutState: '111',
        evaluation: { decision: 'STEP_UP_REQUIRED' },
        contextKey: 'approval-management',
        contextScopeKey: undefined,
      })
    ).toEqual({ mode: 'unavailable' });
  });

  it('rotates the idempotency key for a new proof attempt while preserving its command', () => {
    const authority = {
      rolloutState: '111' as const,
      expectedDecisionRevision: 'user-visible-revision',
      contextKey: 'approval-management',
      contextScopeKey: 'scope-1',
    };
    const command = approvalPolicyPublishCommand('policy-1', 4, 'Independent review complete');
    const initial = createApprovalHighRiskAttempt(command, authority, 'stable-attempt-key');
    const restarted = restartApprovalHighRiskAttempt(
      initial,
      {
        ...authority,
        expectedDecisionRevision: 'refreshed-action-revision',
      },
      'rotated-attempt-key'
    );
    expect(restarted.idempotencyKey).toBe('rotated-attempt-key');
    expect(restarted.descriptor).toEqual(initial.descriptor);
    expect(restarted.authority.expectedDecisionRevision).toBe('refreshed-action-revision');
    expect(restarted.phase).toBe('CONFIRM_ISSUER');
    expect(restarted.commandAttemptCount).toBe(0);
    expect(restarted).not.toHaveProperty('stepUp');
    expect(restarted).not.toHaveProperty('continuation');
    expect(restarted).not.toHaveProperty('providerKey');
    expect(() => restartApprovalHighRiskAttempt(initial, authority, 'stable-attempt-key')).toThrow(
      /rotate/
    );
    const issuerRequest = buildApprovalStepUpIssuerRequest(
      initial,
      '/approvals/admin/policies?scope=scope-1'
    );
    expect(issuerRequest.request).not.toHaveProperty('routeContractKey');
    expect(issuerRequest.request).not.toHaveProperty('capabilityContractKey');
    expect(issuerRequest.request).not.toHaveProperty('expectedDecisionRevision');
    expect(issuerRequest.request).toMatchObject({
      contextKey: 'approval-management',
      contextScopeKey: 'scope-1',
    });
    expect(issuerRequest.expectedDecisionRevision).toBe('user-visible-revision');
    const resumed = transitionApprovalHighRiskAttempt(
      applyApprovalStepUpContinuation(initial, {
        state: 'CONTINUATION_REQUIRED',
        continuation: {
          type: 'OIDC',
          authorizationUrl: 'https://identity.example.test/authorize?state=opaque',
          expiresAt: '2026-08-24T01:05:00Z',
          flowRef: '8f879f98-2476-4c33-a228-2984567ab889',
        },
      }),
      'RESUME_REQUIRED'
    );
    expect(buildApprovalStepUpIssuerRequest(resumed).request.idempotencyKey).toBe(
      'stable-attempt-key'
    );
    expect(buildApprovalStepUpIssuerRequest(resumed).request.payload).toEqual(command.payload);

    const issued = applyApprovalStepUpChallenge(
      resumed,
      {
        state: 'ISSUED',
        challenge: 'signed-challenge',
        challengeId: 'challenge-1',
        decisionRevision: 'user-visible-revision',
        expiresAt: '2026-08-24T01:05:00Z',
      },
      Date.parse('2026-08-24T01:00:00Z')
    );
    const firstExecution = beginApprovalHighRiskCommandExecution(
      issued,
      Date.parse('2026-08-24T01:01:00Z')
    );
    const retry = beginApprovalHighRiskCommandExecution(
      transitionApprovalHighRiskAttempt(firstExecution, 'COMMAND_RETRY'),
      Date.parse('2026-08-24T01:02:00Z')
    );
    const mutation = buildApprovalHighRiskMutationContext(retry);
    expect(mutation).toMatchObject({
      expectedDecisionRevision: 'user-visible-revision',
      objectVersion: 4,
      idempotencyKey: 'stable-attempt-key',
      stepUp: { challenge: 'signed-challenge', decisionRevision: 'user-visible-revision' },
    });
    expect(retry.commandAttemptCount).toBe(2);
    expect(() =>
      beginApprovalHighRiskCommandExecution(retry, Date.parse('2026-08-24T01:03:00Z'))
    ).toThrowError('The HIGH command cannot be retried again.');
  });

  it('requires explicit selection from the server-provided OIDC provider allowlist', () => {
    const initial = createApprovalHighRiskAttempt(
      approvalWorkflowPublishCommand('workflow-1', 7),
      {
        rolloutState: '111',
        expectedDecisionRevision: 'revision-1',
        contextKey: 'context-1',
        contextScopeKey: 'scope-1',
      },
      'attempt-1'
    );
    const selection = applyApprovalStepUpContinuation(initial, {
      state: 'CONTINUATION_REQUIRED',
      continuation: {
        type: 'OIDC_PROVIDER_SELECTION',
        authorizationUrl: null,
        expiresAt: null,
        providerKeys: ['workforce-sso', 'secure-idp'],
      },
    });
    expect(() => selectApprovalStepUpProvider(selection, 'unknown')).toThrowError(
      'The selected step-up provider is unavailable.'
    );
    const selected = selectApprovalStepUpProvider(selection, 'secure-idp');
    expect(buildApprovalStepUpIssuerRequest(selected).request.providerKey).toBe('secure-idp');
    expect(buildApprovalStepUpIssuerRequest(selected).request.idempotencyKey).toBe('attempt-1');
  });

  it('never serializes payload, authority, idempotency key or bearer challenge', () => {
    const attempt = createApprovalHighRiskAttempt(
      approvalWorkflowPublishCommand('workflow-1', 7),
      {
        rolloutState: '111',
        expectedDecisionRevision: 'revision-1',
        contextKey: 'context-1',
        contextScopeKey: 'scope-1',
      },
      'attempt-1'
    );
    const serialized = serializeApprovalHighRiskAttempt(attempt);
    expect(serialized).toBe(
      '{"schemaVersion":1,"operation":"WORKFLOW_PUBLISH","phase":"CONFIRM_ISSUER","storagePolicy":"IN_MEMORY_ONLY"}'
    );
    expect(serialized).not.toContain('attempt-1');
    expect(serialized).not.toContain('workflow-1');
    expect(serialized).not.toContain('revision-1');
  });

  it('rejects a challenge with a tampered revision or an expired server timestamp', () => {
    const attempt = createApprovalHighRiskAttempt(
      approvalWorkflowPublishCommand('workflow-1', 7),
      {
        rolloutState: '111',
        expectedDecisionRevision: 'revision-1',
        contextKey: 'context-1',
        contextScopeKey: 'scope-1',
      },
      'attempt-1'
    );
    const challenge = {
      state: 'ISSUED' as const,
      challenge: 'signed-challenge',
      challengeId: 'challenge-1',
      decisionRevision: 'revision-1',
      expiresAt: '2026-08-24T01:05:00Z',
    };
    expect(() =>
      applyApprovalStepUpChallenge(
        attempt,
        { ...challenge, decisionRevision: 'tampered-revision' },
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toThrowError('The issuer decision revision does not match the user-observed revision.');
    expect(() =>
      applyApprovalStepUpChallenge(attempt, challenge, Date.parse('2026-08-24T01:05:00Z'))
    ).toThrowError('The server-issued step-up challenge is expired.');
    const issued = applyApprovalStepUpChallenge(
      attempt,
      challenge,
      Date.parse('2026-08-24T01:00:00Z')
    );
    expect(() =>
      beginApprovalHighRiskCommandExecution(issued, Date.parse('2026-08-24T01:05:00Z'))
    ).toThrowError('The HIGH command cannot be retried again.');
  });

  it('binds retry object version only as command metadata and uses the canonical empty payload', () => {
    const command = approvalDeliveryRetryCommand('outbox-1', 2);
    expect(command).toEqual({
      operation: 'DELIVERY_RETRY',
      commandMethod: 'POST',
      commandPath: '/api/approvals/v1/admin/operations/events/outbox-1/retry',
      targetType: 'OUTBOX_EVENT',
      targetId: 'outbox-1',
      expectedObjectVersion: 2,
      payload: {},
    });

    const issuer = buildApprovalStepUpIssuerRequest(
      createApprovalHighRiskAttempt(
        command,
        {
          rolloutState: '110',
          expectedDecisionRevision: 'retry-revision',
          contextKey: 'approvals-management',
          contextScopeKey: 'scope-1',
        },
        'retry-attempt-1'
      )
    );
    expect(issuer.request).toEqual({
      commandMethod: 'POST',
      commandPath: '/api/approvals/v1/admin/operations/events/outbox-1/retry',
      targetType: 'OUTBOX_EVENT',
      targetId: 'outbox-1',
      expectedObjectVersion: 2,
      idempotencyKey: 'retry-attempt-1',
      payload: {},
      contextKey: 'approvals-management',
      contextScopeKey: 'scope-1',
    });
    expect(issuer.request.payload).not.toHaveProperty('expectedVersion');
    expect(issuer.expectedDecisionRevision).toBe('retry-revision');
  });
});
