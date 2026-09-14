import {
  compileApprovalTypedForm,
  requireApprovalTypedSummary,
} from './approval-form-typed-compiler';
import { evaluateApprovalTypedForm } from './approval-form-typed-evaluator';
import { ApprovalTypedFormError } from './approval-form-typed-model';
import { approvalRequestDraftValues, approvalRequestPayload } from './approval-request-model';
import { approvalRequestSchemaKind } from './approval-request-schema-model';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalDraftSnapshot } from './approval-request-autosave-model';

export function approvalRequestDetailSnapshot(
  detail: ApprovalRequestDetail
): ApprovalDraftSnapshot {
  const kind = approvalRequestSchemaKind(detail.formSchema);
  if (kind === 'UNSUPPORTED') throw new ApprovalTypedFormError('Unsupported receipt schema.');
  const values = kind === 'TYPED' ? undefined : approvalRequestDraftValues(detail);
  return {
    workflowId: detail.workflowId,
    formId: detail.formId,
    title: detail.request.title.trim(),
    summary: detail.request.summary.trim(),
    priority: detail.request.priority,
    payload: values
      ? approvalRequestPayload(values.summary, values.payload)
      : {
          ...structuredClone(detail.payload),
          summary: detail.request.summary.trim(),
          createdFrom: 'DWP_APPROVALS',
        },
  };
}

export async function approvalRequestVerifiedDetailSnapshot(
  detail: ApprovalRequestDetail
): Promise<ApprovalDraftSnapshot> {
  const snapshot = approvalRequestDetailSnapshot(detail);
  if (approvalRequestSchemaKind(detail.formSchema) !== 'TYPED') return snapshot;
  const compiled = await compileApprovalTypedForm(detail.formSchema);
  requireApprovalTypedSummary(compiled);
  return {
    ...snapshot,
    payload: evaluateApprovalTypedForm(compiled, snapshot.payload, 'DRAFT').payload,
  };
}
