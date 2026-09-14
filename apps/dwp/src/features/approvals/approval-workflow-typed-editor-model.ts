import { analyzeApprovalTypedWorkflowGraph } from './approval-workflow-typed-graph';
import { compileApprovalTypedWorkflowCondition } from './approval-workflow-typed-conditions';
import {
  APPROVAL_TYPED_WORKFLOW_CONTRACT,
  APPROVAL_TYPED_WORKFLOW_MAX_STAGES,
  validateApprovalTypedWorkflowQuorum,
  workflowIdentifier,
  workflowInteger,
  workflowInvalid,
  workflowObject,
} from './approval-workflow-typed-model';

import type {
  ApprovalTypedWorkflowDefinition,
  ApprovalTypedWorkflowQuorum,
  ApprovalTypedWorkflowStage,
} from './approval-workflow-typed-model';

function replaceStages(
  definition: ApprovalTypedWorkflowDefinition,
  stages: readonly ApprovalTypedWorkflowStage[]
): ApprovalTypedWorkflowDefinition {
  return Object.freeze({
    ...definition,
    stages: Object.freeze(
      stages.map((stage) =>
        Object.freeze({
          ...stage,
          quorum: Object.freeze({ ...stage.quorum }),
          predecessors: Object.freeze([...stage.predecessors]),
          ...(stage.routeCondition
            ? {
                routeCondition: Object.freeze({
                  all: Object.freeze(
                    stage.routeCondition.all.map((clause) =>
                      Object.freeze(
                        clause.operator === 'IN'
                          ? { ...clause, value: Object.freeze([...clause.value]) }
                          : { ...clause }
                      )
                    )
                  ),
                }),
              }
            : {}),
        })
      )
    ),
  });
}

function stageAt(definition: ApprovalTypedWorkflowDefinition, key: string): number {
  const index = definition.stages.findIndex((stage) => stage.key === key);
  if (index < 0) workflowInvalid('unknown-stage', 'stageKey');
  return index;
}

function freshKey(definition: ApprovalTypedWorkflowDefinition, prefix = 'REVIEW'): string {
  let ordinal = 1;
  while (definition.stages.some((stage) => stage.key === `${prefix}_${ordinal}`)) ordinal++;
  return `${prefix}_${ordinal}`;
}

function editorRole(role: string): string {
  if (role.length > 50) workflowInvalid('role-code-length', 'candidateRole');
  return workflowIdentifier(role, 'candidateRole');
}

/** Missing role/name deliberately creates an incomplete draft, not fabricated owner/source evidence. */
export function createApprovalTypedWorkflowSeed(
  candidateRole?: string
): ApprovalTypedWorkflowDefinition {
  return Object.freeze({
    schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT,
    schemaVersion: 2,
    slaMinutes: 1440,
    stages: Object.freeze([
      Object.freeze({
        key: 'REVIEW_1',
        name: '',
        candidateRole: candidateRole === undefined ? '' : editorRole(candidateRole),
        quorum: Object.freeze({ mode: 'ANY' as const }),
        slaMinutes: 15,
        predecessors: Object.freeze([]),
      }),
    ]),
  });
}

export function addApprovalTypedWorkflowStage(
  definition: ApprovalTypedWorkflowDefinition,
  candidateRole: string,
  relation: 'SERIAL' | 'PARALLEL',
  selectedKey?: string
): ApprovalTypedWorkflowDefinition {
  if (definition.stages.length >= APPROVAL_TYPED_WORKFLOW_MAX_STAGES)
    workflowInvalid('stage-count', 'stages');
  const selected =
    selectedKey === undefined ? undefined : definition.stages[stageAt(definition, selectedKey)];
  if (relation === 'SERIAL' && !selected) workflowInvalid('serial-anchor-required', 'stageKey');
  const predecessors =
    relation === 'SERIAL' ? [selected!.key] : [...(selected?.predecessors ?? [])];
  const stage: ApprovalTypedWorkflowStage = Object.freeze({
    key: freshKey(definition),
    name: '',
    candidateRole: editorRole(candidateRole),
    quorum: Object.freeze({ mode: 'ANY' }),
    slaMinutes: 15,
    predecessors: Object.freeze(predecessors),
  });
  return replaceStages(definition, [...definition.stages, stage]);
}

export function duplicateApprovalTypedWorkflowStage(
  definition: ApprovalTypedWorkflowDefinition,
  key: string
): ApprovalTypedWorkflowDefinition {
  if (definition.stages.length >= APPROVAL_TYPED_WORKFLOW_MAX_STAGES)
    workflowInvalid('stage-count', 'stages');
  const index = stageAt(definition, key);
  const source = definition.stages[index];
  const stage = Object.freeze({
    ...source,
    key: freshKey(definition, `${source.key.slice(0, 70)}_COPY`),
    predecessors: Object.freeze([...source.predecessors]),
  });
  const stages = [...definition.stages];
  stages.splice(index + 1, 0, stage);
  return replaceStages(definition, stages);
}

