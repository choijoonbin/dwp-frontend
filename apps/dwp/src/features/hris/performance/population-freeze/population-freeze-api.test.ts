import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

type SecureAuthority = Extract<ProductSurfaceGovernedMutationAuthority, { mode: 'SECURE' }>;

const runtime = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { post: runtime.post },
}));

import { freezePerformancePopulation } from './population-freeze-api';

const CYCLE_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const PREVIEW_ID = '33333333-3333-4333-8333-333333333333';
const RULE_ID = '44444444-4444-4444-8444-444444444444';
const SNAPSHOT_ID = '55555555-5555-4555-8555-555555555555';
const FREEZE_ID = '66666666-6666-4666-8666-666666666666';
const HASH = 'a'.repeat(64);

const command = Object.freeze({
  commandId: COMMAND_ID,
  expectedCycleRevision: 4,
  populationPreviewId: PREVIEW_ID,
  populationRuleId: RULE_ID,
  workforceSnapshotId: SNAPSHOT_ID,
  workforceSnapshotRevision: 31,
  previewContentHash: HASH,
  reason: 'Reviewed the exact population evidence.',
});

function authority(
  commandId: string = COMMAND_ID,
  objectVersion: number = command.expectedCycleRevision
): SecureAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-revision-31',
    contextKey: 'hcm.operations.performance',
    contextScopeKey: 'tenant:77/performance',
    idempotencyKey: commandId,
    objectVersion,
    stepUp: {
      challenge: 'signed-population-freeze-challenge',
      challengeId: 'population-freeze-challenge-id',
      decisionRevision: 'decision-revision-31',
      expiresAt: '2099-01-01T00:00:00Z',
    },
  };
}

function succeededResult() {
  return {
    freeze: {
      populationFreezeId: FREEZE_ID,
      cycleId: CYCLE_ID,
      cycleVersionId: '77777777-7777-4777-8777-777777777777',
      populationPreviewId: PREVIEW_ID,
      populationRuleVersionId: RULE_ID,
      workforceSnapshotId: SNAPSHOT_ID,
      workforceSnapshotRevision: 31,
      sourceCycleAggregateVersion: 4,
      state: 'FROZEN',
      participantCount: 12,
      reviewerAssignmentCount: 4,
      contentHash: HASH,
      aggregateVersion: 1,
      frozenAt: '2027-04-01T00:00:01Z',
    },
    receipt: {
      receiptId: COMMAND_ID,
      commandType: 'FREEZE_POPULATION',
      originatingAction: 'performance.population.freeze',
      aggregateId: CYCLE_ID,
      expectedAggregateVersion: 4,
      appliedAggregateVersion: 1,
      state: 'SUCCEEDED',
      resultRef: FREEZE_ID,
      errorCode: null,
      acceptedAt: '2027-04-01T00:00:00Z',
      completedAt: '2027-04-01T00:00:01Z',
    },
  };
}

describe('performance population-freeze API', () => {
  beforeEach(() => runtime.post.mockReset());

  it('replays the identical governed authority, idempotency key, version, and payload', async () => {
    runtime.post.mockResolvedValue({ data: { data: succeededResult() } });
    const governedAuthority = authority();

    await freezePerformancePopulation(CYCLE_ID, command, governedAuthority);
    await freezePerformancePopulation(CYCLE_ID, command, governedAuthority);

    expect(runtime.post).toHaveBeenCalledTimes(2);
    expect(runtime.post.mock.calls[1]).toEqual(runtime.post.mock.calls[0]);
    const [path, body, config] = runtime.post.mock.calls[0]!;
    expect(path).toBe(`/api/people/v1/hris/performance/cycles/${CYCLE_ID}/population-freezes`);
    expect(body).toEqual({
      commandId: COMMAND_ID,
      populationPreviewId: PREVIEW_ID,
      populationRuleId: RULE_ID,
      workforceSnapshotId: SNAPSHOT_ID,
      workforceSnapshotRevision: 31,
      previewContentHash: HASH,
      reason: command.reason,
    });
    expect(body).not.toHaveProperty('expectedCycleRevision');
    expect(config).toEqual({
      contextScopeKey: governedAuthority.contextScopeKey,
      headers: {
        'X-DWP-Expected-Decision-Revision': governedAuthority.expectedDecisionRevision,
        'X-DWP-Step-Up-Challenge': governedAuthority.stepUp?.challenge,
        'X-DWP-Expected-Object-Version': '4',
        'Idempotency-Key': COMMAND_ID,
        'If-Match': '4',
      },
    });
  });

  it('fails before transport when signed command identity or version is substituted', async () => {
    await expect(
      freezePerformancePopulation(CYCLE_ID, command, authority('other-command'))
    ).rejects.toThrow('Population-freeze authority does not match the command.');
    await expect(
      freezePerformancePopulation(CYCLE_ID, command, authority(COMMAND_ID, 5))
    ).rejects.toThrow('Population-freeze authority does not match the command.');
    expect(runtime.post).not.toHaveBeenCalled();
  });

  it('rejects a valid receipt that belongs to a different governed command', async () => {
    const mismatched = succeededResult();
    mismatched.receipt.receiptId = '88888888-8888-4888-8888-888888888888';
    runtime.post.mockResolvedValue({ data: { data: mismatched } });

    await expect(freezePerformancePopulation(CYCLE_ID, command, authority())).rejects.toThrow(
      'Population-freeze response does not match the governed command.'
    );
  });
});
