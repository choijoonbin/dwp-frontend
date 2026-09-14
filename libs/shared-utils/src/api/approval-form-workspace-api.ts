import { axiosInstance } from '../axios-instance';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
} from './approval-governed-mutation';
import { assertSupportedApprovalFormSchema } from './approval-management-contract';
import {
  approvalFormWorkspaceId,
  assertApprovalFormWorkspaceRevisionInput,
  invalidApprovalFormWorkspace,
  readApprovalFormWorkspace,
  readApprovalFormWorkspaceReview,
  readApprovalFormWorkspaceVersion,
  snapshotApprovalFormWorkspace,
} from './approval-form-workspace-contract';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type {
  ApprovalFormWorkspace,
  ApprovalFormWorkspaceDiff,
  ApprovalFormWorkspaceHistory,
  ApprovalFormWorkspaceRevisionInput,
  ApprovalFormWorkspaceReview,
  ApprovalFormWorkingDraftInput,
  ApprovalFormReviewedPublishInput,
} from './approval-form-workspace-contract';

export type ApprovalFormWorkspaceCommandOptions = Readonly<{
  idempotencyKey: string;
  beforeDispatch?: () => void;
}>;
export class ApprovalFormWorkspaceResponseError extends Error {
  constructor(cause: unknown) {
    super('Approval form command returned an unverifiable result.', { cause });
    this.name = 'ApprovalFormWorkspaceResponseError';
  }
}
const path = (formId: string) => `/api/approvals/v1/admin/forms/${approvalFormWorkspaceId(formId)}`;
const sha = /^[a-f0-9]{64}$/u;
async function read<T>(url: string, contextScopeKey?: string, signal?: AbortSignal) {
  const response = await axiosInstance.get<ApiResponse<T>>(url, { contextScopeKey, signal });
  return response.data.data;
}

export async function getApprovalFormWorkspace(
  formId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  return readApprovalFormWorkspace(
    await read<ApprovalFormWorkspace>(`${path(formId)}/working-draft`, contextScopeKey, signal),
    formId
  );
}
export async function getApprovalFormWorkspaceHistory(
  formId: string,
  size = 50,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 100) invalidApprovalFormWorkspace();
  const data = await read<ApprovalFormWorkspaceHistory>(
    `${path(formId)}/versions?size=${size}`,
    contextScopeKey,
    signal
  );
  if (
    !data ||
    !Array.isArray(data.versions) ||
    data.versions.length > size ||
    typeof data.mayBeTruncated !== 'boolean'
  )
    invalidApprovalFormWorkspace();
  for (const version of data.versions) readApprovalFormWorkspaceVersion(version);
  if (
    new Set(data.versions.map((version) => version.formVersionId)).size !== data.versions.length ||
    data.versions.some(
      (version, index) =>
        index > 0 && version.versionNumber >= data.versions[index - 1].versionNumber
    )
  )
    invalidApprovalFormWorkspace();
  return snapshotApprovalFormWorkspace(data);
}
export async function getApprovalFormWorkspaceVersion(
  formId: string,
  formVersionId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  const data = readApprovalFormWorkspaceVersion(
    await read<Parameters<typeof readApprovalFormWorkspaceVersion>[0]>(
      `${path(formId)}/versions/${approvalFormWorkspaceId(formVersionId)}`,
      contextScopeKey,
      signal
    )
  );
  if (data.formVersionId !== formVersionId) invalidApprovalFormWorkspace();
  return data;
}
export async function getApprovalFormWorkspaceDiff(
  formId: string,
  fromVersionId: string,
  toVersionId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  const query = new URLSearchParams({
    fromVersionId: approvalFormWorkspaceId(fromVersionId),
    toVersionId: approvalFormWorkspaceId(toVersionId),
  });
  const data = await read<ApprovalFormWorkspaceDiff>(
    `${path(formId)}/diff?${query}`,
    contextScopeKey,
    signal
  );
  const provenance = [
    'UNRECORDED_HISTORICAL_METADATA',
    'LEGACY_CAPTURE_TIME',
    'AUTHORING_SNAPSHOT',
    'PUBLISH_SNAPSHOT',
  ];
  if (
    !data ||
    data.fromVersionId !== fromVersionId ||
    data.toVersionId !== toVersionId ||
    !sha.test(data.fromSchemaSha256) ||
    !sha.test(data.toSchemaSha256) ||
    typeof data.complete !== 'boolean' ||
    !provenance.includes(data.fromMetadataProvenance) ||
    !provenance.includes(data.toMetadataProvenance) ||
    !Array.isArray(data.changes) ||
    data.changes.length > 4096 ||
    data.changes.some(
      (change) =>
        !change ||
        typeof change.path !== 'string' ||
        !change.path.startsWith('/') ||
        !Object.hasOwn(change, 'before') ||
        !Object.hasOwn(change, 'after')
    )
  )
    invalidApprovalFormWorkspace();
  return snapshotApprovalFormWorkspace(data);
}
export async function getApprovalFormWorkspacePublishReview(
  formId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  return readApprovalFormWorkspaceReview(
    await read<ApprovalFormWorkspaceReview>(
      `${path(formId)}/publish-review`,
      contextScopeKey,
      signal
    ),
    formId
  );
}

