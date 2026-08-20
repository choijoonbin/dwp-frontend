import type { DwaionEvaluationResult, DwaionEvaluationRun } from '@dwp-frontend/shared-utils';

export type EvaluationResultTrend = 'IMPROVED' | 'REGRESSED' | 'STABLE';

const OUTCOME_SCORE: Record<DwaionEvaluationResult['outcome'], number> = {
  PASS: 2,
  FAIL: 1,
  CONFIGURATION_REQUIRED: 0,
};

export function evaluationResultTrend(
  current: DwaionEvaluationResult,
  previous?: DwaionEvaluationResult
): EvaluationResultTrend | null {
  if (
    !previous ||
    current.outcome === 'CONFIGURATION_REQUIRED' ||
    previous.outcome === 'CONFIGURATION_REQUIRED'
  )
    return null;
  const delta = OUTCOME_SCORE[current.outcome] - OUTCOME_SCORE[previous.outcome];
  return delta > 0 ? 'IMPROVED' : delta < 0 ? 'REGRESSED' : 'STABLE';
}

export function compareEvaluationRuns(
  current?: DwaionEvaluationRun,
  previous?: DwaionEvaluationRun
) {
  if (!current || !previous) return null;
  const previousByCase = new Map(previous.results.map((item) => [item.evaluationCaseId, item]));
  const trends = current.results
    .map((item) => evaluationResultTrend(item, previousByCase.get(item.evaluationCaseId)))
    .filter(Boolean);
  return {
    delta: passRate(current) - passRate(previous),
    improved: trends.filter((item) => item === 'IMPROVED').length,
    regressed: trends.filter((item) => item === 'REGRESSED').length,
  };
}

function passRate(run: DwaionEvaluationRun) {
  return run.caseCount ? Math.round((run.passedCount * 100) / run.caseCount) : 0;
}
