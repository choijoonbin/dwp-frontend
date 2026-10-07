import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createHrisTimeWorkPlanDataSource } from './hris-time-work-plan-api';

import type {
  HrisTimeWorkPlanGovernedAuthority,
  HrisTimeWorkPlanHttpClient,
  WorkPlanStudioScope,
} from './hris-time-work-plan-api';
import type {
  WorkPlanReceipt,
  WorkPlanSimulationRequest,
} from '../model/hris-time-work-plan-model';

const scope: WorkPlanStudioScope = {
  ready: true,
  scopeKey: 'opaque/scope?synthetic',
  decisionRevision: 'decision/revision?9',
  effectiveOn: '2026-03-08',
};

const request: WorkPlanSimulationRequest = {
  workPlanId: 'plan/a ?한',
  expectedVersion: 7,
  assignmentSnapshotRevision: 'assignment-revision-12',
  policyRevision: 'policy-revision-4',
  purpose: 'PRE_PUBLISH_IMPACT_REVIEW',
};

function receipt(overrides: Partial<WorkPlanReceipt> = {}): WorkPlanReceipt {
  return {
    receiptId: 'receipt-1',
    workPlanId: request.workPlanId,
    operation: 'SIMULATE',
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    status: 'RESULT_UNKNOWN',
    updatedAt: '2026-03-08T12:00:00Z',
    ...overrides,
  };
}

function ownerResponse(data: unknown) {
  return {
    data: {
      status: 'SUCCESS',
      message: '',
      data,
    },
  };
}

