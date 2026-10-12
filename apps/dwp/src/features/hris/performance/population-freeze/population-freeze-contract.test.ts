import { describe, expect, it } from 'vitest';

import { parsePerformancePopulationFreezeResult } from './population-freeze-contract';

const ID = {
  cycle: '11111111-1111-4111-8111-111111111111',
  command: '22222222-2222-4222-8222-222222222222',
  freeze: '33333333-3333-4333-8333-333333333333',
  version: '44444444-4444-4444-8444-444444444444',
  preview: '55555555-5555-4555-8555-555555555555',
  rule: '66666666-6666-4666-8666-666666666666',
  snapshot: '77777777-7777-4777-8777-777777777777',
} as const;

function result() {
  return {
    freeze: {
      populationFreezeId: ID.freeze,
      cycleId: ID.cycle,
      cycleVersionId: ID.version,
      populationPreviewId: ID.preview,
      populationRuleVersionId: ID.rule,
      workforceSnapshotId: ID.snapshot,
      workforceSnapshotRevision: 31,
      sourceCycleAggregateVersion: 4,
      state: 'FROZEN',
      participantCount: 12,
      reviewerAssignmentCount: 4,
      contentHash: 'a'.repeat(64),
      aggregateVersion: 1,
      frozenAt: '2027-04-01T00:00:01Z',
    },
    receipt: {
      receiptId: ID.command,
      commandType: 'FREEZE_POPULATION',
      originatingAction: 'performance.population.freeze',
      aggregateId: ID.cycle,
      expectedAggregateVersion: 4,
      appliedAggregateVersion: 1,
      state: 'SUCCEEDED',
      resultRef: ID.freeze,
      errorCode: null,
      acceptedAt: '2027-04-01T00:00:00Z',
      completedAt: '2027-04-01T00:00:01Z',
    },
  };
}

describe('performance population-freeze result contract', () => {
  it('accepts and freezes an exactly bound immutable freeze and receipt', () => {
    const parsed = parsePerformancePopulationFreezeResult(result());

    expect(parsed.freeze?.populationFreezeId).toBe(ID.freeze);
    expect(parsed.receipt.resultRef).toBe(ID.freeze);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.freeze)).toBe(true);
    expect(Object.isFrozen(parsed.receipt)).toBe(true);
  });

  it('rejects nonterminal completion and mismatched successful evidence', () => {
    const nonterminal = result();
    nonterminal.freeze = null as never;
    nonterminal.receipt.state = 'RESULT_UNKNOWN';
    nonterminal.receipt.appliedAggregateVersion = null as never;
    nonterminal.receipt.resultRef = null as never;
    expect(() => parsePerformancePopulationFreezeResult(nonterminal)).toThrow(
      'Performance population-freeze source payload is invalid.'
    );

    const matching = result();
    const mismatched = {
      ...matching,
      receipt: { ...matching.receipt, resultRef: ID.preview },
    };
    expect(() => parsePerformancePopulationFreezeResult(mismatched)).toThrow(
      'Performance population-freeze source payload is invalid.'
    );
  });
});
