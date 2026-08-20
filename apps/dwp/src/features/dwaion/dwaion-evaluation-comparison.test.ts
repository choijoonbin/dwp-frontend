import { describe, expect, it } from 'vitest';

import { compareEvaluationRuns, evaluationResultTrend } from './dwaion-evaluation-comparison';

import type { DwaionEvaluationResult, DwaionEvaluationRun } from '@dwp-frontend/shared-utils';

const caseResult = (
  evaluationCaseId: string,
  outcome: DwaionEvaluationResult['outcome']
): DwaionEvaluationResult => ({
  evaluationCaseId,
  caseName: evaluationCaseId,
  outcome,
  statusCode: outcome,
  grounded: outcome === 'PASS',
  expectedTermsMatched: outcome === 'PASS' ? 1 : 0,
  expectedTermsTotal: 1,
  latencyMs: 100,
});

const run = (id: string, results: DwaionEvaluationResult[]): DwaionEvaluationRun => ({
  evaluationRunId: id,
  evaluationSetId: 'set-1',
  runState: 'COMPLETED',
  caseCount: results.length,
  passedCount: results.filter((item) => item.outcome === 'PASS').length,
  failedCount: results.filter((item) => item.outcome === 'FAIL').length,
  configurationRequiredCount: results.filter((item) => item.outcome === 'CONFIGURATION_REQUIRED')
    .length,
  results,
  createdAt: '2026-08-20T00:00:00Z',
  completedAt: '2026-08-20T00:01:00Z',
});

describe('DWAI-ON evaluation run comparison', () => {
  it('detects improved, regressed, and stable case outcomes', () => {
    expect(evaluationResultTrend(caseResult('a', 'PASS'), caseResult('a', 'FAIL'))).toBe(
      'IMPROVED'
    );
    expect(evaluationResultTrend(caseResult('a', 'FAIL'), caseResult('a', 'PASS'))).toBe(
      'REGRESSED'
    );
    expect(evaluationResultTrend(caseResult('a', 'PASS'), caseResult('a', 'PASS'))).toBe('STABLE');
    expect(
      evaluationResultTrend(caseResult('a', 'FAIL'), caseResult('a', 'CONFIGURATION_REQUIRED'))
    ).toBeNull();
  });

  it('reports pass-rate delta and per-case quality changes', () => {
    const previous = run('previous', [caseResult('a', 'PASS'), caseResult('b', 'FAIL')]);
    const current = run('current', [caseResult('a', 'FAIL'), caseResult('b', 'PASS')]);

    expect(compareEvaluationRuns(current, previous)).toEqual({
      delta: 0,
      improved: 1,
      regressed: 1,
    });
  });
});
