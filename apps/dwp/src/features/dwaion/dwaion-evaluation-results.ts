import type { DwaionEvaluationRunSummary } from '@dwp-frontend/shared-utils';

export function evaluationRuleSample(run: DwaionEvaluationRunSummary): string | null {
  if (
    run.runState !== 'COMPLETED' ||
    !Number.isInteger(run.caseCount) ||
    run.caseCount <= 0 ||
    !Number.isInteger(run.passedCount) ||
    run.passedCount < 0 ||
    run.passedCount > run.caseCount
  )
    return null;
  return `${run.passedCount} / ${run.caseCount}`;
}
