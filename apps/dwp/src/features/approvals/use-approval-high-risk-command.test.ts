import { describe, expect, it, vi } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  ApprovalHighRiskDispatchContextChangedError,
  assertApprovalHighRiskAttemptBinding,
  assertApprovalHighRiskOperationBindingCurrent,
  classifyApprovalHighRiskCommandFailure,
  resolveApprovalHighRiskEntryBinding,
  runApprovalHighRiskBoundDispatch,
  runApprovalHighRiskResumeSingleFlight,
} from './use-approval-high-risk-command';
import {
  applyApprovalStepUpChallenge,
  approvalWorkflowPublishCommand,
  beginApprovalHighRiskCommandExecution,
  buildApprovalHighRiskMutationContext,
  createApprovalHighRiskAttempt,
  transitionApprovalHighRiskAttempt,
} from './approval-high-risk-command-model';
import { ProductSurfaceOperationCoordinator } from '../../components/product-surface-operation-coordinator';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils';

function snapshot(): ProductSurfaceAuthoritySnapshot {
  return {
    receivedAtMs: Date.parse('2026-08-24T00:59:50Z'),
    clockOffsetMs: 10_000,
    earliestRevalidateAtMs: Date.parse('2026-08-24T01:05:00Z'),
    envelope: {
      contractVersion: '1',
      decisionRevision: 'snapshot-revision',
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-08-24T01:00:00Z',
      rollouts: [],
      contexts: [
        {
          contextKey: 'approvals-management',
          productKey: 'approvals',
          surfaceKey: 'approvals.admin',
          plane: 'management',
          accessMode: 'NORMAL',
          accessSource: 'MANAGEMENT',
          appResourceKey: 'APP.APPROVALS',
          effectiveGrants: [],
          scopes: [
            {
              key: 'scope-1',
              kind: 'RESOURCE_SET',
              displayName: 'Approvals',
              isDefault: true,
              readOnly: false,
            },
          ],
          revalidateAt: '2026-08-24T01:05:00Z',
        },
      ],
    },
  };
}

