import { axiosInstance } from '../axios-instance';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
} from './approval-governed-mutation';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type {
  ApprovalArchiveExportInput,
  ApprovalDocumentComment,
  ApprovalDocumentCommentInput,
  ApprovalDocumentComments,
  ApprovalDocumentExportInput,
  ApprovalDocumentHold,
  ApprovalDocumentHoldInput,
  ApprovalDocumentHoldPublishInput,
  ApprovalDocumentOwner,
  ApprovalDocumentPolicy,
  ApprovalDocumentPolicyInput,
  ApprovalDocumentRules,
  ApprovalDocumentPublishInput,
  ApprovalDocumentTools,
  ApprovalGeneratedDocument,
} from './approval-document-contract';

const base = '/api/approvals/v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha = /^[0-9a-f]{64}$/;
function invalid(): never {
  throw new Error('Invalid approval document contract');
}
function version(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) invalid();
}
function id(value: string) {
  if (!uuid.test(value)) invalid();
  return value;
}
function ownerPath(owner: ApprovalDocumentOwner) {
  if (!['REQUEST', 'TASK'].includes(owner.type)) invalid();
  return `${base}/${owner.type === 'REQUEST' ? 'requests' : 'tasks'}/${id(owner.id)}`;
}
function executionConfig(
  input: { expectedVersion?: number; expectedPolicyVersion?: number; idempotencyKey: string },
  execution: ApprovalMutationExecution,
  publish = false
) {
  const expected = input.expectedVersion ?? input.expectedPolicyVersion;
  if (expected === undefined) invalid();
  version(expected);
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(input.idempotencyKey)) invalid();
  if (publish && execution.mode !== 'SECURE') invalid();
  const config = publish
    ? approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: false })
    : approvalMutationExecutionConfig(execution);
  const key = config.headers['Idempotency-Key'];
  if (
    (key && key !== input.idempotencyKey) ||
    (publish && execution.mode === 'SECURE' && execution.objectVersion !== expected)
  )
    invalid();
  return { ...config, headers: { ...config.headers, 'Idempotency-Key': input.idempotencyKey } };
}
function reason(value: string, minimum: number) {
  if (
    typeof value !== 'string' ||
    value.trim().length < minimum ||
    value.length > 1000 ||
    value.includes('\0')
  )
    invalid();
}
async function read<T>(path: string, contextScopeKey?: string, signal?: AbortSignal) {
  const response = await axiosInstance.get<ApiResponse<T>>(path, { contextScopeKey, signal });
  return response.data.data;
}
async function command<
  T,
  TInput extends {
    expectedVersion?: number;
    expectedPolicyVersion?: number;
    idempotencyKey: string;
  },
>(
  path: string,
  input: TInput,
  execution: ApprovalMutationExecution,
  publish = false,
  method: 'POST' | 'PUT' = 'POST'
) {
  const config = executionConfig(input, execution, publish);
  const response =
    method === 'PUT'
      ? await axiosInstance.put<ApiResponse<T>, TInput>(path, input, config)
      : await axiosInstance.post<ApiResponse<T>, TInput>(path, input, config);
  return response.data.data;
}

