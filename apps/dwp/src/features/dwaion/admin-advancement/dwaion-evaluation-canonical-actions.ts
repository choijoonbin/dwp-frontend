import type { DwaionEvaluationSafetySnapshot } from '@dwp-frontend/shared-utils';

import type { DwaionCanonicalCommandAction } from './dwaion-canonical-command-actions';

const RERUNNABLE_COMPARISON_STATES = new Set(['PARTIAL', 'COMPLETED', 'FAILED']);

export function evaluationCanonicalActions(
  data: DwaionEvaluationSafetySnapshot,
  description: string
): DwaionCanonicalCommandAction[] {
  const datasets = data.datasets.filter((item) => item.piiState === 'PASS');
  const comparison = data.comparisons.find(
    (item) =>
      RERUNNABLE_COMPARISON_STATES.has(item.state) &&
      (!item.datasetId || datasets.some((dataset) => dataset.datasetId === item.datasetId))
  );
  const dataset = comparison?.datasetId
    ? datasets.find((item) => item.datasetId === comparison.datasetId)
    : datasets[0];
  if (!dataset) return [];
  const target = { type: 'EVALUATION_DATASET', id: dataset.datasetId };
  const common = {
    description,
    target,
    expectedVersion: dataset.version,
    impacts: [dataset.ownerRef, `${dataset.caseCount} evaluation cases`, 'Release gate evidence'],
    recoveryPlan:
      'Cancel queued evaluator work, quarantine invalid evidence, and retain the previous release-gate decision.',
  };
  const actions: DwaionCanonicalCommandAction[] = [
    {
      ...common,
      label: 'New evaluation run',
      title: 'Start evaluation run',
      kind: 'EVALUATION_RUN',
      changes: [{ label: 'Evaluation run', before: 'Not started', after: 'QUEUED' }],
      payload: { datasetId: dataset.datasetId, datasetVersion: dataset.version, pinned: true },
    },
  ];

  if (comparison) {
    actions.push(
      {
        ...common,
        label: 'Rerun comparison',
        title: 'Rerun pinned comparison',
        kind: 'EVALUATION_RERUN',
        changes: [
          {
            label: 'Comparison',
            before: comparison.state,
            after: 'RERUN_QUEUED',
          },
        ],
        payload: {
          comparisonId: comparison.comparisonId,
          datasetId: dataset.datasetId,
          datasetVersion: dataset.version,
          preservePinnedVersions: true,
        },
      },
      {
        ...common,
        label: 'Export evaluation report',
        title: 'Export evaluation report',
        kind: 'EVALUATION_REPORT_EXPORT',
        changes: [
          { label: 'Report receipt', before: 'Not generated', after: 'PDF_EXPORT_PENDING' },
        ],
        payload: { comparisonId: comparison.comparisonId, format: 'PDF', includeEvidence: true },
      },
      {
        ...common,
        label: 'Submit gate evidence',
        title: 'Submit release-gate evidence',
        kind: 'EVALUATION_GATE_APPROVE',
        changes: [
          { label: 'Release gate', before: data.releaseGateState, after: 'APPROVAL_PENDING' },
        ],
        payload: {
          comparisonId: comparison.comparisonId,
          datasetChecksum: dataset.checksumSha256,
          decision: 'REQUEST_APPROVAL',
        },
      }
    );
  }

  actions.push(
    {
      ...common,
      label: 'Enforce emergency guardrail',
      title: 'Enforce emergency safety guardrail',
      kind: 'SAFETY_GUARDRAIL_ENFORCE',
      target: { type: 'SAFETY_SCOPE', id: 'tenant' },
      changes: [{ label: 'Guardrail', before: 'MONITORING', after: 'ENFORCEMENT_PENDING' }],
      impacts: ['Tenant AI traffic', 'Blocked safety categories', 'In-flight agent runs'],
      payload: { scope: 'tenant', inFlightPolicy: 'DRAIN', failClosed: true },
      destructive: true,
    },
    {
      ...common,
      label: 'Approve safety canary',
      title: 'Approve bounded safety canary',
      kind: 'SAFETY_CANARY_APPROVE',
      target: { type: 'SAFETY_SCOPE', id: 'tenant' },
      changes: [{ label: 'Safety canary', before: '0%', after: '5% / 30 minutes' }],
      impacts: ['5% tenant AI traffic', 'Automatic fail-closed thresholds'],
      payload: { scope: 'tenant', trafficPercent: 5, durationMinutes: 30, autoStop: true },
    }
  );
  return actions;
}
