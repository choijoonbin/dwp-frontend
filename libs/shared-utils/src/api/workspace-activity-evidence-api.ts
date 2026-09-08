import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

export type WorkspaceActivityIntegrityStatus = 'VERIFIED' | 'FAILED' | 'UNAVAILABLE' | 'PENDING';

export type WorkspaceActivityEvidence = {
  eventId: string;
  auditRecordId: string | null;
  linkStatus: 'LINKED' | 'NOT_LINKED';
  auditAccess: 'AVAILABLE' | 'RESTRICTED';
  recordHash: string | null;
  hashAlgorithm: 'SHA-256' | null;
  integrityStatus: WorkspaceActivityIntegrityStatus;
  integrityScope: 'DAILY_CHECKPOINT_REPORTED';
  verifiedAt: string | null;
  observedAt: string;
};

export type WorkspaceActivitySourceStatus = {
  sourceId: string;
  label: string;
  resourceKind: 'MAIL' | 'CALENDAR';
  status:
    | 'READY'
    | 'SYNCING'
    | 'STALE'
    | 'RESET_REQUIRED'
    | 'AUTHENTICATION_REQUIRED'
    | 'SUSPENDED'
    | 'NOT_CONNECTED'
    | 'REAUTHORIZATION_REQUIRED'
    | 'REVOKED'
    | 'CONFIGURATION_REQUIRED'
    | 'DEGRADED'
    | 'UNAVAILABLE'
    | 'BLOCKED'
    | 'REVIEW_REQUIRED'
    | 'DRAFT';
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  observedAt: string;
  semantics: 'PERSONAL_SYNC_LEDGER' | 'LOCAL_FIXTURE';
};

export type WorkspaceActivitySourceStatusReport = {
  observedAt: string;
  sources: WorkspaceActivitySourceStatus[];
};

export async function getWorkspaceActivityEventEvidence(
  eventId: string,
  signal?: AbortSignal
): Promise<WorkspaceActivityEvidence> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/platform/v1/workspace/activity/events/${encodeURIComponent(eventId)}/evidence`,
    { timeoutMs: 8000, signal }
  );
  const evidence = validateEvidence(response.data.data);
  if (evidence.eventId.toLowerCase() !== eventId.toLowerCase()) {
    throw new HttpError('Activity evidence is unavailable.', 404);
  }
  return evidence;
}

export async function getWorkspaceActivityAuditEvidence(
  auditRecordId: string,
  expectedEventId: string,
  signal?: AbortSignal
): Promise<WorkspaceActivityEvidence> {
  if (!isUuid(auditRecordId) || !isUuid(expectedEventId)) {
    throw new TypeError('Activity audit evidence identifier is invalid.');
  }
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/platform/v1/workspace/activity/audit/evidence/${encodeURIComponent(auditRecordId)}`,
    { timeoutMs: 8000, signal }
  );
  const evidence = validateEvidence(response.data.data);
  if (
    evidence.auditRecordId?.toLowerCase() !== auditRecordId.toLowerCase() ||
    evidence.eventId.toLowerCase() !== expectedEventId.toLowerCase()
  ) {
    throw new HttpError('Activity evidence is unavailable.', 404);
  }
  return evidence;
}

export async function getWorkspaceActivitySourceStatuses(
  signal?: AbortSignal
): Promise<WorkspaceActivitySourceStatusReport> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    '/api/platform/v1/workspace/activity/sources/status',
    { timeoutMs: 8000, signal }
  );
  const report = response.data.data;
  if (!isRecord(report) || !isDate(report.observedAt) || !Array.isArray(report.sources)) {
    throw invalidResponse();
  }
  if (!report.sources.every(isSourceStatus)) throw invalidResponse();
  return report as WorkspaceActivitySourceStatusReport;
}

function validateEvidence(value: unknown): WorkspaceActivityEvidence {
  if (!isRecord(value)) throw invalidResponse();
  if (
    !isUuid(value.eventId) ||
    !(value.auditRecordId === null || isUuid(value.auditRecordId)) ||
    !['LINKED', 'NOT_LINKED'].includes(String(value.linkStatus)) ||
    !['AVAILABLE', 'RESTRICTED'].includes(String(value.auditAccess)) ||
    !(value.recordHash === null || isSha256(value.recordHash)) ||
    !(value.hashAlgorithm === null || value.hashAlgorithm === 'SHA-256') ||
    !['VERIFIED', 'FAILED', 'UNAVAILABLE', 'PENDING'].includes(String(value.integrityStatus)) ||
    value.integrityScope !== 'DAILY_CHECKPOINT_REPORTED' ||
    !(value.verifiedAt === null || isDate(value.verifiedAt)) ||
    !isDate(value.observedAt) ||
    !hasConsistentEvidenceSemantics(value)
  ) {
    throw invalidResponse();
  }
  return value as WorkspaceActivityEvidence;
}

/** Rejects receipts that could promote linkage or restricted audit data to verified evidence. */
function hasConsistentEvidenceSemantics(value: Record<string, unknown>): boolean {
  const linked = value.linkStatus === 'LINKED';
  if (linked !== (value.auditRecordId !== null)) return false;

  const hasHash = value.recordHash !== null;
  const hasHashAlgorithm = value.hashAlgorithm !== null;
  if (hasHash !== hasHashAlgorithm) return false;

  if (value.auditAccess === 'RESTRICTED') {
    return !hasHash && value.integrityStatus === 'UNAVAILABLE' && value.verifiedAt === null;
  }

  if (!linked) {
    return !hasHash && value.integrityStatus === 'UNAVAILABLE' && value.verifiedAt === null;
  }

  if (value.integrityStatus === 'PENDING') return value.verifiedAt === null;
  if (value.integrityStatus === 'VERIFIED' || value.integrityStatus === 'FAILED') {
    return hasHash && value.hashAlgorithm === 'SHA-256' && value.verifiedAt !== null;
  }
  if (value.integrityStatus === 'UNAVAILABLE') {
    return hasHash && value.hashAlgorithm === 'SHA-256' && value.verifiedAt !== null;
  }
  return false;
}

function isSourceStatus(value: unknown): value is WorkspaceActivitySourceStatus {
  if (!isRecord(value)) return false;
  return (
    typeof value.sourceId === 'string' &&
    value.sourceId.trim().length > 0 &&
    typeof value.label === 'string' &&
    value.label.trim().length > 0 &&
    ['MAIL', 'CALENDAR'].includes(String(value.resourceKind)) &&
    [
      'READY',
      'SYNCING',
      'STALE',
      'RESET_REQUIRED',
      'AUTHENTICATION_REQUIRED',
      'SUSPENDED',
      'NOT_CONNECTED',
      'REAUTHORIZATION_REQUIRED',
      'REVOKED',
      'CONFIGURATION_REQUIRED',
      'DEGRADED',
      'UNAVAILABLE',
      'BLOCKED',
      'REVIEW_REQUIRED',
      'DRAFT',
    ].includes(String(value.status)) &&
    (value.lastAttemptAt === null || isDate(value.lastAttemptAt)) &&
    (value.lastSuccessAt === null || isDate(value.lastSuccessAt)) &&
    isDate(value.observedAt) &&
    ['PERSONAL_SYNC_LEDGER', 'LOCAL_FIXTURE'].includes(String(value.semantics))
  );
}

function invalidResponse() {
  return new HttpError('Activity evidence response is invalid.', 502);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)
  );
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/iu.test(value);
}