export async function getApprovalDocumentTools(
  owner: ApprovalDocumentOwner,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  const data = await read<ApprovalDocumentTools>(
    `${ownerPath(owner)}/document-tools`,
    contextScopeKey,
    signal
  );
  if (
    !data ||
    !uuid.test(data.requestId) ||
    !uuid.test(data.policyId) ||
    (owner.type === 'REQUEST'
      ? data.requestId !== owner.id || data.taskId !== null
      : data.taskId !== owner.id) ||
    !sha.test(data.payloadSha256) ||
    !/^RS_[A-Z0-9_]{1,76}$/.test(data.resourceSetKey) ||
    !Number.isSafeInteger(data.payloadRevision) ||
    data.payloadRevision < 1 ||
    !Number.isSafeInteger(data.maxBatchItems) ||
    data.maxBatchItems < 1 ||
    data.maxBatchItems > 50 ||
    !Number.isFinite(Date.parse(data.evaluatedAt)) ||
    typeof data.legalHold !== 'boolean' ||
    typeof data.preservationPending !== 'boolean' ||
    (data.taskId !== null && !uuid.test(data.taskId)) ||
    (owner.type === 'REQUEST' && data.taskVersion !== null)
  )
    invalid();
  for (const value of [
    data.requestVersion,
    data.policyVersion,
    data.commentsVersion,
    data.holdVersion,
  ])
    version(value);
  if (owner.type === 'TASK') {
    if (data.taskVersion === null) invalid();
    version(data.taskVersion);
  }
  for (const key of [
    'copyIdentifier',
    'history',
    'comment',
    'print',
    'jsonExport',
    'attachments',
    'archiveExport',
  ] as const)
    if (
      !data[key] ||
      typeof data[key].allowed !== 'boolean' ||
      typeof data[key].reason !== 'string' ||
      !data[key].reason
    )
      invalid();
  return Object.freeze({ ...data });
}

export async function getApprovalDocumentComments(
  owner: ApprovalDocumentOwner,
  page = 0,
  size = 25,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  version(page);
  if (page > 100000) invalid();
  if (!Number.isSafeInteger(size) || size < 1 || size > 100) invalid();
  const data = await read<ApprovalDocumentComments>(
    `${ownerPath(owner)}/comments?${new URLSearchParams({ page: String(page), size: String(size) })}`,
    contextScopeKey,
    signal
  );
  if (
    !data ||
    !Array.isArray(data.items) ||
    data.items.length > size ||
    data.page !== page ||
    data.size !== size ||
    !Number.isFinite(Date.parse(data.evaluatedAt))
  )
    invalid();
  version(data.totalElements);
  version(data.commentsVersion);
  if (data.totalElements < data.items.length) invalid();
  const ids = new Set<string>();
  for (const item of data.items) {
    id(item.commentId);
    id(item.requestId);
    if (
      ids.has(item.commentId) ||
      (owner.type === 'REQUEST' && item.requestId !== owner.id) ||
      (item.sourceTaskId !== null && !uuid.test(item.sourceTaskId)) ||
      !Number.isSafeInteger(item.sequence) ||
      item.sequence < 1 ||
      !Number.isSafeInteger(item.authorUserId) ||
      item.authorUserId < 1 ||
      typeof item.text !== 'string' ||
      !item.text.trim() ||
      item.text.length > 2000 ||
      item.text.includes('\0') ||
      !Number.isFinite(Date.parse(item.createdAt)) ||
      !Number.isFinite(Date.parse(item.retainUntil))
    )
      invalid();
    ids.add(item.commentId);
  }
  return Object.freeze({
    ...data,
    items: Object.freeze(data.items.map((item) => Object.freeze({ ...item }))),
  });
}
export function appendApprovalDocumentComment(
  owner: ApprovalDocumentOwner,
  input: ApprovalDocumentCommentInput,
  execution: ApprovalMutationExecution
) {
  version(input.expectedCommentsVersion);
  if (
    typeof input.text !== 'string' ||
    !input.text.trim() ||
    input.text.length > 2000 ||
    input.text.includes('\0')
  )
    invalid();
  return command<ApprovalDocumentComment, ApprovalDocumentCommentInput>(
    `${ownerPath(owner)}/comments`,
    input,
    execution
  );
}

export function appendApprovalRequestComment(
  requestId: string,
  input: ApprovalDocumentCommentInput,
  execution: ApprovalMutationExecution
) {
  return appendApprovalDocumentComment({ type: 'REQUEST', id: requestId }, input, execution);
}
export function appendApprovalTaskComment(
  taskId: string,
  input: ApprovalDocumentCommentInput,
  execution: ApprovalMutationExecution
) {
  return appendApprovalDocumentComment({ type: 'TASK', id: taskId }, input, execution);
}

