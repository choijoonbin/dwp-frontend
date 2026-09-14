import {
  APPROVAL_TYPED_WORKFLOW_MAX_STAGES,
  workflowIdentifier,
  workflowInteger,
  workflowInvalid,
} from './approval-workflow-typed-model';

import type {
  ApprovalTypedWorkflowGraph,
  ApprovalTypedWorkflowStage,
} from './approval-workflow-typed-model';

type GraphStage = Pick<ApprovalTypedWorkflowStage, 'key' | 'predecessors' | 'slaMinutes'>;

export function analyzeApprovalTypedWorkflowGraph(
  stages: readonly GraphStage[],
  workflowSla?: number
): ApprovalTypedWorkflowGraph {
  const nodes: readonly GraphStage[] = stages;
  if (
    !Array.isArray(stages) ||
    stages.length < 1 ||
    stages.length > APPROVAL_TYPED_WORKFLOW_MAX_STAGES
  )
    workflowInvalid('stage-count', 'stages');
  const byKey = new Map<string, GraphStage>();
  nodes.forEach((stage, index) => {
    workflowIdentifier(stage.key, `stages[${index}].key`);
    workflowInteger(stage.slaMinutes, 15, 525600, `stages[${index}].slaMinutes`);
    if (byKey.has(stage.key)) workflowInvalid('duplicate-stage', `stages[${index}].key`);
    byKey.set(stage.key, stage);
  });
  nodes.forEach((stage, index) => {
    const path = `stages[${index}].predecessors`;
    if (
      !Array.isArray(stage.predecessors) ||
      stage.predecessors.length > APPROVAL_TYPED_WORKFLOW_MAX_STAGES
    )
      workflowInvalid('predecessor-count', path);
    const seen = new Set<string>();
    Array.from<string>(stage.predecessors).forEach((key, predecessorIndex) => {
      workflowIdentifier(key, `${path}[${predecessorIndex}]`);
      if (key === stage.key) workflowInvalid('self-predecessor', path);
      if (seen.has(key)) workflowInvalid('duplicate-predecessor', path);
      if (!byKey.has(key)) workflowInvalid('unknown-predecessor', path);
      seen.add(key);
    });
  });
  if (workflowSla !== undefined) workflowInteger(workflowSla, 15, 525600, 'slaMinutes');

  const complete = new Set<string>();
  const longest = new Map<string, number>();
  const ordered: string[] = [];
  const levels: Array<readonly string[]> = [];
  while (complete.size < nodes.length) {
    // Match Java's ready-wave key sort; do not reorder the persisted stage array.
    const ready = nodes
      .filter(
        (stage) => !complete.has(stage.key) && stage.predecessors.every((key) => complete.has(key))
      )
      .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    if (ready.length === 0) workflowInvalid('predecessor-cycle', 'stages');
    levels.push(Object.freeze(ready.map((stage) => stage.key)));
    for (const stage of ready) {
      const path =
        stage.slaMinutes + Math.max(0, ...stage.predecessors.map((key) => longest.get(key)!));
      if (workflowSla !== undefined && path > workflowSla)
        workflowInvalid('longest-path-sla', 'slaMinutes');
      longest.set(stage.key, path);
      ordered.push(stage.key);
      complete.add(stage.key);
    }
  }
  return Object.freeze({
    topologicalStageKeys: Object.freeze(ordered),
    levels: Object.freeze(levels),
    longestPathMinutes: Math.max(...longest.values()),
  });
}
