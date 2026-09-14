export type ApprovalWorkflowRuntimePins = Readonly<{
  workflowVersionId: string;
  workflowVersion: number;
  workflowDefinitionSha256: string;
  formSchemaSha256: string;
  policyVersion: number;
  policySha256: string;
}>;
export type ApprovalQuorumTaskSnapshot = Readonly<{
  requestVersion: number;
  generation: number;
  stageVersion: number;
  pins: ApprovalWorkflowRuntimePins;
  payloadRevision: number;
  payloadSha256: string;
  principalPersonPublicId: string;
}>;
export type ApprovalQuorumVotePrecondition = Readonly<{
  expectedRequestVersion: number;
  generation: number;
  expectedStageVersion: number;
  pins: ApprovalWorkflowRuntimePins;
  payloadRevision: number;
  payloadSha256: string;
}>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha = /^[0-9a-f]{64}$/;
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
const version = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function readApprovalWorkflowRuntimePins(value: unknown): ApprovalWorkflowRuntimePins {
  if (
    !record(value, [
      'workflowVersionId',
      'workflowVersion',
      'workflowDefinitionSha256',
      'formSchemaSha256',
      'policyVersion',
      'policySha256',
    ]) ||
    typeof value.workflowVersionId !== 'string' ||
    !uuid.test(value.workflowVersionId) ||
    !positive(value.workflowVersion) ||
    !positive(value.policyVersion) ||
    typeof value.workflowDefinitionSha256 !== 'string' ||
    !sha.test(value.workflowDefinitionSha256) ||
    typeof value.formSchemaSha256 !== 'string' ||
    !sha.test(value.formSchemaSha256) ||
    typeof value.policySha256 !== 'string' ||
    !sha.test(value.policySha256)
  )
    throw new Error('Invalid approval workflow pins');
  return Object.freeze({
    workflowVersionId: value.workflowVersionId,
    workflowVersion: value.workflowVersion,
    workflowDefinitionSha256: value.workflowDefinitionSha256,
    formSchemaSha256: value.formSchemaSha256,
    policyVersion: value.policyVersion,
    policySha256: value.policySha256,
  });
}
export function readApprovalQuorumTaskSnapshot(value: unknown): ApprovalQuorumTaskSnapshot | null {
  if (value == null) return null;
  if (
    !record(value, [
      'requestVersion',
      'generation',
      'stageVersion',
      'pins',
      'payloadRevision',
      'payloadSha256',
      'principalPersonPublicId',
    ]) ||
    !version(value.requestVersion) ||
    !positive(value.generation) ||
    !positive(value.stageVersion) ||
    !positive(value.payloadRevision) ||
    typeof value.payloadSha256 !== 'string' ||
    !sha.test(value.payloadSha256) ||
    typeof value.principalPersonPublicId !== 'string' ||
    !uuid.test(value.principalPersonPublicId)
  )
    throw new Error('Invalid approval quorum snapshot');
  const pins = readApprovalWorkflowRuntimePins(value.pins);
  return Object.freeze({
    requestVersion: value.requestVersion,
    generation: value.generation,
    stageVersion: value.stageVersion,
    payloadRevision: value.payloadRevision,
    payloadSha256: value.payloadSha256,
    principalPersonPublicId: value.principalPersonPublicId,
    pins,
  });
}
export function readApprovalQuorumVotePrecondition(value: unknown): ApprovalQuorumVotePrecondition {
  if (
    !record(value, [
      'expectedRequestVersion',
      'generation',
      'expectedStageVersion',
      'pins',
      'payloadRevision',
      'payloadSha256',
    ]) ||
    !version(value.expectedRequestVersion) ||
    !positive(value.generation) ||
    !positive(value.expectedStageVersion) ||
    !positive(value.payloadRevision) ||
    typeof value.payloadSha256 !== 'string' ||
    !sha.test(value.payloadSha256)
  )
    throw new Error('Invalid approval quorum command');
  return Object.freeze({
    expectedRequestVersion: value.expectedRequestVersion,
    generation: value.generation,
    expectedStageVersion: value.expectedStageVersion,
    pins: readApprovalWorkflowRuntimePins(value.pins),
    payloadRevision: value.payloadRevision,
    payloadSha256: value.payloadSha256,
  });
}
export function sameApprovalQuorumTaskSnapshot(
  previous: ApprovalQuorumTaskSnapshot | null | undefined,
  current: ApprovalQuorumTaskSnapshot | null | undefined
) {
  const a = readApprovalQuorumTaskSnapshot(previous),
    b = readApprovalQuorumTaskSnapshot(current);
  if (!a || !b) return a === b;
  return (
    a.requestVersion === b.requestVersion &&
    a.generation === b.generation &&
    a.stageVersion === b.stageVersion &&
    a.payloadRevision === b.payloadRevision &&
    a.payloadSha256 === b.payloadSha256 &&
    a.principalPersonPublicId === b.principalPersonPublicId &&
    Object.keys(a.pins).every(
      (key) =>
        a.pins[key as keyof ApprovalWorkflowRuntimePins] ===
        b.pins[key as keyof ApprovalWorkflowRuntimePins]
    )
  );
}
export function approvalQuorumVotePrecondition(
  snapshot: ApprovalQuorumTaskSnapshot | null | undefined
): ApprovalQuorumVotePrecondition | undefined {
  const value = readApprovalQuorumTaskSnapshot(snapshot);
  return value
    ? Object.freeze({
        expectedRequestVersion: value.requestVersion,
        generation: value.generation,
        expectedStageVersion: value.stageVersion,
        pins: value.pins,
        payloadRevision: value.payloadRevision,
        payloadSha256: value.payloadSha256,
      })
    : undefined;
}