export async function verifyApprovalGeneratedDocument(
  data: ApprovalGeneratedDocument,
  expectedPolicyVersion: number,
  intent: 'PRINT' | 'DOWNLOAD',
  now = Date.now()
): Promise<ApprovalGeneratedDocument> {
  const print = intent === 'PRINT';
  const extension = print ? 'html' : 'json';
  if (
    !data ||
    !uuid.test(data.exportId) ||
    data.format !== (print ? 'HTML' : 'JSON') ||
    data.mediaType !== (print ? 'text/html' : 'application/json') ||
    data.fileName !== `approval-${data.exportId}.${extension}` ||
    !sha.test(data.sha256) ||
    data.policyVersion !== expectedPolicyVersion ||
    typeof data.content !== 'string' ||
    !Number.isSafeInteger(data.sizeBytes) ||
    data.sizeBytes < 1 ||
    data.sizeBytes > 5242880
  )
    invalid();
  const generated = Date.parse(data.generatedAt),
    expires = Date.parse(data.expiresAt),
    retain = Date.parse(data.retainUntil);
  if (
    ![generated, expires, retain, now].every(Number.isFinite) ||
    generated > now ||
    expires <= now ||
    expires <= generated ||
    retain <= now ||
    retain <= generated
  )
    invalid();
  const bytes = new TextEncoder().encode(data.content);
  if (bytes.byteLength !== data.sizeBytes) invalid();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('');
  if (actual !== data.sha256) invalid();
  return Object.freeze({ ...data });
}

export async function exportApprovalDocument(
  owner: ApprovalDocumentOwner,
  input: ApprovalDocumentExportInput,
  execution: ApprovalMutationExecution
) {
  if (
    !Number.isSafeInteger(input.payloadRevision) ||
    input.payloadRevision < 1 ||
    !['PRINT', 'DOWNLOAD'].includes(input.intent)
  )
    invalid();
  version(input.expectedPolicyVersion);
  reason(input.reason, 4);
  const data = await command<ApprovalGeneratedDocument, ApprovalDocumentExportInput>(
    `${ownerPath(owner)}/document-exports`,
    input,
    execution
  );
  return verifyApprovalGeneratedDocument(data, input.expectedPolicyVersion, input.intent);
}
export async function exportApprovalArchive(
  input: ApprovalArchiveExportInput,
  execution: ApprovalMutationExecution
) {
  if (
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 50 ||
    new Set(input.items.map((item) => item.requestId)).size !== input.items.length ||
    !/^RS_[A-Z0-9_]{1,76}$/.test(input.resourceSetKey)
  )
    invalid();
  id(input.expectedPolicyId);
  reason(input.reason, 4);
  for (const item of input.items) {
    id(item.requestId);
    version(item.expectedVersion);
    if (!Number.isSafeInteger(item.payloadRevision) || item.payloadRevision < 1) invalid();
  }
  const data = await command<ApprovalGeneratedDocument, ApprovalArchiveExportInput>(
    `${base}/requests/archive/document-exports`,
    input,
    execution
  );
  return verifyApprovalGeneratedDocument(data, input.expectedPolicyVersion, 'DOWNLOAD');
}

export function exportApprovalRequestDocument(
  requestId: string,
  input: ApprovalDocumentExportInput,
  execution: ApprovalMutationExecution
) {
  return exportApprovalDocument({ type: 'REQUEST', id: requestId }, input, execution);
}
export function exportApprovalTaskDocument(
  taskId: string,
  input: ApprovalDocumentExportInput,
  execution: ApprovalMutationExecution
) {
  return exportApprovalDocument({ type: 'TASK', id: taskId }, input, execution);
}

export function getApprovalDocumentPolicy(contextScopeKey?: string, signal?: AbortSignal) {
  return read<ApprovalDocumentPolicy>(
    `${base}/admin/document-tools/policy`,
    contextScopeKey,
    signal
  );
}
export function saveApprovalDocumentPolicy(
  policyId: string,
  input: ApprovalDocumentPolicyInput,
  execution: ApprovalMutationExecution
) {
  id(policyId);
  validateApprovalDocumentRules(input.rules);
  return command<ApprovalDocumentPolicy, ApprovalDocumentPolicyInput>(
    `${base}/admin/document-tools/policies/${policyId}/draft`,
    input,
    execution,
    false,
    'PUT'
  );
}

