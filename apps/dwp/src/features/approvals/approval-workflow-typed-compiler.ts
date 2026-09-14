import { typedJavaBlank } from './approval-form-typed-model';
import { compileApprovalTypedWorkflowCondition } from './approval-workflow-typed-conditions';
import { analyzeApprovalTypedWorkflowGraph } from './approval-workflow-typed-graph';
import {
  APPROVAL_TYPED_WORKFLOW_CONTRACT,
  APPROVAL_TYPED_WORKFLOW_MAX_STAGES,
  validateApprovalTypedWorkflowQuorum,
  workflowExactKeys,
  workflowIdentifier,
  workflowInteger,
  workflowInvalid,
  workflowJavaStrip,
  workflowObject,
} from './approval-workflow-typed-model';

import type {
  ApprovalTypedWorkflowDefinition,
  ApprovalTypedWorkflowStage,
  CompiledApprovalTypedWorkflow,
} from './approval-workflow-typed-model';

/** Closed object AST only. Raw JSON strings are intentionally not parsed with a duplicate-key-losing parser. */
export function validateApprovalTypedWorkflow(raw: unknown): ApprovalTypedWorkflowDefinition {
  const definition = workflowObject(raw, 'workflow');
  workflowExactKeys(
    definition,
    ['schemaContract', 'schemaVersion', 'slaMinutes', 'stages'],
    'workflow'
  );
  if (definition.schemaContract !== APPROVAL_TYPED_WORKFLOW_CONTRACT)
    workflowInvalid('contract-marker', 'schemaContract');
  workflowInteger(definition.schemaVersion, 2, 2, 'schemaVersion');
  const slaMinutes = workflowInteger(definition.slaMinutes, 15, 525600, 'slaMinutes');
  if (
    !Array.isArray(definition.stages) ||
    definition.stages.length < 1 ||
    definition.stages.length > APPROVAL_TYPED_WORKFLOW_MAX_STAGES
  )
    workflowInvalid('stage-count', 'stages');
  const stages = Array.from(definition.stages).map(
    (rawStage, index): ApprovalTypedWorkflowStage => {
      const path = `stages[${index}]`;
      const value = workflowObject(rawStage, path);
      const conditioned = Object.hasOwn(value, 'routeCondition');
      workflowExactKeys(
        value,
        [
          'key',
          'name',
          'candidateRole',
          'quorum',
          'slaMinutes',
          'predecessors',
          ...(conditioned ? ['routeCondition'] : []),
        ],
        path
      );
      const key = workflowIdentifier(value.key, `${path}.key`);
      const candidateRole = workflowIdentifier(value.candidateRole, `${path}.candidateRole`);
      if (
        typeof value.name !== 'string' ||
        typedJavaBlank(value.name) ||
        value.name.length > 120 ||
        value.name !== workflowJavaStrip(value.name)
      )
        workflowInvalid('stage-name', `${path}.name`);
      if (!Array.isArray(value.predecessors))
        workflowInvalid('predecessor-count', `${path}.predecessors`);
      return Object.freeze({
        key,
        name: value.name,
        candidateRole,
        quorum: validateApprovalTypedWorkflowQuorum(value.quorum, `${path}.quorum`),
        slaMinutes: workflowInteger(value.slaMinutes, 15, 525600, `${path}.slaMinutes`),
        predecessors: Object.freeze(
          Array.from(value.predecessors).map((entry, predecessorIndex) =>
            workflowIdentifier(entry, `${path}.predecessors[${predecessorIndex}]`)
          )
        ),
        ...(conditioned
          ? {
              routeCondition: compileApprovalTypedWorkflowCondition(
                value.routeCondition,
                `${path}.routeCondition`
              ),
            }
          : {}),
      });
    }
  );
  analyzeApprovalTypedWorkflowGraph(stages, slaMinutes);
  return Object.freeze({
    schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT,
    schemaVersion: 2,
    slaMinutes,
    stages: Object.freeze(stages),
  });
}

// Jackson uses uppercase hexadecimal control escapes; array order is preserved in the server hash.
function canonicalJson(raw: unknown): string {
  if (typeof raw === 'string') {
    const escapes: Record<string, string> = {
      '"': '\\"',
      '\\': '\\\\',
      '\b': '\\b',
      '\f': '\\f',
      '\n': '\\n',
      '\r': '\\r',
      '\t': '\\t',
    };
    return `"${Array.from(raw)
      .map((character) => {
        if (Object.hasOwn(escapes, character)) return escapes[character];
        const code = character.charCodeAt(0);
        return code < 32 ? `\\u${code.toString(16).toUpperCase().padStart(4, '0')}` : character;
      })
      .join('')}"`;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') return JSON.stringify(raw);
  if (Array.isArray(raw)) return `[${Array.from(raw).map(canonicalJson).join(',')}]`;
  const object = workflowObject(raw, 'canonical');
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${canonicalJson(key)}:${canonicalJson(object[key])}`)
    .join(',')}}`;
}

/** A client digest is useful for local edit fencing, never a replacement for the server hash/capability. */
export async function compileApprovalTypedWorkflow(
  raw: unknown
): Promise<CompiledApprovalTypedWorkflow> {
  const definition = validateApprovalTypedWorkflow(raw);
  const graph = analyzeApprovalTypedWorkflowGraph(definition.stages, definition.slaMinutes);
  const json = canonicalJson(definition);
  if (json.length > 131072) workflowInvalid('definition-size', 'workflow');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  const definitionSha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return Object.freeze({ ...graph, definition, canonicalJson: json, definitionSha256 });
}
