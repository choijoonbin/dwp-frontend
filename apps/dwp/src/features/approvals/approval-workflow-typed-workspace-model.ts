import { readApprovalTypedWorkflowDetail } from '@dwp-frontend/shared-utils/api/approval-workflow-typed-contract';

import {
  compileApprovalTypedWorkflow,
  validateApprovalTypedWorkflow,
} from './approval-workflow-typed-compiler';
import { createApprovalTypedWorkflowSeed } from './approval-workflow-typed-editor-model';
import { validateApprovalTypedWorkflowRouteFields } from './approval-workflow-typed-conditions';
import {
  approvalWorkflowMetadataIssues,
  isApprovalWorkflowDraftValid,
  createApprovalWorkflowDraftSeed,
} from './approval-workflow-model';

import type { ApprovalWorkflowDraft } from './approval-workflow-model';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';
import type { ApprovalTypedWorkflowDetail } from '@dwp-frontend/shared-utils/api/approval-workflow-typed-contract';
import type {
  ApprovalWorkflowDetail,
  ApprovalTypedWorkflowDraftInput,
} from '@dwp-frontend/shared-utils';

export type ApprovalTypedWorkflowDraft = ApprovalTypedWorkflowDraftInput & { workflowKey: string };
export type ApprovalWorkflowWorkspaceDraft = ApprovalWorkflowDraft | ApprovalTypedWorkflowDraft;
export type ApprovalWorkflowOwnerDetail =
  (ApprovalWorkflowDetail & { kind: 'legacy' }) | (ApprovalTypedWorkflowDetail & { kind: 'typed' });

export function isApprovalTypedWorkflowDraft(
  draft: ApprovalWorkflowWorkspaceDraft
): draft is ApprovalTypedWorkflowDraft {
  return draft.typedDefinition !== undefined;
}

export async function captureApprovalWorkflowOwnerDetail(
  detail: ApprovalWorkflowDetail | ApprovalTypedWorkflowDetail
): Promise<ApprovalWorkflowOwnerDetail> {
  const typed = readApprovalTypedWorkflowDetail(detail);
  if (!typed) {
    if (!('steps' in detail.definition)) throw new Error('Legacy workflow steps missing');
    return { ...detail, definition: detail.definition, kind: 'legacy' };
  }
  const compiled = await compileApprovalTypedWorkflow(typed.definition);
  if (
    compiled.definitionSha256 !== typed.definitionHash ||
    typed.workflow.slaMinutes !== compiled.definition.slaMinutes
  )
    throw new Error('Workflow owner definition mismatch');
  if (compiled.definition.stages.some((stage) => stage.candidateRole.length > 50))
    throw new Error('Unsupported role code');
  return Object.freeze({ ...typed, definition: compiled.definition, kind: 'typed' });
}

export function approvalWorkflowOwnerDraft(
  detail: ApprovalWorkflowOwnerDetail
): ApprovalWorkflowWorkspaceDraft {
  const workflow = detail.workflow;
  const metadata = {
    workflowKey: workflow.workflowKey,
    nameKo: workflow.nameKo,
    nameEn: workflow.nameEn,
    descriptionKo: workflow.descriptionKo,
    descriptionEn: workflow.descriptionEn,
    category: workflow.category,
    dataClassification: workflow.dataClassification,
    slaMinutes: workflow.slaMinutes,
    ownerGroupRef: workflow.ownerGroupRef ?? '',
  };
  return detail.kind === 'typed'
    ? { ...metadata, typedDefinition: detail.definition }
    : { ...metadata, steps: detail.definition.steps.map((step) => ({ ...step })) };
}

export function createApprovalWorkflowWorkspaceSeed(
  mode: 'legacy' | 'typed'
): ApprovalWorkflowWorkspaceDraft {
  const { steps: _steps, ...metadata } = createApprovalWorkflowDraftSeed();
  return mode === 'legacy'
    ? createApprovalWorkflowDraftSeed()
    : {
        ...metadata,
        ownerGroupRef: '',
        typedDefinition: createApprovalTypedWorkflowSeed(),
      };
}

export function approvalTypedWorkflowDraftValid(
  draft: ApprovalTypedWorkflowDraft,
  schema?: CompiledApprovalTypedForm
): boolean {
  if (
    approvalWorkflowMetadataIssues(draft).length ||
    draft.slaMinutes !== draft.typedDefinition.slaMinutes
  )
    return false;
  try {
    const definition = validateApprovalTypedWorkflow(draft.typedDefinition);
    return (
      definition.stages.every((stage) => stage.candidateRole.length <= 50) &&
      validateApprovalTypedWorkflowRouteFields(definition, schema) !== 'SOURCE_UNKNOWN'
    );
  } catch {
    return false;
  }
}

export function approvalWorkflowWorkspaceValid(
  draft: ApprovalWorkflowWorkspaceDraft,
  schema?: CompiledApprovalTypedForm
) {
  return isApprovalTypedWorkflowDraft(draft)
    ? approvalTypedWorkflowDraftValid(draft, schema)
    : isApprovalWorkflowDraftValid(draft);
}
