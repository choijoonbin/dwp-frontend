import { APPROVAL_TYPED_WORKFLOW_CONTRACT } from '@dwp-frontend/shared-utils/api/approval-workflow-typed-contract';

import { typedJavaBlank } from './approval-form-typed-model';

import type {
  ApprovalTypedWorkflowDefinition,
  ApprovalTypedWorkflowQuorum,
} from '@dwp-frontend/shared-utils/api/approval-workflow-typed-contract';

export { APPROVAL_TYPED_WORKFLOW_CONTRACT };
export type {
  ApprovalTypedWorkflowQuorum,
  ApprovalTypedWorkflowScalar,
  ApprovalTypedWorkflowClause,
  ApprovalTypedWorkflowCondition,
  ApprovalTypedWorkflowStage,
  ApprovalTypedWorkflowDefinition,
} from '@dwp-frontend/shared-utils/api/approval-workflow-typed-contract';
export const APPROVAL_TYPED_WORKFLOW_MAX_STAGES = 64;
export const APPROVAL_TYPED_WORKFLOW_MAX_CANDIDATES = 1000;

export type ApprovalTypedWorkflowGraph = Readonly<{
  topologicalStageKeys: readonly string[];
  levels: readonly (readonly string[])[];
  longestPathMinutes: number;
}>;
export type CompiledApprovalTypedWorkflow = ApprovalTypedWorkflowGraph &
  Readonly<{
    definition: ApprovalTypedWorkflowDefinition;
    canonicalJson: string;
    definitionSha256: string;
  }>;

export class ApprovalTypedWorkflowError extends Error {
  constructor(
    readonly code: string,
    readonly path: string
  ) {
    super(`${code}: ${path}`);
    this.name = 'ApprovalTypedWorkflowError';
  }
}

export function workflowInvalid(code: string, path: string): never {
  throw new ApprovalTypedWorkflowError(code, path);
}

export function workflowObject(raw: unknown, path: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    workflowInvalid('object-required', path);
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null)
    workflowInvalid('plain-object-required', path);
  if (
    Object.getOwnPropertySymbols(raw).length > 0 ||
    Object.values(Object.getOwnPropertyDescriptors(raw)).some(
      (descriptor) => !('value' in descriptor) || !descriptor.enumerable
    )
  )
    workflowInvalid('json-properties-required', path);
  return raw as Record<string, unknown>;
}

export function workflowExactKeys(
  raw: Record<string, unknown>,
  keys: readonly string[],
  path: string
) {
  const actual = Object.keys(raw);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key)))
    workflowInvalid('properties-mismatch', path);
}

export function workflowInteger(
  raw: unknown,
  minimum: number,
  maximum: number,
  path: string
): number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < minimum || raw > maximum)
    workflowInvalid('integer-bounds', path);
  return raw;
}

export function workflowIdentifier(raw: unknown, path: string): string {
  if (typeof raw !== 'string' || !/^[A-Z][A-Z0-9_]{1,79}$/u.test(raw))
    workflowInvalid('identifier-invalid', path);
  return raw;
}

export function workflowJavaStrip(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && typedJavaBlank(text[start])) start++;
  while (end > start && typedJavaBlank(text[end - 1])) end--;
  return text.slice(start, end);
}

export function validateApprovalTypedWorkflowQuorum(
  raw: unknown,
  path = 'quorum'
): ApprovalTypedWorkflowQuorum {
  const value = workflowObject(raw, path);
  workflowExactKeys(value, Object.hasOwn(value, 'value') ? ['mode', 'value'] : ['mode'], path);
  if (value.mode === 'ANY' || value.mode === 'ALL') {
    if (Object.hasOwn(value, 'value')) workflowInvalid('quorum-argument', path);
    return value.mode === 'ANY' ? Object.freeze({ mode: 'ANY' }) : Object.freeze({ mode: 'ALL' });
  }
  if (value.mode === 'COUNT' || value.mode === 'PERCENT') {
    const count = workflowInteger(
      value.value,
      1,
      value.mode === 'COUNT' ? APPROVAL_TYPED_WORKFLOW_MAX_CANDIDATES : 100,
      `${path}.value`
    );
    return value.mode === 'COUNT'
      ? Object.freeze({ mode: 'COUNT', value: count })
      : Object.freeze({ mode: 'PERCENT', value: count });
  }
  return workflowInvalid('quorum-mode', `${path}.mode`);
}

/** Arithmetic only. A count supplied here is not evidence of a current authorized candidate pool. */
export function approvalTypedWorkflowThreshold(
  rule: ApprovalTypedWorkflowQuorum,
  candidateCount: number
): number {
  const quorum = validateApprovalTypedWorkflowQuorum(rule);
  const count = workflowInteger(
    candidateCount,
    1,
    APPROVAL_TYPED_WORKFLOW_MAX_CANDIDATES,
    'candidateCount'
  );
  const required =
    quorum.mode === 'ANY'
      ? 1
      : quorum.mode === 'ALL'
        ? count
        : quorum.mode === 'COUNT'
          ? quorum.value
          : Math.ceil((count * quorum.value) / 100);
  if (required > count) workflowInvalid('threshold-exceeds-pool', 'quorum.value');
  return required;
}
