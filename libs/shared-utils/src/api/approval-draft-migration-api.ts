import { axiosInstance } from '../axios-instance';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type { ApprovalRequest } from './approval-request-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[a-f0-9]{64}$/u;
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

export type ApprovalDraftMigrationBinding = Readonly<{
  formId: string;
  formVersionId: string;
  formVersion: number;
  formSchemaSha256: string;
  formNameKo: string;
  formNameEn: string;
  workflowId: string;
  workflowVersionId: string;
  workflowVersion: number;
  workflowDefinitionSha256: string;
  workflowNameKo: string;
  workflowNameEn: string;
}>;

export type ApprovalDraftMigrationPreview = Readonly<{
  sourceRequestId: string;
  sourceVersion: number;
  source: ApprovalDraftMigrationBinding;
  target: ApprovalDraftMigrationBinding;
  migrationRequired: boolean;
  routeCompatible: boolean;
  mappedFields: readonly string[];
  droppedFields: readonly string[];
  incompatibleFields: readonly string[];
  requiredFieldsToComplete: readonly string[];
  evaluatedAt: string;
}>;

export type ApprovalDraftMigrationInput = Readonly<{
  expectedVersion: number;
  targetFormId: string;
  targetFormVersionId: string;
  targetFormSchemaSha256: string;
  targetWorkflowId: string;
  targetWorkflowVersionId: string;
  targetWorkflowDefinitionSha256: string;
  reason: string;
}>;

export type ApprovalDraftMigrationResult = Readonly<{
  draft: ApprovalRequest;
  sourceRequestId: string;
  sourceVersion: number;
  target: ApprovalDraftMigrationBinding;
  mappedFields: readonly string[];
  droppedFields: readonly string[];
  incompatibleFields: readonly string[];
  requiredFieldsToComplete: readonly string[];
}>;

export type ApprovalDraftMigrationReadOptions = Readonly<{
  contextScopeKey?: string;
  signal?: AbortSignal;
  beforeDispatch?: () => void;
}>;

export type ApprovalDraftMigrationCommandOptions = Readonly<{
  idempotencyKey: string;
  beforeDispatch: () => void;
}>;

function invalid(): never {
  throw new TypeError('Invalid approval draft migration contract.');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function safeVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function optionalString(value: unknown): value is string | null | undefined {
  return value == null || typeof value === 'string';
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim())) {
    invalid();
  }
  const items = value as string[];
  if (new Set(items).size !== items.length) invalid();
  return Object.freeze([...items]);
}

function binding(value: unknown): ApprovalDraftMigrationBinding {
  const data = record(value);
  if (
    typeof data.formId !== 'string' ||
    !UUID.test(data.formId) ||
    typeof data.formVersionId !== 'string' ||
    !UUID.test(data.formVersionId) ||
    !safeVersion(data.formVersion) ||
    typeof data.formSchemaSha256 !== 'string' ||
    !SHA256.test(data.formSchemaSha256) ||
    typeof data.formNameKo !== 'string' ||
    typeof data.formNameEn !== 'string' ||
    typeof data.workflowId !== 'string' ||
    !UUID.test(data.workflowId) ||
    typeof data.workflowVersionId !== 'string' ||
    !UUID.test(data.workflowVersionId) ||
    !safeVersion(data.workflowVersion) ||
    typeof data.workflowDefinitionSha256 !== 'string' ||
    !SHA256.test(data.workflowDefinitionSha256) ||
    typeof data.workflowNameKo !== 'string' ||
    typeof data.workflowNameEn !== 'string'
  ) {
    invalid();
  }
  return Object.freeze({ ...(data as ApprovalDraftMigrationBinding) });
}