describe('HRIS time work plan owner API adapter', () => {
  const get = vi.fn<HrisTimeWorkPlanHttpClient['get']>();
  const post = vi.fn<HrisTimeWorkPlanHttpClient['post']>();
  const idFactory = vi.fn(() => '11111111-1111-4111-8111-111111111111');
  const authority = vi.fn<HrisTimeWorkPlanGovernedAuthority>((authorityScope, signal) => ({
    decisionRevision: authorityScope.decisionRevision,
    config: {
      contextScopeKey: authorityScope.scopeKey,
      headers: {
        'X-DWP-Expected-Decision-Revision': authorityScope.decisionRevision,
      },
      signal,
    },
  }));
  const client: HrisTimeWorkPlanHttpClient = { get, post };

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    idFactory.mockClear();
    authority.mockClear();
  });

  it('reads the effective-date catalog and unwraps the standard owner envelope', async () => {
    const signal = new AbortController().signal;
    const payload = { queryState: 'EMPTY', workPlans: [] };
    get.mockResolvedValue(ownerResponse(payload));
    const source = createHrisTimeWorkPlanDataSource(client, idFactory, authority);

    await expect(source.read(scope, signal)).resolves.toBe(payload);
    expect(get).toHaveBeenCalledWith('/api/time/v1/hris/work-plans?effectiveOn=2026-03-08', {
      contextScopeKey: 'opaque/scope?synthetic',
      signal,
    });
  });

  it('posts a path-encoded simulation with decision and idempotency headers', async () => {
    const signal = new AbortController().signal;
    const payload = { receipt: receipt({ status: 'ACCEPTED' }), simulation: null };
    post.mockResolvedValue(ownerResponse(payload));
    const source = createHrisTimeWorkPlanDataSource(client, idFactory, authority);

    await expect(source.simulate(request, scope, signal)).resolves.toBe(payload);
    expect(post).toHaveBeenCalledWith(
      '/api/time/v1/hris/work-plans/plan%2Fa%20%3F%ED%95%9C/simulations',
      {
        expectedVersion: 7,
        assignmentSnapshotRevision: 'assignment-revision-12',
        policyRevision: 'policy-revision-4',
        purpose: 'PRE_PUBLISH_IMPACT_REVIEW',
      },
      {
        contextScopeKey: 'opaque/scope?synthetic',
        headers: {
          'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
          'X-DWP-Expected-Decision-Revision': 'decision/revision?9',
        },
        signal,
      }
    );
    expect(idFactory).toHaveBeenCalledTimes(1);
    expect(authority).toHaveBeenCalledWith(scope, signal);
  });

  it('uses the freshly evaluated secure mutation authority when the runtime supplies one', async () => {
    const signal = new AbortController().signal;
    const payload = { receipt: receipt({ status: 'ACCEPTED' }), simulation: null };
    post.mockResolvedValue(ownerResponse(payload));
    const source = createHrisTimeWorkPlanDataSource(client, idFactory);

    await expect(
      source.simulate(request, scope, signal, {
        mode: 'SECURE',
        rolloutState: '111',
        expectedDecisionRevision: scope.decisionRevision,
        contextKey: 'hcm.operations.time.work-plan-simulation',
        contextScopeKey: scope.scopeKey,
      })
    ).resolves.toBe(payload);

    expect(post).toHaveBeenCalledWith(
      '/api/time/v1/hris/work-plans/plan%2Fa%20%3F%ED%95%9C/simulations',
      expect.anything(),
      {
        contextScopeKey: scope.scopeKey,
        headers: {
          'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
          'X-DWP-Expected-Decision-Revision': scope.decisionRevision,
        },
        signal,
      }
    );
    expect(authority).not.toHaveBeenCalled();
  });

  it('preserves an authority-bound idempotency key instead of minting a second command identity', async () => {
    const signal = new AbortController().signal;
    const authorityKey = '22222222-2222-4222-8222-222222222222';
    post.mockResolvedValue(
      ownerResponse({
        receipt: receipt({ status: 'ACCEPTED', idempotencyKey: authorityKey }),
        simulation: null,
      })
    );
    const source = createHrisTimeWorkPlanDataSource(client, idFactory);

    await source.simulate(request, scope, signal, {
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: scope.decisionRevision,
      contextKey: 'hcm.operations.time.work-plan-simulation',
      contextScopeKey: scope.scopeKey,
      idempotencyKey: authorityKey,
    });

    expect(post).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': authorityKey }),
      })
    );
    expect(idFactory).not.toHaveBeenCalled();
  });

  it('rejects a legacy or scope-mismatched mutation authority before dispatch', async () => {
    const source = createHrisTimeWorkPlanDataSource(client, idFactory);
    const signal = new AbortController().signal;

    await expect(
      source.simulate(request, scope, signal, { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' })
    ).rejects.toThrow('Governed work plan simulation authority is invalid.');
    await expect(
      source.simulate(request, scope, signal, {
        mode: 'SECURE',
        rolloutState: '111',
        expectedDecisionRevision: 'other-revision',
        contextKey: 'hcm.operations.time.work-plan-simulation',
        contextScopeKey: scope.scopeKey,
      })
    ).rejects.toThrow('Governed work plan simulation authority is invalid.');

    expect(post).not.toHaveBeenCalled();
    expect(idFactory).not.toHaveBeenCalled();
  });

  it('reconciles the exact encoded receipt without minting another command identity', async () => {
    const signal = new AbortController().signal;
    const commandReceipt = receipt({ receiptId: 'receipt/a ?한' });
    const payload = { receipt: commandReceipt, simulation: null };
    get.mockResolvedValue(ownerResponse(payload));
    const source = createHrisTimeWorkPlanDataSource(client, idFactory, authority);

    await expect(source.reconcileReceipt(commandReceipt, scope, signal)).resolves.toBe(payload);
    expect(get).toHaveBeenCalledWith(
      '/api/time/v1/hris/work-plan-receipts/receipt%2Fa%20%3F%ED%95%9C',
      {
        contextScopeKey: 'opaque/scope?synthetic',
        signal,
      }
    );
    expect(post).not.toHaveBeenCalled();
    expect(idFactory).not.toHaveBeenCalled();
  });

  it.each([
    ['a foreign work plan', { workPlanId: 'plan-foreign' }],
    ['a foreign operation', { operation: 'PUBLISH' }],
    ['a foreign idempotency key', { idempotencyKey: '22222222-2222-4222-8222-222222222222' }],
  ])('rejects an initial simulation receipt bound to %s', async (_label, override) => {
    const signal = new AbortController().signal;
    const payload = {
      receipt: { ...receipt({ status: 'ACCEPTED' }), ...override },
      simulation: null,
    };
    post.mockResolvedValue(ownerResponse(payload));
    const source = createHrisTimeWorkPlanDataSource(client, idFactory, authority);

    await expect(source.simulate(request, scope, signal)).rejects.toThrow(
      'Work plan command identity does not match the request.'
    );
  });

  it.each([
    ['receipt id', { receiptId: 'receipt-changed' }],
    ['work plan id', { workPlanId: 'plan-foreign' }],
    ['operation', { operation: 'PUBLISH' }],
    ['idempotency key', { idempotencyKey: '22222222-2222-4222-8222-222222222222' }],
  ])('rejects recovery when the server changes the %s', async (_label, override) => {
    const signal = new AbortController().signal;
    const commandReceipt = receipt({ receiptId: 'receipt-original' });
    get.mockResolvedValue(
      ownerResponse({
        receipt: { ...commandReceipt, ...override },
        simulation: null,
      })
    );
    const source = createHrisTimeWorkPlanDataSource(client, idFactory, authority);

    await expect(source.reconcileReceipt(commandReceipt, scope, signal)).rejects.toThrow(
      'Work plan command identity does not match the request.'
    );
    expect(get).toHaveBeenCalledWith('/api/time/v1/hris/work-plan-receipts/receipt-original', {
      contextScopeKey: 'opaque/scope?synthetic',
      signal,
    });
    expect(post).not.toHaveBeenCalled();
    expect(idFactory).not.toHaveBeenCalled();
  });

  it('rejects malformed scopes before any HTTP or id generation', async () => {
    const source = createHrisTimeWorkPlanDataSource(client, idFactory, authority);
    const signal = new AbortController().signal;
    const invalidScopes: WorkPlanStudioScope[] = [
      { ...scope, ready: false },
      { ...scope, scopeKey: ' whitespace' },
      { ...scope, decisionRevision: '' },
      { ...scope, effectiveOn: '2026-02-30' },
      { ...scope, effectiveOn: '2026-3-8' },
    ];

    for (const invalidScope of invalidScopes) {
      await expect(source.read(invalidScope, signal)).rejects.toThrow(
        'Invalid work plan studio scope.'
      );
      await expect(source.simulate(request, invalidScope, signal)).rejects.toThrow(
        'Invalid work plan studio scope.'
      );
      await expect(source.reconcileReceipt(receipt(), invalidScope, signal)).rejects.toThrow(
        'Invalid work plan studio scope.'
      );
    }

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(idFactory).not.toHaveBeenCalled();
    expect(authority).not.toHaveBeenCalled();
  });

  it('fails before HTTP when central governed authority is absent or mismatched', async () => {
    const signal = new AbortController().signal;
    const withoutAuthority = createHrisTimeWorkPlanDataSource(client, idFactory);

    await expect(withoutAuthority.simulate(request, scope, signal)).rejects.toThrow(
      'Governed work plan simulation authority is unavailable.'
    );

    const mismatchedAuthority: HrisTimeWorkPlanGovernedAuthority = (
      authorityScope,
      authoritySignal
    ) => ({
      decisionRevision: 'different-revision',
      config: {
        contextScopeKey: authorityScope.scopeKey,
        headers: { 'X-DWP-Expected-Decision-Revision': 'different-revision' },
        signal: authoritySignal,
      },
    });
    const mismatched = createHrisTimeWorkPlanDataSource(client, idFactory, mismatchedAuthority);
    await expect(mismatched.simulate(request, scope, signal)).rejects.toThrow(
      'Governed work plan simulation authority is invalid.'
    );

    const headerlessAuthority: HrisTimeWorkPlanGovernedAuthority = (
      authorityScope,
      authoritySignal
    ) => ({
      decisionRevision: authorityScope.decisionRevision,
      config: {
        contextScopeKey: authorityScope.scopeKey,
        signal: authoritySignal,
      },
    });
    const headerless = createHrisTimeWorkPlanDataSource(client, idFactory, headerlessAuthority);
    await expect(headerless.simulate(request, scope, signal)).rejects.toThrow(
      'Governed work plan simulation authority is invalid.'
    );

    expect(post).not.toHaveBeenCalled();
    expect(idFactory).not.toHaveBeenCalled();
  });

  it('rejects a malformed standard envelope without replacing transport errors', async () => {
    get.mockResolvedValue({ data: { status: 'SUCCESS', message: '' } } as never);
    const source = createHrisTimeWorkPlanDataSource(client, idFactory, authority);

    await expect(source.read(scope, new AbortController().signal)).rejects.toThrow(
      'Invalid work plan owner response envelope.'
    );

    const transportFailure = new Error('synthetic transport failure');
    get.mockRejectedValueOnce(transportFailure);
    await expect(source.read(scope, new AbortController().signal)).rejects.toBe(transportFailure);
  });
});