export function validateApprovalDocumentRules(rules: ApprovalDocumentRules) {
  if (!rules) invalid();
  for (const flag of [
    'allowComments',
    'allowPrint',
    'allowJsonExport',
    'allowArchiveExport',
    'includeComments',
    'includeEvidence',
  ] as const)
    if (typeof rules[flag] !== 'boolean') invalid();
  for (const [value, min, max] of [
    [rules.maxBatchItems, 1, 50],
    [rules.maxBytes, 1024, 5242880],
    [rules.snapshotTtlSeconds, 60, 3600],
    [rules.evidenceRetentionDays, 1, 3650],
  ])
    if (!Number.isSafeInteger(value) || value < min || value > max) invalid();
  if (
    !Array.isArray(rules.allowedClassifications) ||
    rules.allowedClassifications.length > 3 ||
    new Set(rules.allowedClassifications).size !== rules.allowedClassifications.length ||
    rules.allowedClassifications.some(
      (value) => !['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(value)
    ) ||
    ((rules.allowPrint || rules.allowJsonExport || rules.allowArchiveExport) &&
      !rules.allowedClassifications.length)
  )
    invalid();
  let count = 0;
  const fields = (values: ApprovalDocumentRules['fields'], depth: number) => {
    if (!Array.isArray(values) || values.length > 100 || (values.length && depth > 4)) invalid();
    const names = new Set<string>();
    for (const field of values) {
      if (
        !field ||
        !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(field.key) ||
        names.has(field.key) ||
        ++count > 100 ||
        ![
          'STRING',
          'NUMBER',
          'DECIMAL_STRING',
          'BOOLEAN',
          'STRING_LIST',
          'OBJECT',
          'OBJECT_LIST',
        ].includes(field.type) ||
        !Number.isSafeInteger(field.maxLength) ||
        field.maxLength < 1 ||
        field.maxLength > 10000 ||
        !Array.isArray(field.children) ||
        (!['OBJECT', 'OBJECT_LIST'].includes(field.type) && field.children.length) ||
        (field.type === 'OBJECT_LIST'
          ? !Number.isSafeInteger(field.maxRows) ||
            (field.maxRows as number) < 1 ||
            (field.maxRows as number) > 50
          : field.maxRows !== null)
      )
        invalid();
      names.add(field.key);
      fields(field.children, depth + 1);
    }
  };
  fields(rules.fields, 0);
}
export function publishApprovalDocumentPolicy(
  policyId: string,
  input: ApprovalDocumentPublishInput,
  execution: ApprovalMutationExecution
) {
  id(policyId);
  reason(input.reviewComment, 10);
  return command<ApprovalDocumentPolicy, ApprovalDocumentPublishInput>(
    `${base}/admin/document-tools/policies/${policyId}/publish`,
    input,
    execution,
    true
  );
}
export function getApprovalDocumentHold(
  requestId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) {
  return read<ApprovalDocumentHold>(
    `${base}/admin/document-tools/holds/${id(requestId)}`,
    contextScopeKey,
    signal
  );
}
export function proposeApprovalDocumentHold(
  requestId: string,
  input: ApprovalDocumentHoldInput,
  execution: ApprovalMutationExecution
) {
  reason(input.reason, 10);
  if (!['PLACE', 'RELEASE'].includes(input.operation)) invalid();
  return command<ApprovalDocumentHold, ApprovalDocumentHoldInput>(
    `${base}/admin/document-tools/holds/${id(requestId)}/proposals`,
    input,
    execution
  );
}
export function publishApprovalDocumentHold(
  requestId: string,
  input: ApprovalDocumentHoldPublishInput,
  execution: ApprovalMutationExecution
) {
  id(input.proposalId);
  reason(input.reviewComment, 10);
  return command<ApprovalDocumentHold, ApprovalDocumentHoldPublishInput>(
    `${base}/admin/document-tools/holds/${id(requestId)}/publish`,
    input,
    execution,
    true
  );
}
