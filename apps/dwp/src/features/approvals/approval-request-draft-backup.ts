import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';

const BACKUP_FORMAT = 'DWP_APPROVAL_DRAFT_BACKUP';
const BACKUP_SCHEMA_VERSION = 1;
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type ApprovalDraftBackupSource = Readonly<{
  requestId: string;
  requestNumber: string;
  expectedVersion: number;
  status: 'DRAFT';
  workflowId: string;
  formId: string;
  formVersionId: string | null;
  formSchemaSha256: string | null;
  title: string;
  summary: string;
  priority: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type ApprovalDraftBackupArtifact = Readonly<{
  fileName: string;
  bytes: Uint8Array<ArrayBuffer>;
  content: string;
}>;

export type ApprovalDraftBackupDocument = Readonly<{
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  source: Readonly<{
    authority: 'CURRENT_OWNER_DETAIL_REVALIDATED';
    route: string;
    requestId: string;
    requestNumber: string;
    expectedVersion: number;
    status: 'DRAFT';
  }>;
  binding: Readonly<{
    workflowId: string;
    formId: string;
    formVersionId: string | null;
    formSchemaSha256: string | null;
  }>;
  inputSnapshot: Readonly<{
    title: string;
    summary: string;
    priority: string;
    payload: Readonly<Record<string, unknown>>;
  }>;
  lifecycle: Readonly<{
    discardContract: 'RESTORABLE_SOFT_DELETE';
    physicalDeletionPerformed: false;
    revisionHistoryPreserved: true;
  }>;
  integrity: Readonly<{ algorithm: 'SHA-256'; sourceSha256: string }>;
}>;

function invalidSource(): never {
  throw new Error('Invalid approval draft backup source');
}

function canonicalJson(value: unknown, depth = 0): JsonValue {
  if (depth > 64) invalidSource();
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalidSource();
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalJson(item, depth + 1));
  if (typeof value !== 'object') invalidSource();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalidSource();
  const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
  for (const key of Object.keys(value).sort()) {
    if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype')
      invalidSource();
    result[key] = canonicalJson((value as Record<string, unknown>)[key], depth + 1);
  }
  return result;
}

function canonicalString(value: unknown) {
  return JSON.stringify(canonicalJson(value));
}

function requireIdentifier(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) invalidSource();
  return value;
}

function optionalIdentifier(value: unknown) {
  if (value == null) return null;
  return requireIdentifier(value);
}

export function approvalDraftBackupSource(
  detail: ApprovalRequestDetail
): ApprovalDraftBackupSource {
  const request = detail.request;
  if (
    request.status !== 'DRAFT' ||
    !Number.isSafeInteger(request.version) ||
    request.version < 0 ||
    typeof detail.payload !== 'object' ||
    detail.payload === null ||
    Array.isArray(detail.payload)
  )
    invalidSource();
  const source: ApprovalDraftBackupSource = {
    requestId: requireIdentifier(request.requestId),
    requestNumber: requireIdentifier(request.requestNumber),
    expectedVersion: request.version,
    status: 'DRAFT',
    workflowId: requireIdentifier(detail.workflowId),
    formId: requireIdentifier(detail.formId),
    formVersionId: optionalIdentifier(detail.formVersionId),
    formSchemaSha256: optionalIdentifier(detail.formSchemaSha256),
    title: typeof request.title === 'string' ? request.title : invalidSource(),
    summary: typeof request.summary === 'string' ? request.summary : invalidSource(),
    priority: requireIdentifier(request.priority),
    payload: canonicalJson(detail.payload) as Readonly<Record<string, unknown>>,
  };
  canonicalString(source);
  return Object.freeze(source);
}

export function approvalDraftBackupFingerprint(source: ApprovalDraftBackupSource) {
  return canonicalString(source);
}

export function sameApprovalDraftBackupSource(
  expected: ApprovalDraftBackupSource,
  actual: ApprovalDraftBackupSource
) {
  return approvalDraftBackupFingerprint(expected) === approvalDraftBackupFingerprint(actual);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function backupFileName(source: ApprovalDraftBackupSource) {
  const safeNumber = source.requestNumber.replace(/[^A-Za-z0-9._-]/gu, '-').slice(0, 80);
  const fallback = source.requestId.replace(/[^A-Za-z0-9._-]/gu, '-').slice(0, 80);
  return `dwp-approval-draft-${safeNumber || fallback}-v${source.expectedVersion}.json`;
}

export async function createApprovalDraftBackupArtifact(
  source: ApprovalDraftBackupSource,
  exportedAt = new Date().toISOString()
): Promise<ApprovalDraftBackupArtifact> {
  if (!Number.isFinite(Date.parse(exportedAt))) invalidSource();
  const fingerprint = approvalDraftBackupFingerprint(source);
  const backup: ApprovalDraftBackupDocument = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    source: {
      authority: 'CURRENT_OWNER_DETAIL_REVALIDATED',
      route: `GET /v1/requests/${source.requestId}/detail`,
      requestId: source.requestId,
      requestNumber: source.requestNumber,
      expectedVersion: source.expectedVersion,
      status: source.status,
    },
    binding: {
      workflowId: source.workflowId,
      formId: source.formId,
      formVersionId: source.formVersionId,
      formSchemaSha256: source.formSchemaSha256,
    },
    inputSnapshot: {
      title: source.title,
      summary: source.summary,
      priority: source.priority,
      payload: source.payload,
    },
    lifecycle: {
      discardContract: 'RESTORABLE_SOFT_DELETE',
      physicalDeletionPerformed: false,
      revisionHistoryPreserved: true,
    },
    integrity: {
      algorithm: 'SHA-256',
      sourceSha256: await sha256(fingerprint),
    },
  };
  const content = `${JSON.stringify(canonicalJson(backup), null, 2)}\n`;
  const bytes = new TextEncoder().encode(content);
  if (
    bytes.byteLength < 1 ||
    bytes.byteLength > MAX_BACKUP_BYTES ||
    new TextDecoder('utf-8', { fatal: true }).decode(bytes) !== content
  )
    invalidSource();
  return Object.freeze({ fileName: backupFileName(source), bytes, content });
}

export function downloadApprovalDraftBackup(
  artifact: ApprovalDraftBackupArtifact,
  isCurrent: () => boolean
) {
  if (!isCurrent()) throw new Error('Approval draft backup context changed');
  const ownedBytes = new Uint8Array(artifact.bytes.byteLength);
  ownedBytes.set(artifact.bytes);
  const url = URL.createObjectURL(
    new Blob([ownedBytes.buffer], { type: 'application/json;charset=utf-8' })
  );
  const link = window.document.createElement('a');
  try {
    if (!isCurrent()) throw new Error('Approval draft backup context changed');
    link.href = url;
    link.download = artifact.fileName;
    link.rel = 'noopener noreferrer';
    link.hidden = true;
    window.document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