function request(value: unknown): ApprovalRequest {
  const data = record(value);
  if (
    typeof data.requestId !== 'string' ||
    !UUID.test(data.requestId) ||
    typeof data.requestNumber !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.summary !== 'string' ||
    typeof data.workflowNameKo !== 'string' ||
    typeof data.workflowNameEn !== 'string' ||
    !optionalString(data.currentStepKey) ||
    !optionalString(data.currentStepName) ||
    !(data.currentStepSequence == null || safeVersion(data.currentStepSequence)) ||
    !safeVersion(data.totalSteps) ||
    typeof data.status !== 'string' ||
    !REQUEST_STATUSES.has(data.status) ||
    typeof data.priority !== 'string' ||
    !PRIORITIES.has(data.priority) ||
    typeof data.dataClassification !== 'string' ||
    !optionalString(data.latestInformationRequest) ||
    !optionalString(data.submittedAt) ||
    !optionalString(data.dueAt) ||
    !optionalString(data.completedAt) ||
    !safeVersion(data.version)
  ) {
    invalid();
  }
  return Object.freeze({ ...(data as ApprovalRequest) });
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function readPreview(
  value: unknown,
  sourceRequestId: string,
  targetFormId: string,
  targetWorkflowId: string
): ApprovalDraftMigrationPreview {
  const data = record(value);
  const source = binding(data.source);
  const target = binding(data.target);
  if (
    data.sourceRequestId !== sourceRequestId ||
    !safeVersion(data.sourceVersion) ||
    target.formId !== targetFormId ||
    target.workflowId !== targetWorkflowId ||
    typeof data.migrationRequired !== 'boolean' ||
    typeof data.routeCompatible !== 'boolean' ||
    !instant(data.evaluatedAt)
  ) {
    invalid();
  }
  return Object.freeze({
    sourceRequestId,
    sourceVersion: data.sourceVersion,
    source,
    target,
    migrationRequired: data.migrationRequired,
    routeCompatible: data.routeCompatible,
    mappedFields: stringList(data.mappedFields),
    droppedFields: stringList(data.droppedFields),
    incompatibleFields: stringList(data.incompatibleFields),
    requiredFieldsToComplete: stringList(data.requiredFieldsToComplete),
    evaluatedAt: data.evaluatedAt,
  });
}

function sameTarget(left: ApprovalDraftMigrationBinding, input: ApprovalDraftMigrationInput) {
  return (
    left.formId === input.targetFormId &&
    left.formVersionId === input.targetFormVersionId &&
    left.formSchemaSha256 === input.targetFormSchemaSha256 &&
    left.workflowId === input.targetWorkflowId &&
    left.workflowVersionId === input.targetWorkflowVersionId &&
    left.workflowDefinitionSha256 === input.targetWorkflowDefinitionSha256
  );
}

function readResult(
  value: unknown,
  sourceRequestId: string,
  input: ApprovalDraftMigrationInput
): ApprovalDraftMigrationResult {
  const data = record(value);
  const draft = request(data.draft);
  const target = binding(data.target);
  if (
    data.sourceRequestId !== sourceRequestId ||
    data.sourceVersion !== input.expectedVersion ||
    draft.requestId === sourceRequestId ||
    draft.status !== 'DRAFT' ||
    !sameTarget(target, input)
  ) {
    invalid();
  }
  return Object.freeze({
    draft,
    sourceRequestId,
    sourceVersion: input.expectedVersion,
    target,
    mappedFields: stringList(data.mappedFields),
    droppedFields: stringList(data.droppedFields),
    incompatibleFields: stringList(data.incompatibleFields),
    requiredFieldsToComplete: stringList(data.requiredFieldsToComplete),
  });
}

export function approvalDraftMigrationPreviewFingerprint(
  preview: ApprovalDraftMigrationPreview
): string {
  return JSON.stringify([
    preview.sourceRequestId,
    preview.sourceVersion,
    preview.source,
    preview.target,
    preview.migrationRequired,
    preview.routeCompatible,
    preview.mappedFields,
    preview.droppedFields,
    preview.incompatibleFields,
    preview.requiredFieldsToComplete,
  ]);
}

export async function getApprovalDraftMigrationPreview(
  sourceRequestId: string,
  targetFormId: string,
  targetWorkflowId: string,
  options: ApprovalDraftMigrationReadOptions = {}
): Promise<ApprovalDraftMigrationPreview> {
  if (!UUID.test(sourceRequestId) || !UUID.test(targetFormId) || !UUID.test(targetWorkflowId)) {
    invalid();
  }
  const query = new URLSearchParams({ targetFormId, targetWorkflowId });
  options.beforeDispatch?.();
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/approvals/v1/requests/${sourceRequestId}/draft/migration-preview?${query.toString()}`,
    options
  );
  options.beforeDispatch?.();
  return readPreview(response.data.data, sourceRequestId, targetFormId, targetWorkflowId);
}

export async function migrateApprovalDraft(
  sourceRequestId: string,
  input: ApprovalDraftMigrationInput,
  execution: ApprovalMutationExecution,
  options: ApprovalDraftMigrationCommandOptions
): Promise<ApprovalDraftMigrationResult> {
  if (
    !UUID.test(sourceRequestId) ||
    !safeVersion(input.expectedVersion) ||
    !UUID.test(input.targetFormId) ||
    !UUID.test(input.targetFormVersionId) ||
    !SHA256.test(input.targetFormSchemaSha256) ||
    !UUID.test(input.targetWorkflowId) ||
    !UUID.test(input.targetWorkflowVersionId) ||
    !SHA256.test(input.targetWorkflowDefinitionSha256) ||
    !input.reason.trim() ||
    input.reason.trim().length > 2000 ||
    !IDEMPOTENCY_KEY.test(options.idempotencyKey) ||
    typeof options.beforeDispatch !== 'function'
  ) {
    invalid();
  }
  const body = Object.freeze({ ...input, reason: input.reason.trim() });
  const config = approvalMutationExecutionConfig(execution);
  const governedKey = config.headers['Idempotency-Key'];
  if (governedKey && governedKey !== options.idempotencyKey) invalid();
  options.beforeDispatch();
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `/api/approvals/v1/requests/${sourceRequestId}/draft/migrate`,
    body,
    {
      ...config,
      headers: { ...config.headers, 'Idempotency-Key': options.idempotencyKey },
      beforeDispatch: options.beforeDispatch,
      csrfReplay: 'NEVER',
      timeoutMs: 10_000,
    }
  );
  options.beforeDispatch();
  return readResult(response.data.data, sourceRequestId, body);
}
