import { axiosInstance } from '../axios-instance';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';
import {
  APPROVAL_ATTACHMENT_MEDIA_TYPES,
  approvalAttachmentId,
  approvalAttachmentKey,
  approvalAttachmentName,
  approvalAttachmentSha,
  approvalAttachmentText,
  approvalAttachmentVersion,
  invalidApprovalAttachment,
  readApprovalAttachmentDownloadGrant,
  readApprovalAttachmentUpload,
  readApprovalAttachments,
} from './approval-attachment-contract';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type {
  ApprovalAttachmentCommandInput,
  ApprovalAttachmentDownloadGrant,
  ApprovalAttachmentDownloadInput,
  ApprovalAttachmentItem,
  ApprovalAttachmentReserveInput,
  ApprovalAttachmentSelectionInput,
  ApprovalAttachmentUpload,
  ApprovalAttachments,
} from './approval-attachment-contract';
import type { ApprovalDocumentOwner } from './approval-document-contract';

export type ApprovalAttachmentDispatchOptions = Readonly<{
  beforeDispatch?: () => void;
  signal?: AbortSignal;
}>;
export class ApprovalAttachmentResponseError extends Error {
  constructor(cause: unknown) {
    super('Approval attachment command returned an unverifiable result.', { cause });
    this.name = 'ApprovalAttachmentResponseError';
  }
}
const base = '/api/approvals/v1';
function ownerPath(owner: ApprovalDocumentOwner) {
  if (!owner || !['REQUEST', 'TASK'].includes(owner.type)) invalidApprovalAttachment();
  return `${base}/${owner.type === 'REQUEST' ? 'requests' : 'tasks'}/${approvalAttachmentId(owner.id)}`;
}
function config(
  input: ApprovalAttachmentCommandInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions,
  headerVersion = false
) {
  approvalAttachmentVersion(input.expectedVersion);
  approvalAttachmentKey(input.idempotencyKey);
  if (
    execution.mode === 'SECURE' &&
    ((execution.idempotencyKey !== undefined &&
      execution.idempotencyKey !== input.idempotencyKey) ||
      (execution.objectVersion !== undefined && execution.objectVersion !== input.expectedVersion))
  )
    invalidApprovalAttachment();
  const settings = approvalMutationExecutionConfig(execution);
  return {
    ...settings,
    ...options,
    headers: {
      ...settings.headers,
      'Idempotency-Key': input.idempotencyKey,
      ...(headerVersion
        ? {
            'X-DWP-Expected-Object-Version': String(input.expectedVersion),
            'Content-Type': 'application/octet-stream',
          }
        : {}),
    },
  };
}
function project<T>(data: unknown, parse: (value: unknown) => T): T {
  try {
    return parse(data);
  } catch (error) {
    throw new ApprovalAttachmentResponseError(error);
  }
}
async function command<T extends ApprovalAttachmentCommandInput, R>(
  url: string,
  input: T,
  execution: ApprovalMutationExecution,
  parse: (value: unknown) => R,
  options: ApprovalAttachmentDispatchOptions,
  method: 'POST' | 'PUT' = 'POST'
) {
  const settings = config(input, execution, options);
  const original = Object.freeze(structuredClone(input));
  const response =
    method === 'PUT'
      ? await axiosInstance.put<ApiResponse<unknown>, T>(url, original, settings)
      : await axiosInstance.post<ApiResponse<unknown>, T>(url, original, settings);
  return project(response.data.data, parse);
}
export async function getApprovalAttachments(
  owner: ApprovalDocumentOwner,
  contextScopeKey?: string,
  signal?: AbortSignal,
  expected?: { payloadRevision: number; payloadSha256: string }
) {
  const response = await axiosInstance.get<ApiResponse<ApprovalAttachments>>(
    `${ownerPath(owner)}/attachments`,
    { contextScopeKey, signal }
  );
  return readApprovalAttachments(response.data.data, expected);
}
export async function getApprovalAttachmentUpload(
  uploadId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  const response = await axiosInstance.get<ApiResponse<ApprovalAttachmentUpload>>(
    `${base}/attachment-uploads/${approvalAttachmentId(uploadId)}`,
    { contextScopeKey, signal }
  );
  return readApprovalAttachmentUpload(response.data.data, uploadId);
}
export async function reserveApprovalAttachmentUpload(
  requestId: string,
  input: ApprovalAttachmentReserveInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  const original = Object.freeze(structuredClone(input));
  approvalAttachmentName(input.fileName);
  approvalAttachmentSha(input.sha256);
  approvalAttachmentVersion(input.sizeBytes, 1, 26_214_400);
  approvalAttachmentVersion(input.expectedPayloadRevision, 1);
  approvalAttachmentVersion(input.expectedPolicyVersion);
  if (!(APPROVAL_ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(input.mediaType))
    invalidApprovalAttachment();
  return command(
    `${base}/requests/${approvalAttachmentId(requestId)}/attachment-uploads`,
    original,
    execution,
    (data) => {
      const upload = readApprovalAttachmentUpload(data as ApprovalAttachmentUpload);
      if (upload.sha256 !== original.sha256 || upload.sizeBytes !== original.sizeBytes)
        invalidApprovalAttachment();
      return upload;
    },
    options
  );
}
export async function reconcileApprovalAttachmentUpload(
  uploadId: string,
  input: ApprovalAttachmentCommandInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  approvalAttachmentId(uploadId);
  return command(
    `${base}/attachment-uploads/${uploadId}/reconcile`,
    input,
    execution,
    (data) => readApprovalAttachmentUpload(data as ApprovalAttachmentUpload, uploadId),
    options
  );
}
export async function cancelApprovalAttachmentUpload(
  uploadId: string,
  input: ApprovalAttachmentCommandInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  approvalAttachmentId(uploadId);
  return command(
    `${base}/attachment-uploads/${uploadId}/cancel`,
    input,
    execution,
    (data) => readApprovalAttachmentUpload(data as ApprovalAttachmentUpload, uploadId),
    options
  );
}
export async function selectApprovalAttachments(
  requestId: string,
  input: ApprovalAttachmentSelectionInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  const original = Object.freeze(structuredClone(input));
  approvalAttachmentVersion(input.expectedPayloadRevision, 1);
  approvalAttachmentVersion(input.expectedSelectionVersion);
  approvalAttachmentVersion(input.expectedPolicyVersion);
  if (
    !Array.isArray(input.attachmentIds) ||
    input.attachmentIds.length > 10 ||
    new Set(input.attachmentIds).size !== input.attachmentIds.length
  )
    invalidApprovalAttachment();
  input.attachmentIds.forEach(approvalAttachmentId);
  return command(
    `${base}/requests/${approvalAttachmentId(requestId)}/attachments`,
    original,
    execution,
    (data) => {
      const value = readApprovalAttachments(data as ApprovalAttachments);
      if (value.manifest.payloadRevision !== original.expectedPayloadRevision)
        invalidApprovalAttachment();
      return value;
    },
    options,
    'PUT'
  );
}
export async function createApprovalAttachmentDownloadGrant(
  owner: ApprovalDocumentOwner,
  attachment: ApprovalAttachmentItem,
  input: ApprovalAttachmentDownloadInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  const originalAttachment = Object.freeze({ ...attachment });
  approvalAttachmentId(attachment.attachmentId);
  approvalAttachmentVersion(input.expectedPayloadRevision, 1);
  approvalAttachmentVersion(input.expectedPolicyVersion);
  approvalAttachmentText(input.reason, 500);
  return command(
    `${ownerPath(owner)}/attachments/${attachment.attachmentId}/downloads`,
    input,
    execution,
    (data) =>
      readApprovalAttachmentDownloadGrant(
        data as ApprovalAttachmentDownloadGrant,
        originalAttachment
      ),
    options
  );
}
export async function createApprovalRequestAttachmentDownloadGrant(
  requestId: string,
  attachment: ApprovalAttachmentItem,
  input: ApprovalAttachmentDownloadInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  return createApprovalAttachmentDownloadGrant(
    { type: 'REQUEST', id: requestId },
    attachment,
    input,
    execution,
    options
  );
}
export async function createApprovalTaskAttachmentDownloadGrant(
  taskId: string,
  attachment: ApprovalAttachmentItem,
  input: ApprovalAttachmentDownloadInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  return createApprovalAttachmentDownloadGrant(
    { type: 'TASK', id: taskId },
    attachment,
    input,
    execution,
    options
  );
}

export async function approvalAttachmentBlobSha256(blob: Blob) {
  approvalAttachmentVersion(blob.size, 1, 26_214_400);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    ''
  );
}
export async function uploadApprovalAttachmentContent(
  upload: ApprovalAttachmentUpload,
  blob: Blob,
  input: ApprovalAttachmentCommandInput,
  execution: ApprovalMutationExecution,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  const original = readApprovalAttachmentUpload(upload);
  if (
    original.state !== 'RESERVED' ||
    input.expectedVersion !== original.version ||
    blob.size !== original.sizeBytes ||
    Date.parse(original.expiresAt) <= Date.now()
  )
    invalidApprovalAttachment();
  const settings = config(input, execution, options, true);
  const guard = options.beforeDispatch;
  settings.beforeDispatch = () => {
    if (Date.parse(original.expiresAt) <= Date.now()) invalidApprovalAttachment();
    guard?.();
  };
  const hash = await approvalAttachmentBlobSha256(blob);
  if (hash !== original.sha256) invalidApprovalAttachment();
  const response = await axiosInstance.put<ApiResponse<ApprovalAttachmentUpload>, Blob>(
    `${base}/attachment-uploads/${original.uploadId}/content`,
    blob,
    settings
  );
  return project(response.data.data, (data) => {
    const result = readApprovalAttachmentUpload(
      data as ApprovalAttachmentUpload,
      original.uploadId
    );
    if (
      result.attachmentId !== original.attachmentId ||
      result.sha256 !== original.sha256 ||
      result.sizeBytes !== original.sizeBytes
    )
      invalidApprovalAttachment();
    return result;
  });
}
export async function loadApprovalAttachmentDownload(
  grant: ApprovalAttachmentDownloadGrant,
  attachment: ApprovalAttachmentItem,
  contextScopeKey?: string,
  options: ApprovalAttachmentDispatchOptions = {}
) {
  const original = readApprovalAttachmentDownloadGrant(grant, attachment);
  approvalAttachmentName(attachment.fileName);
  const fileName = attachment.fileName;
  const guard = options.beforeDispatch;
  const requireCurrent = () => {
    if (Date.parse(original.expiresAt) <= Date.now()) invalidApprovalAttachment();
    guard?.();
  };
  requireCurrent();
  const response = await axiosInstance.get<Blob>(
    `${base}/attachment-downloads/${original.grantId}/content`,
    { ...options, contextScopeKey, beforeDispatch: requireCurrent, responseType: 'blob' }
  );
  if (
    response.headers?.get('X-Content-SHA256') !== original.sha256 ||
    response.headers?.get('Content-Length') !== String(original.sizeBytes) ||
    response.headers?.get('X-Content-Type-Options') !== 'nosniff' ||
    response.data.size !== original.sizeBytes ||
    (await approvalAttachmentBlobSha256(response.data)) !== original.sha256
  )
    invalidApprovalAttachment();
  requireCurrent();
  return Object.freeze({
    blob: response.data,
    fileName,
    sha256: original.sha256,
    sizeBytes: original.sizeBytes,
  });
}
