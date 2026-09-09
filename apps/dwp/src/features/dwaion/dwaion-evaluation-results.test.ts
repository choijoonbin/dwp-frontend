import { describe, expect, it } from 'vitest';
import type { DwaionEvaluationRunSummary } from '@dwp-frontend/shared-utils';
import { evaluationRuleSample } from './dwaion-evaluation-results';

const run: DwaionEvaluationRunSummary = {
  evaluationRunId: 'run-1',
  evaluationSetId: 'set-1',
  runState: 'COMPLETED',
  caseCount: 3,
  passedCount: 1,
  failedCount: 1,
  configurationRequiredCount: 1,
  createdAt: '2026-09-08T00:00:00Z',
};

describe('limited evaluation rule sample', () => {
  it('exposes the full denominator including configuration-required cases', () => {
    expect(evaluationRuleSample({ ...run, passRate: 99 })).toBe('1 / 3');
  });
  it.each([
    { caseCount: 0 },
    { passedCount: 4 },
    { passedCount: -1 },
    { caseCount: NaN },
    { caseCount: 2.5 },
    { runState: 'RUNNING' as const },
  ])('does not invent a result for unmeasured or invalid samples: %o', (change) => {
    expect(evaluationRuleSample({ ...run, ...change })).toBeNull();
  });
});