export function renameApprovalTypedWorkflowStage(
  definition: ApprovalTypedWorkflowDefinition,
  key: string,
  nextKey: string
): ApprovalTypedWorkflowDefinition {
  stageAt(definition, key);
  workflowIdentifier(nextKey, 'stageKey');
  if (key === nextKey) return definition;
  if (definition.stages.some((stage) => stage.key === nextKey))
    workflowInvalid('duplicate-stage', 'stageKey');
  return replaceStages(
    definition,
    definition.stages.map((stage) =>
      Object.freeze({
        ...stage,
        key: stage.key === key ? nextKey : stage.key,
        predecessors: Object.freeze(
          stage.predecessors.map((predecessor) => (predecessor === key ? nextKey : predecessor))
        ),
      })
    )
  );
}

export function setApprovalTypedWorkflowPredecessors(
  definition: ApprovalTypedWorkflowDefinition,
  key: string,
  predecessors: readonly string[]
): ApprovalTypedWorkflowDefinition {
  const index = stageAt(definition, key);
  const stages = definition.stages.map((stage, stageIndex) =>
    stageIndex === index
      ? Object.freeze({ ...stage, predecessors: Object.freeze([...predecessors]) })
      : stage
  );
  // Never silently detach or rewire another stage to make an invalid graph pass.
  analyzeApprovalTypedWorkflowGraph(stages);
  return replaceStages(definition, stages);
}

export function setApprovalTypedWorkflowQuorum(
  definition: ApprovalTypedWorkflowDefinition,
  key: string,
  quorum: ApprovalTypedWorkflowQuorum
): ApprovalTypedWorkflowDefinition {
  const index = stageAt(definition, key);
  const next = validateApprovalTypedWorkflowQuorum(quorum);
  return replaceStages(
    definition,
    definition.stages.map((stage, stageIndex) =>
      stageIndex === index ? Object.freeze({ ...stage, quorum: next }) : stage
    )
  );
}

export function removeApprovalTypedWorkflowStage(
  definition: ApprovalTypedWorkflowDefinition,
  key: string
): ApprovalTypedWorkflowDefinition {
  stageAt(definition, key);
  if (definition.stages.length <= 1) workflowInvalid('stage-count', 'stages');
  if (definition.stages.some((stage) => stage.predecessors.includes(key)))
    workflowInvalid('stage-referenced', 'stageKey');
  return replaceStages(
    definition,
    definition.stages.filter((stage) => stage.key !== key)
  );
}

export function moveApprovalTypedWorkflowStage(
  definition: ApprovalTypedWorkflowDefinition,
  key: string,
  direction: -1 | 1
): ApprovalTypedWorkflowDefinition {
  const index = stageAt(definition, key);
  const target = index + direction;
  if (target < 0 || target >= definition.stages.length) return definition;
  const stages = [...definition.stages];
  [stages[index], stages[target]] = [stages[target], stages[index]];
  return replaceStages(definition, stages);
}

export function updateApprovalTypedWorkflowStage(
  definition: ApprovalTypedWorkflowDefinition,
  key: string,
  patch: Partial<Pick<ApprovalTypedWorkflowStage, 'name' | 'candidateRole' | 'slaMinutes'>>
): ApprovalTypedWorkflowDefinition {
  const index = stageAt(definition, key);
  const value = workflowObject(patch, 'stagePatch');
  if (Object.keys(value).some((field) => !['name', 'candidateRole', 'slaMinutes'].includes(field)))
    workflowInvalid('properties-mismatch', 'stagePatch');
  if (Object.hasOwn(patch, 'name') && (typeof patch.name !== 'string' || patch.name.length > 120))
    workflowInvalid('stage-name', 'stagePatch.name');
  if (Object.hasOwn(patch, 'candidateRole')) {
    if (typeof patch.candidateRole !== 'string')
      workflowInvalid('identifier-invalid', 'stagePatch.candidateRole');
    if (patch.candidateRole !== '' && !/^[A-Z][A-Z0-9_]{0,49}$/.test(patch.candidateRole))
      workflowInvalid('identifier-invalid', 'stagePatch.candidateRole');
  }
  if (Object.hasOwn(patch, 'slaMinutes'))
    workflowInteger(patch.slaMinutes, 15, 525600, 'stagePatch.slaMinutes');
  return replaceStages(
    definition,
    definition.stages.map((stage, stageIndex) =>
      stageIndex === index ? { ...stage, ...patch } : stage
    )
  );
}

export function setApprovalTypedWorkflowSla(
  definition: ApprovalTypedWorkflowDefinition,
  slaMinutes: number
): ApprovalTypedWorkflowDefinition {
  workflowInteger(slaMinutes, 15, 525600, 'slaMinutes');
  return replaceStages({ ...definition, slaMinutes }, definition.stages);
}

export function setApprovalTypedWorkflowCondition(
  definition: ApprovalTypedWorkflowDefinition,
  key: string,
  condition?: unknown
): ApprovalTypedWorkflowDefinition {
  const index = stageAt(definition, key);
  const compiled =
    condition === undefined
      ? undefined
      : compileApprovalTypedWorkflowCondition(condition, 'routeCondition');
  return replaceStages(
    definition,
    definition.stages.map((stage, stageIndex) => {
      if (stageIndex !== index) return stage;
      return {
        key: stage.key,
        name: stage.name,
        candidateRole: stage.candidateRole,
        quorum: stage.quorum,
        slaMinutes: stage.slaMinutes,
        predecessors: stage.predecessors,
        ...(compiled === undefined ? {} : { routeCondition: compiled }),
      };
    })
  );
}
