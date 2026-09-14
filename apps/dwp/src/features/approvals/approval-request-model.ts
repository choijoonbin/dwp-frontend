import type {
  ApprovalFormField,
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalRequestStatus,
} from '@dwp-frontend/shared-utils';

import {
  approvalRequestLegacyValues,
  approvalRequestSchemaKind,
} from './approval-request-schema-model';
import { ApprovalTypedFormError } from './approval-form-typed-model';

export const APPROVAL_REQUEST_VIEW = {
  drafts: 'DRAFTS',
  submitted: 'SUBMITTED',
  'needs-info': 'NEEDS_INFO',
  archive: 'ARCHIVE',
} as const;

export type ApprovalRequestView = keyof typeof APPROVAL_REQUEST_VIEW;
export type ApprovalRequestCommand = 'EDIT' | 'SUBMIT' | 'RESPOND' | 'WITHDRAW';
export type ApprovalRequestRecovery = 'CONFLICT' | 'DENIED' | 'UNAVAILABLE' | 'ERROR';

export type ApprovalRequestDraftValues = Readonly<{
  formId: string;
  title: string;
  summary: string;
  priority: ApprovalRequest['priority'];
  payload: Record<string, string>;
}>;

export function approvalRequestRecovery(status?: number): ApprovalRequestRecovery {
  if (status === 409) return 'CONFLICT';
  if (status === 401 || status === 403 || status === 404) return 'DENIED';
  if (status === 503) return 'UNAVAILABLE';
  return 'ERROR';
}

export function approvalRequestDraftValues(
  detail: ApprovalRequestDetail
): ApprovalRequestDraftValues {
  if (['TYPED', 'UNSUPPORTED'].includes(approvalRequestSchemaKind(detail.formSchema))) {
    throw new ApprovalTypedFormError('Legacy draft conversion cannot reinterpret this form.');
  }
  return {
    formId: detail.formId,
    title: detail.request.title,
    summary: detail.request.summary,
    priority: detail.request.priority,
    payload: approvalRequestLegacyValues(
      Object.fromEntries(
        Object.entries(detail.payload).filter(
          ([key, value]) => !['summary', 'createdFrom'].includes(key) && value != null
        )
      )
    ),
  };
}

export function approvalRequestPayload(
  summary: string,
  values: Readonly<Record<string, string>>
): Record<string, string> {
  return {
    summary: summary.trim(),
    ...Object.fromEntries(
      Object.entries(values)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value.length > 0)
    ),
    createdFrom: 'DWP_APPROVALS',
  };
}

export function missingApprovalRequestFields(
  fields: readonly ApprovalFormField[],
  values: Readonly<Record<string, string>>
): ApprovalFormField[] {
  return fields.filter((field) => field.required && !values[field.key]?.trim());
}

export function approvalRequestCanSubmit(input: {
  contextReady: boolean;
  title: string;
  summary: string;
  fields: readonly ApprovalFormField[];
  values: Readonly<Record<string, string>>;
}): boolean {
  return (
    input.contextReady &&
    input.title.trim().length >= 2 &&
    input.summary.trim().length >= 2 &&
    missingApprovalRequestFields(input.fields, input.values).length === 0
  );
}

export function approvalRequestHasLocalChanges(values: ApprovalRequestDraftValues): boolean {
  return (
    values.formId.length > 0 ||
    values.title.trim().length > 0 ||
    values.summary.trim().length > 0 ||
    Object.values(values.payload).some((value) => value.trim().length > 0)
  );
}

export function approvalRequestNextCommand(
  status: ApprovalRequestStatus
): ApprovalRequestCommand | null {
  if (status === 'DRAFT') return 'EDIT';
  if (status === 'NEEDS_INFO') return 'RESPOND';
  if (status === 'SUBMITTED' || status === 'IN_REVIEW') return 'WITHDRAW';
  return null;
}

export function approvalRequestProgress(request: ApprovalRequest): number {
  if (request.status === 'APPROVED' || request.status === 'REJECTED') return 100;
  if (!request.totalSteps || !request.currentStepSequence) return 0;
  const completedSteps = Math.max(0, request.currentStepSequence - 1);
  return Math.min(99, Math.round((completedSteps / request.totalSteps) * 100));
}

export function isApprovalRequestSnapshotCurrent(
  current: readonly ApprovalRequest[] | undefined,
  snapshot: Pick<ApprovalRequest, 'requestId' | 'status' | 'version'>
): boolean {
  const authoritative = current?.find((request) => request.requestId === snapshot.requestId);
  return authoritative?.version === snapshot.version && authoritative.status === snapshot.status;
}

export function mergeApprovalResponseFields(
  schemaFields: readonly ApprovalFormField[],
  payload: Readonly<Record<string, string>>
): ApprovalFormField[] {
  const schemaKeys = new Set(schemaFields.map((field) => field.key));
  const legacyFields = Object.keys(payload)
    .filter((key) => key !== 'createdFrom' && !schemaKeys.has(key))
    .map<ApprovalFormField>((key) => ({
      key,
      type: key === 'summary' ? 'TEXTAREA' : 'TEXT',
      required: false,
    }));
  return [...schemaFields, ...legacyFields];
}
