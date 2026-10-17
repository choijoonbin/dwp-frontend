import { beforeEach, describe, expect, it, vi } from 'vitest';

const owner = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/approval-api', () => ({
  getApprovalDelegations: owner.list,
  createApprovalDelegation: owner.create,
  revokeApprovalDelegation: owner.revoke,
}));

import { hrisDelegationDataSource } from '../api/hris-delegation-adapter';

const execution = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'decision-9',
  contextKey: 'approval-work',
  contextScopeKey: 'population-42',
  idempotencyKey: 'delegation-command-9',
} as const;

describe('HRIS team delegation Approval adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reuses only the shared delegation list client with the installed population scope', async () => {
    const signal = new AbortController().signal;
    owner.list.mockResolvedValue([]);

    await hrisDelegationDataSource.list('population-42', signal);

    expect(owner.list).toHaveBeenCalledWith('population-42', signal);
  });

  it('preserves create window, scope, reason and owner execution', async () => {
    const input = {
      delegateUserId: 77,
      scopeType: 'ALL' as const,
      startsAt: '2026-10-18T00:00:00.000Z',
      endsAt: '2026-10-19T00:00:00.000Z',
      reason: 'Planned leave',
    };
    owner.create.mockResolvedValue([]);

    await hrisDelegationDataSource.create(input, execution);

    expect(owner.create).toHaveBeenCalledWith(input, execution);
  });

  it('preserves revoke subject revision and owner execution', async () => {
    owner.revoke.mockResolvedValue([]);

    await hrisDelegationDataSource.revoke('delegation-9', 9, {
      ...execution,
      objectVersion: 9,
    });

    expect(owner.revoke).toHaveBeenCalledWith(
      'delegation-9',
      9,
      expect.objectContaining({ objectVersion: 9, idempotencyKey: 'delegation-command-9' })
    );
  });
});