async function command<T extends ApprovalFormWorkspaceRevisionInput>(
  formId: string,
  suffix: string,
  input: T,
  execution: ApprovalMutationExecution,
  options: ApprovalFormWorkspaceCommandOptions,
  high = false,
  method: 'POST' | 'PUT' = 'POST'
) {
  assertApprovalFormWorkspaceRevisionInput(input);
  if (
    !options ||
    typeof options.idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,120}$/u.test(options.idempotencyKey)
  )
    invalidApprovalFormWorkspace();
  if (high && execution.mode !== 'SECURE') invalidApprovalFormWorkspace();
  if (
    execution.mode === 'SECURE' &&
    ((execution.idempotencyKey !== undefined &&
      execution.idempotencyKey !== options.idempotencyKey) ||
      (execution.objectVersion !== undefined &&
        execution.objectVersion !== input.expectedFormRevision))
  )
    invalidApprovalFormWorkspace();
  const config = high
    ? approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: true })
    : approvalMutationExecutionConfig(execution);
  const body = snapshotApprovalFormWorkspace(input);
  const url = `${path(formId)}/${suffix}`;
  const settings = {
    ...config,
    beforeDispatch: options.beforeDispatch,
    headers: { ...config.headers, 'Idempotency-Key': options.idempotencyKey },
  };
  const response =
    method === 'PUT'
      ? await axiosInstance.put<ApiResponse<ApprovalFormWorkspace>, T>(url, body, settings)
      : await axiosInstance.post<ApiResponse<ApprovalFormWorkspace>, T>(url, body, settings);
  try {
    return readApprovalFormWorkspace(response.data.data, formId);
  } catch (error) {
    // A successful transport may already have committed; never remint its command.
    throw new ApprovalFormWorkspaceResponseError(error);
  }
}
export async function branchApprovalFormWorkspaceVersion(
  formId: string,
  formVersionId: string,
  input: ApprovalFormWorkspaceRevisionInput,
  execution: ApprovalMutationExecution,
  options: ApprovalFormWorkspaceCommandOptions
) {
  return command(
    formId,
    `versions/${approvalFormWorkspaceId(formVersionId)}/branch`,
    input,
    execution,
    options
  );
}
export async function updateApprovalFormWorkingDraft(
  formId: string,
  input: ApprovalFormWorkingDraftInput,
  execution: ApprovalMutationExecution,
  options: ApprovalFormWorkspaceCommandOptions
) {
  approvalFormWorkspaceId(input.draftFormVersionId);
  approvalFormWorkspaceId(input.defaultWorkflowId);
  assertSupportedApprovalFormSchema(input.schema);
  const metadata = input.metadata;
  if (!metadata) invalidApprovalFormWorkspace();
  approvalFormWorkspaceId(metadata.categoryId);
  for (const [key, maximum] of [
    ['nameKo', 200],
    ['nameEn', 200],
    ['descriptionKo', 1000],
    ['descriptionEn', 1000],
    ['ownerGroupRef', 160],
  ] as const) {
    const value = metadata[key];
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > maximum ||
      value.includes('\0')
    )
      invalidApprovalFormWorkspace();
  }
  if (!['REQUEST', 'DOCUMENT', 'SIGNATURE'].includes(metadata.formKind))
    invalidApprovalFormWorkspace();
  return command(formId, 'working-draft', input, execution, options, false, 'PUT');
}
export async function retireApprovalFormWorkspace(
  formId: string,
  input: ApprovalFormWorkspaceRevisionInput,
  execution: ApprovalMutationExecution,
  options: ApprovalFormWorkspaceCommandOptions
) {
  return command(formId, 'retire', input, execution, options);
}
export async function reinstateApprovalFormWorkspace(
  formId: string,
  input: ApprovalFormWorkspaceRevisionInput,
  execution: ApprovalMutationExecution,
  options: ApprovalFormWorkspaceCommandOptions
) {
  return command(formId, 'reinstate', input, execution, options);
}
export async function publishReviewedApprovalFormWorkspace(
  formId: string,
  input: ApprovalFormReviewedPublishInput,
  execution: ApprovalMutationExecution,
  options: ApprovalFormWorkspaceCommandOptions
) {
  approvalFormWorkspaceId(input.draftFormVersionId);
  if (input.basePublishedVersionId !== null) approvalFormWorkspaceId(input.basePublishedVersionId);
  if (
    input.expectedWorkspaceRevision === null ||
    !sha.test(input.schemaSha256) ||
    !sha.test(input.reviewContentDigest)
  )
    invalidApprovalFormWorkspace();
  return command(formId, 'publish-reviewed', input, execution, options, true);
}
