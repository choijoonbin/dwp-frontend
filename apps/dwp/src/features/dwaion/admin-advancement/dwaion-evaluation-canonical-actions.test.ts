import type { DwaionEvaluationSafetySnapshot } from '@dwp-frontend/shared-utils';
import { describe, expect, it } from 'vitest';

import { evaluationCanonicalActions } from './dwaion-evaluation-canonical-actions';

describe('evaluationCanonicalActions', () => {
  it('does not offer comparison actions when no terminal comparison exists', () => {
    const withoutComparison = evaluationCanonicalActions(snapshot([]), 'Governed change');
    const withRunningComparison = evaluationCanonicalActions(
      snapshot([comparison('RUNNING')]),
      'Governed change'
    );

    for (const actions of [withoutComparison, withRunningComparison]) {
      expect(actions.map((action) => action.kind)).not.toContain('EVALUATION_RERUN');
      expect(actions.map((action) => action.kind)).not.toContain('EVALUATION_REPORT_EXPORT');
      expect(actions.map((action) => action.kind)).not.toContain('EVALUATION_GATE_APPROVE');
    }
  });

  it('binds reruns to the dataset version and requires the selected comparison id', () => {
    const actions = evaluationCanonicalActions(
      snapshot([comparison('COMPLETED')]),
      'Governed change'
    );

    const rerun = actions.find((action) => action.kind === 'EVALUATION_RERUN');
    expect(rerun).toMatchObject({
      target: { type: 'EVALUATION_DATASET', id: 'dataset-1' },
      expectedVersion: 7,
      payload: {
        comparisonId: 'comparison-1',
        datasetId: 'dataset-1',
        datasetVersion: 7,
        preservePinnedVersions: true,
      },
    });
  });
});

function snapshot(
  comparisons: DwaionEvaluationSafetySnapshot['comparisons']
): DwaionEvaluationSafetySnapshot {
  return {
    generatedAt: '2026-09-17T00:00:00Z',
    capability: { status: 'AVAILABLE', configured: true },
    datasets: [
      {
        datasetId: 'dataset-1',
        name: 'Release evaluation set',
        version: 7,
        ownerRef: 'team:ai-safety',
        caseCount: 40,
        piiState: 'PASS',
        checksumSha256: 'a'.repeat(64),
        updatedAt: '2026-09-17T00:00:00Z',
      },
    ],
    comparisons,
    driftSignals: [],
    releaseGateState: 'REVIEW',
  };
}

function comparison(
  state: DwaionEvaluationSafetySnapshot['comparisons'][number]['state']
): DwaionEvaluationSafetySnapshot['comparisons'][number] {
  return {
    comparisonId: 'comparison-1',
    baselineLabel: 'baseline-v1',
    candidateLabel: 'candidate-v2',
    state,
    passRate: state === 'COMPLETED' ? 98 : null,
    regressionCount: 0,
    evaluatorFailureCount: 0,
    datasetId: 'dataset-1',
    datasetVersion: 7,
    resultVersion: 1,
    createdAt: '2026-09-17T00:00:00Z',
  };
}
