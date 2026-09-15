import { axiosInstance } from '../axios-instance';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type { ApprovalRequest } from './approval-request-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,120}$/u;
const REQUEST_STATUSES = new Set([
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'NEEDS_INFO',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
  'CANCELLED',
]);
const PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export type ApprovalResubmitDraftResponse = Readonly<{
  draft: ApprovalRequest;
  sourceRequestId: string;
  sourceVersion: number;
}>;

export type ApprovalResubmitDraftOptions = Readonly<{
  idempotencyKey: string;
  contextScopeKey?: string;
  signal?: AbortSignal;
  beforeDispatch: () => void;
}>;

function invalid(): never {
  throw new TypeError('Invalid approval resubmission draft contract.');
}

function safeVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function optionalString(value: unknown): value is string | null | undefined {
  return value == null || typeof value === 'string';
}

function readRequest(value: unknown): ApprovalRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const request = value as Record<string, unknown>;
  if (
    typeof request.requestId !== 'string' ||
    !UUID.test(request.requestId) ||
    typeof request.requestNumber !== 'string' ||
    typeof request.title !== 'string' ||
    typeof request.summary !== 'string' ||
    typeof request.workflowNameKo !== 'string' ||
    typeof request.workflowNameEn !== 'string' ||
    !optionalString(request.currentStepKey) ||
    !optionalString(request.currentStepName) ||
    !(
      request.currentStepSequence == null ||
      (Number.isSafeInteger(request.currentStepSequence) &&
        Number(request.currentStepSequence) >= 0)
    ) ||
    !Number.isSafeInteger(request.totalSteps) ||
    Number(request.totalSteps) < 0 ||
    typeof request.status !== 'string' ||
    !REQUEST_STATUSES.has(request.status) ||
    typeof request.priority !== 'string' ||
    !PRIORITIES.has(request.priority) ||
    typeof request.dataClassification !== 'string' ||
    !optionalString(request.latestInformationRequest) ||
    !optionalString(request.submittedAt) ||
    !optionalString(request.dueAt) ||
    !optionalString(request.completedAt) ||
    !safeVersion(request.version)
  )
    invalid();
  return request as ApprovalRequest;
}

function readResponse(
  value: unknown,
  expectedSourceRequestId: string,
  expectedSourceVersion: number
): ApprovalResubmitDraftResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const response = value as Record<string, unknown>;
  if (
    response.sourceRequestId !== expectedSourceRequestId ||
    response.sourceVersion !== expectedSourceVersion
  )
    invalid();
  const draft = readRequest(response.draft);
  if (draft.status !== 'DRAFT') invalid();
  return Object.freeze({
    draft: Object.freeze({ ...draft }),
    sourceRequestId: expectedSourceRequestId,
    sourceVersion: expectedSourceVersion,
  });
}

export async function createApprovalResubmitDraft(
  sourceRequestId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution,
  options: ApprovalResubmitDraftOptions
): Promise<ApprovalResubmitDraftResponse> {
  if (
    !UUID.test(sourceRequestId) ||
    !safeVersion(expectedVersion) ||
    !IDEMPOTENCY_KEY.test(options.idempotencyKey) ||
    typeof options.beforeDispatch !== 'function' ||
    (execution.mode === 'SECURE' &&
      (execution.contextScopeKey !== options.contextScopeKey ||
        (execution.idempotencyKey !== undefined &&
          execution.idempotencyKey !== options.idempotencyKey)))
  )
    invalid();
  const authority =
    execution.mode === 'SECURE'
      ? Object.freeze({ ...execution, idempotencyKey: options.idempotencyKey })
      : execution;
  const config = approvalMutationExecutionConfig(authority);
  options.beforeDispatch();
  const response = await axiosInstance.post<ApiResponse<unknown>, { expectedVersion: number }>(
    `/api/approvals/v1/requests/${sourceRequestId}/resubmit-draft`,
    { expectedVersion },
    {
      ...config,
      contextScopeKey: config.contextScopeKey ?? options.contextScopeKey,
      headers: { ...config.headers, 'Idempotency-Key': options.idempotencyKey },
      signal: options.signal,
      timeoutMs: 10_000,
      csrfReplay: 'NEVER',
      beforeDispatch: options.beforeDispatch,
    }
  );
  options.beforeDispatch();
  return readResponse(response.data.data, sourceRequestId, expectedVersion);
}
