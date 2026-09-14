import type { ApprovalWorkflowDetail } from './approval-management-contract';

export const APPROVAL_TYPED_WORKFLOW_CONTRACT = 'DWP_APPROVAL_WORKFLOW_QUORUM_V2';
export type ApprovalTypedWorkflowQuorum =
  | Readonly<{ mode: 'ANY' }>
  | Readonly<{ mode: 'ALL' }>
  | Readonly<{ mode: 'COUNT'; value: number }>
  | Readonly<{ mode: 'PERCENT'; value: number }>;
export type ApprovalTypedWorkflowScalar = string | boolean | number;
export type ApprovalTypedWorkflowClause =
  | Readonly<{
      field: string;
      operator: 'EQ' | 'GT' | 'GTE' | 'LT' | 'LTE';
      value: ApprovalTypedWorkflowScalar;
    }>
  | Readonly<{ field: string; operator: 'IN'; value: readonly ApprovalTypedWorkflowScalar[] }>;
export type ApprovalTypedWorkflowCondition = Readonly<{
  all: readonly ApprovalTypedWorkflowClause[];
}>;
export type ApprovalTypedWorkflowStage = Readonly<{
  key: string;
  name: string;
  candidateRole: string;
  quorum: ApprovalTypedWorkflowQuorum;
  slaMinutes: number;
  predecessors: readonly string[];
  routeCondition?: ApprovalTypedWorkflowCondition;
}>;
export type ApprovalTypedWorkflowDefinition = Readonly<{
  schemaContract: typeof APPROVAL_TYPED_WORKFLOW_CONTRACT;
  schemaVersion: 2;
  slaMinutes: number;
  stages: readonly ApprovalTypedWorkflowStage[];
}>;
export type ApprovalTypedWorkflowDetail = Omit<ApprovalWorkflowDetail, 'definition'> &
  Readonly<{
    definition: ApprovalTypedWorkflowDefinition;
  }>;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
function keys(value: Record<string, unknown>, expected: readonly string[]) {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeJson);
    Object.freeze(value);
  }
  return value;
}

/** Transport shape only; graph, field conditions and current authority are validated by their owners. */
export function captureApprovalTypedWorkflowDefinition(
  value: unknown
): ApprovalTypedWorkflowDefinition {
  if (
    !record(value) ||
    !keys(value, ['schemaContract', 'schemaVersion', 'slaMinutes', 'stages']) ||
    value.schemaContract !== APPROVAL_TYPED_WORKFLOW_CONTRACT ||
    value.schemaVersion !== 2 ||
    !integer(value.slaMinutes, 15, 525600) ||
    !Array.isArray(value.stages) ||
    value.stages.length < 1 ||
    value.stages.length > 64
  )
    throw new Error('Invalid typed workflow transport');
  for (const stage of value.stages) {
    const properties = ['key', 'name', 'candidateRole', 'quorum', 'slaMinutes', 'predecessors'];
    if (!record(stage)) throw new Error('Invalid typed workflow stage');
    if (Object.hasOwn(stage, 'routeCondition')) properties.push('routeCondition');
    if (
      !keys(stage, properties) ||
      typeof stage.key !== 'string' ||
      typeof stage.name !== 'string' ||
      typeof stage.candidateRole !== 'string' ||
      !integer(stage.slaMinutes, 15, 525600) ||
      !Array.isArray(stage.predecessors) ||
      stage.predecessors.length > 64 ||
      stage.predecessors.some((key: unknown) => typeof key !== 'string') ||
      !record(stage.quorum)
    )
      throw new Error('Invalid typed workflow stage transport');
    const quorum = stage.quorum;
    if (quorum.mode === 'ANY' || quorum.mode === 'ALL') {
      if (!keys(quorum, ['mode'])) throw new Error('Unexpected quorum argument');
    } else if (quorum.mode === 'COUNT' || quorum.mode === 'PERCENT') {
      if (
        !keys(quorum, ['mode', 'value']) ||
        !integer(quorum.value, 1, quorum.mode === 'PERCENT' ? 100 : 1000)
      )
        throw new Error('Invalid quorum threshold');
    } else throw new Error('Unsupported quorum mode');
    if (Object.hasOwn(stage, 'routeCondition') && !record(stage.routeCondition))
      throw new Error('Invalid workflow condition transport');
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > 131072) throw new Error('Workflow transport exceeds the input limit');
  return freezeJson(JSON.parse(serialized) as ApprovalTypedWorkflowDefinition);
}

export function readApprovalTypedWorkflowDetail(
  value: unknown
): ApprovalTypedWorkflowDetail | null {
  if (!record(value) || !record(value.definition)) throw new Error('Invalid workflow detail');
  if (!Object.hasOwn(value.definition, 'schemaContract')) return null;
  const definition = captureApprovalTypedWorkflowDefinition(value.definition);
  if (
    !record(value.workflow) ||
    typeof value.definitionHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.definitionHash)
  )
    throw new Error('Invalid typed workflow owner projection');
  return Object.freeze({ ...value, definition }) as ApprovalTypedWorkflowDetail;
}