describe('approval HIGH command controller invariants', () => {
  it('binds the full attempt and final dispatch window to one live authority identity', () => {
    const target = { productKey: 'approvals', surfaceKey: 'approvals.admin' } as const;
    const identity = {
      ...target,
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      accessMode: 'NORMAL',
      contextKey: 'approvals-management',
      contextScopeKey: 'scope-1',
      decisionRevision: 'revision-1',
    } as const;
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const binding = {
      identity,
      ticket: coordinator.beginOperation(target),
      actionDecisionRevision: { current: 'revision-1' },
    };
    const attempt = createApprovalHighRiskAttempt(
      approvalWorkflowPublishCommand('workflow-1', 7),
      {
        rolloutState: '111',
        expectedDecisionRevision: 'revision-1',
        contextKey: 'approvals-management',
        contextScopeKey: 'scope-1',
      },
      'attempt-1'
    );

    expect(() => assertApprovalHighRiskAttemptBinding(attempt, binding)).not.toThrow();
    expect(() => assertApprovalHighRiskOperationBindingCurrent(binding, identity)).not.toThrow();

    binding.ticket.markDispatched();
    expect(coordinator.beginScopeTransition(target, 'scope-2')).toMatchObject({
      state: 'BLOCKED',
    });
    binding.ticket.finish();
    expect(coordinator.beginScopeTransition(target, 'scope-2')).toMatchObject({ state: 'READY' });
  });

  it('rejects a HIGH issuer or retry after scope, revision, or live identity drift', () => {
    const target = { productKey: 'approvals', surfaceKey: 'approvals.admin' } as const;
    const identity = {
      ...target,
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      accessMode: 'NORMAL',
      contextKey: 'approvals-management',
      contextScopeKey: 'scope-1',
      decisionRevision: 'revision-1',
    } as const;
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const binding = {
      identity,
      ticket: coordinator.beginOperation(target),
      actionDecisionRevision: { current: 'revision-1' },
    };
    const wrongScopeAttempt = createApprovalHighRiskAttempt(
      approvalWorkflowPublishCommand('workflow-1', 7),
      {
        rolloutState: '111',
        expectedDecisionRevision: 'revision-1',
        contextKey: 'approvals-management',
        contextScopeKey: 'scope-2',
      },
      'attempt-2'
    );

    expect(() => assertApprovalHighRiskAttemptBinding(wrongScopeAttempt, binding)).toThrow();

    coordinator.observeIdentity({
      ...identity,
      contextScopeKey: 'scope-2',
      decisionRevision: 'revision-2',
    });
    expect(() =>
      assertApprovalHighRiskOperationBindingCurrent(binding, {
        ...identity,
        contextScopeKey: 'scope-2',
        decisionRevision: 'revision-2',
      })
    ).toThrow();
  });

  it('treats a successful DISPATCHED response as authoritative after concurrent revision advance', async () => {
    const target = { productKey: 'approvals', surfaceKey: 'approvals.admin' } as const;
    const identity = {
      ...target,
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      accessMode: 'NORMAL',
      contextKey: 'approvals-management',
      contextScopeKey: 'scope-1',
      decisionRevision: 'revision-1',
    } as const;
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const binding = {
      identity,
      ticket: coordinator.beginOperation(target),
      actionDecisionRevision: { current: 'revision-1' },
    };

    await expect(
      runApprovalHighRiskBoundDispatch(binding, async () => {
        coordinator.observeIdentity({ ...identity, decisionRevision: 'revision-2' });
        return { committed: true };
      })
    ).resolves.toEqual({ committed: true });

    expect(coordinator.beginScopeTransition(target, 'scope-2')).toMatchObject({ state: 'READY' });
  });

  it('keeps a failed dispatch with concurrent authority drift explicit as command uncertainty', async () => {
    const target = { productKey: 'approvals', surfaceKey: 'approvals.admin' } as const;
    const identity = {
      ...target,
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      accessMode: 'NORMAL',
      contextKey: 'approvals-management',
      contextScopeKey: 'scope-1',
      decisionRevision: 'revision-1',
    } as const;
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const binding = {
      identity,
      ticket: coordinator.beginOperation(target),
      actionDecisionRevision: { current: 'revision-1' },
    };

    await expect(
      runApprovalHighRiskBoundDispatch(binding, async () => {
        coordinator.observeIdentity({ ...identity, decisionRevision: 'revision-2' });
        throw new HttpTransportError('NETWORK');
      })
    ).rejects.toBeInstanceOf(ApprovalHighRiskDispatchContextChangedError);
  });

  it('requires explicit mutation scope selection when more than one scope is writable', () => {
    const authority = snapshot();
    authority.envelope.contexts[0]!.scopes.push({
      key: 'scope-2',
      kind: 'RESOURCE_SET',
      displayName: 'Approvals 2',
      isDefault: false,
      readOnly: false,
    });

    expect(
      resolveApprovalHighRiskEntryBinding(authority, undefined, Date.parse('2026-08-24T00:59:50Z'))
    ).toBeNull();
    expect(
      resolveApprovalHighRiskEntryBinding(authority, 'scope-2', Date.parse('2026-08-24T00:59:50Z'))
    ).toEqual({ contextKey: 'approvals-management', contextScopeKey: 'scope-2' });
  });

  it('retries only ambiguous network outcomes and separates typed server failures', () => {
    expect(classifyApprovalHighRiskCommandFailure(new HttpTransportError('NETWORK'))).toBe(
      'AMBIGUOUS_RETRY'
    );
    expect(classifyApprovalHighRiskCommandFailure(new Error('local programming error'))).toBe(
      'DETERMINISTIC_REJECT'
    );
    expect(classifyApprovalHighRiskCommandFailure(new TypeError('invalid local input'))).toBe(
      'DETERMINISTIC_REJECT'
    );
    expect(classifyApprovalHighRiskCommandFailure(new HttpError('timeout', 408))).toBe(
      'AMBIGUOUS_RETRY'
    );
    expect(classifyApprovalHighRiskCommandFailure(new HttpError('gateway', 503))).toBe(
      'AMBIGUOUS_RETRY'
    );
    expect(
      classifyApprovalHighRiskCommandFailure(
        new HttpError('expired', 403, { errorCode: 'STEP_UP_CHALLENGE_EXPIRED' })
      )
    ).toBe('REISSUE_PROOF');
    expect(
      classifyApprovalHighRiskCommandFailure(
        new HttpError('replay', 409, { errorCode: 'IDEMPOTENCY_REPLAY_SUCCESS' })
      )
    ).toBe('REPLAY_SUCCESS');
    expect(
      classifyApprovalHighRiskCommandFailure(
        new HttpError('challenge replay', 409, { errorCode: 'STEP_UP_CHALLENGE_REPLAY' })
      )
    ).toBe('REPLAY_UNCERTAIN');
    expect(
      classifyApprovalHighRiskCommandFailure(
        new HttpError('revision', 409, { errorCode: 'DECISION_REVISION_CONFLICT' })
      )
    ).toBe('AUTHORITY_CONFLICT');
    expect(classifyApprovalHighRiskCommandFailure(new HttpError('validation', 422))).toBe(
      'DETERMINISTIC_REJECT'
    );
    expect(classifyApprovalHighRiskCommandFailure(new HttpError('forbidden', 403))).toBe(
      'DETERMINISTIC_REJECT'
    );
  });

  it('ends an ambiguous first dispatch followed by challenge replay as command uncertainty', () => {
    const authority = {
      rolloutState: '111',
      expectedDecisionRevision: 'revision-1',
      contextKey: 'approvals-management',
      contextScopeKey: 'scope-1',
    } as const;
    const issued = applyApprovalStepUpChallenge(
      createApprovalHighRiskAttempt(
        approvalWorkflowPublishCommand('workflow-1', 7),
        authority,
        'attempt-1'
      ),
      {
        state: 'ISSUED',
        challenge: 'signed-proof',
        challengeId: 'challenge-1',
        decisionRevision: 'revision-1',
        expiresAt: '2026-08-24T01:05:00Z',
      },
      Date.parse('2026-08-24T01:00:00Z')
    );
    const firstDispatch = beginApprovalHighRiskCommandExecution(
      issued,
      Date.parse('2026-08-24T01:00:01Z')
    );

    expect(classifyApprovalHighRiskCommandFailure(new HttpTransportError('NETWORK'))).toBe(
      'AMBIGUOUS_RETRY'
    );

    const secondDispatch = beginApprovalHighRiskCommandExecution(
      transitionApprovalHighRiskAttempt(firstDispatch, 'COMMAND_RETRY'),
      Date.parse('2026-08-24T01:00:02Z')
    );
    expect(secondDispatch.commandAttemptCount).toBe(2);
    expect(buildApprovalHighRiskMutationContext(secondDispatch)).toMatchObject({
      idempotencyKey: 'attempt-1',
      stepUp: { challengeId: 'challenge-1', challenge: 'signed-proof' },
    });
    expect(
      classifyApprovalHighRiskCommandFailure(
        new HttpError('challenge replay', 409, { errorCode: 'STEP_UP_CHALLENGE_REPLAY' })
      )
    ).toBe('REPLAY_UNCERTAIN');
  });

  it('always releases popup resume single-flight after success or issuer failure', async () => {
    const flag = { current: false };
    const failing = vi.fn(async () => {
      throw new Error('issuer failed');
    });
    await expect(runApprovalHighRiskResumeSingleFlight(flag, failing)).rejects.toThrow(
      'issuer failed'
    );
    expect(flag.current).toBe(false);

    const succeeding = vi.fn(async () => undefined);
    await expect(runApprovalHighRiskResumeSingleFlight(flag, succeeding)).resolves.toBe(true);
    expect(flag.current).toBe(false);
    expect(succeeding).toHaveBeenCalledOnce();
  });
});
