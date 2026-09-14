import { captureApprovalWorkflowPlanningInput } from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';
import { evaluateApprovalTypedForm } from './approval-form-typed-evaluator';
import type { ApprovalTypedWorkflowDefinition } from '@dwp-frontend/shared-utils/api/approval-workflow-typed-contract';
import type {
  ApprovalWorkflowPlanningSelection,
  ApprovalWorkflowPlanningFormPin,
  ApprovalWorkflowPlanningResult,
} from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';
import type { ApprovalWorkflowFormSourcePin } from './approval-workflow-typed-source';

export type ApprovalWorkflowPlanningOwner = Readonly<{
  workflowId: string;
  workflowRevision: number;
  workflowSha256: string;
  definition: ApprovalTypedWorkflowDefinition;
}>;
export function planningOwnerMatches(
  owner: ApprovalWorkflowPlanningOwner,
  selection: ApprovalWorkflowPlanningSelection
) {
  return (
    owner.workflowId === selection.workflowId &&
    owner.workflowRevision === selection.workflowRevision &&
    owner.workflowSha256 === selection.workflowSha256
  );
}
export function planningSelectionMatches(
  left: ApprovalWorkflowPlanningSelection,
  right: ApprovalWorkflowPlanningSelection
) {
  return (
    left.workflowId === right.workflowId &&
    left.workflowVersionId === right.workflowVersionId &&
    left.workflowRevision === right.workflowRevision &&
    left.workflowSha256 === right.workflowSha256 &&
    left.managementResourceSetKey === right.managementResourceSetKey &&
    left.policy.version === right.policy.version &&
    left.policy.sha256 === right.policy.sha256 &&
    left.selectedFormId === right.selectedFormId &&
    left.forms.length === right.forms.length &&
    left.forms.every((form) =>
      right.forms.some(
        (other) =>
          form.formId === other.formId &&
          form.formVersionId === other.formVersionId &&
          form.formRevision === other.formRevision &&
          form.formVersion === other.formVersion &&
          form.formSchemaSha256 === other.formSchemaSha256
      )
    )
  );
}
export function planningFormMatches(
  expected: ApprovalWorkflowPlanningFormPin,
  actual: ApprovalWorkflowFormSourcePin
) {
  return (
    expected.formId === actual.formId &&
    expected.formVersionId === actual.formVersionId &&
    expected.formRevision === actual.version &&
    expected.formVersion === actual.currentVersion &&
    expected.formSchemaSha256 === actual.schemaHash
  );
}
export function planningInput(
  selection: ApprovalWorkflowPlanningSelection,
  compiled: CompiledApprovalTypedForm,
  raw: unknown
) {
  const form = selection.forms.find((form) => form.formId === selection.selectedFormId);
  if (!form || form.formSchemaSha256 !== compiled.schemaSha256)
    throw new Error('Planning form pin changed');
  return captureApprovalWorkflowPlanningInput({
    workflowRevision: selection.workflowRevision,
    workflowSha256: selection.workflowSha256,
    formVersionId: form.formVersionId,
    formSchemaSha256: form.formSchemaSha256,
    policyVersion: selection.policy.version,
    policySha256: selection.policy.sha256,
    managementResourceSetKey: selection.managementResourceSetKey,
    samplePayload: evaluateApprovalTypedForm(compiled, raw, 'SUBMIT').payload,
  });
}
/** A role pool preview is never an admission or a live request quorum. */
export function planningResultMatches(
  owner: ApprovalWorkflowPlanningOwner,
  result: ApprovalWorkflowPlanningResult
) {
  return (
    result.stages.length === owner.definition.stages.length &&
    result.stages.every((stage) => {
      const expected = owner.definition.stages.find((value) => value.key === stage.stepKey);
      return (
        expected &&
        expected.candidateRole === stage.roleCode &&
        expected.quorum.mode === stage.quorumMode &&
        ('value' in expected.quorum
          ? expected.quorum.value === stage.quorumValue
          : stage.quorumValue == null) &&
        expected.predecessors.length === stage.predecessors.length &&
        expected.predecessors.every((key) => stage.predecessors.includes(key))
      );
    })
  );
}
