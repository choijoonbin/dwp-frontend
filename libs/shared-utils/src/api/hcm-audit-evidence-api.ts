import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type HcmAuditWindow = 'H24' | 'D7' | 'D30' | 'D90';
export type HcmAuditCategory = 'ALL' | 'ADMIN_CHANGE' | 'POLICY_DENIED';
export type HcmAuditSeverity = 'ALL' | 'INFO' | 'HIGH' | 'CRITICAL';
export type HcmAuditOutcome = 'ALL' | 'SUCCESS' | 'DENIED' | 'FAILED';

export type HcmAuditEvidence = {
  eventId: string;
  occurredAt: string;
  category: Exclude<HcmAuditCategory, 'ALL'>;
  action: string;
  outcome: Exclude<HcmAuditOutcome, 'ALL'>;
  severity: Exclude<HcmAuditSeverity, 'ALL'>;
  actorType: 'USER' | 'SERVICE' | 'SYSTEM' | 'AGENT';
  sourceService: string;
  sourceModule: string;
  aggregateType: string;
  aggregateRevision: number;
  effectiveCapability: string;
  purposeCode: string;
  authorizationDecisionRef: string;
  scopeRevision: number;
  fieldPolicyRevision: number;
  approvalReceiptId: string | null;
  reasonCode: string | null;
  beforeDigest: string | null;
  afterDigest: string | null;
  evidenceDigest: string;
  classification: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  retentionClass: 'STANDARD' | 'EXTENDED' | 'LEGAL_HOLD';
  causationId: string;
  correlationId: string;
  recordHash: string;
};

export type HcmAuditEvidencePage = {
  items: HcmAuditEvidence[];
  size: number;
  snapshotAt: string;
  nextCursor: string | null;
};

export type HcmAuditEvidenceFilters = {
  window?: HcmAuditWindow;
  category?: HcmAuditCategory;
  severity?: HcmAuditSeverity;
  outcome?: HcmAuditOutcome;
  sourceService?: string;
  query?: string;
  size?: number;
  cursor?: string;
};

export class HcmAuditEvidenceContractError extends Error {
  constructor(path: string, reason: string) {
    super(`Invalid HcmAuditEvidenceV1 contract at ${path}: ${reason}`);
    this.name = 'HcmAuditEvidenceContractError';
  }
}

const EVENT_FIELDS = [
  'eventId',
  'occurredAt',
  'category',
  'action',
  'outcome',
  'severity',
  'actorType',
  'sourceService',
  'sourceModule',
  'aggregateType',
  'aggregateRevision',
  'effectiveCapability',
  'purposeCode',
  'authorizationDecisionRef',
  'scopeRevision',
  'fieldPolicyRevision',
  'approvalReceiptId',
  'reasonCode',
  'beforeDigest',
  'afterDigest',
  'evidenceDigest',
  'classification',
  'retentionClass',
  'causationId',
  'correlationId',
  'recordHash',
] as const;
const PAGE_FIELDS = ['items', 'size', 'snapshotAt', 'nextCursor'] as const;
const FILTER_FIELDS = new Set([
  'window',
  'category',
  'severity',
  'outcome',
  'sourceService',
  'query',
  'size',
  'cursor',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const CODE = /^[A-Z][A-Z0-9._-]{0,79}$/u;
const SERVICE = /^[a-z][a-z0-9._-]{2,127}$/u;
const SOURCE_MODULE = /^hris\.[a-z0-9._-]+$/u;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9:/._-]{0,511}$/u;
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/u;

function fail(path: string, reason: string): never {
  throw new HcmAuditEvidenceContractError(path, reason);
}

function exactRecord(
  value: unknown,
  path: string,
  fields: readonly string[]
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }
  const source = value as Record<string, unknown>;
  const unknown = Object.keys(source).find((key) => !fields.includes(key));
  if (unknown) fail(path, `unknown field ${unknown}`);
  const missing = fields.find((key) => !Object.hasOwn(source, key));
  if (missing) fail(path, `missing field ${missing}`);
  return source;
}

function text(value: unknown, path: string, maximum = 512): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    return fail(path, `expected a non-empty string up to ${maximum} characters`);
  }
  if (
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return fail(path, 'control characters are forbidden');
  }
  return value;
}

function patterned(value: unknown, path: string, pattern: RegExp, maximum = 512): string {
  const resolved = text(value, path, maximum);
  return pattern.test(resolved) ? resolved : fail(path, 'value does not match the closed format');
}

function nullablePatterned(
  value: unknown,
  path: string,
  pattern: RegExp,
  maximum = 512
): string | null {
  return value === null ? null : patterned(value, path, pattern, maximum);
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fail(path, `expected one of ${allowed.join(', ')}`);
}

function positiveInteger(value: unknown, path: string): number {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? Number(value)
    : fail(path, 'expected a positive safe integer');
}

function boundedInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum
    ? Number(value)
    : fail(path, `expected an integer from ${minimum} to ${maximum}`);
}

function timestamp(value: unknown, path: string): string {
  const resolved = text(value, path, 40);
  return RFC3339.test(resolved) && Number.isFinite(Date.parse(resolved))
    ? resolved
    : fail(path, 'expected an RFC 3339 timestamp');
}

export function parseHcmAuditEvidence(value: unknown, path = 'data'): HcmAuditEvidence {
  const source = exactRecord(value, path, EVENT_FIELDS);
  const outcome = oneOf(source.outcome, `${path}.outcome`, ['SUCCESS', 'DENIED', 'FAILED']);
  const reasonCode = nullablePatterned(source.reasonCode, `${path}.reasonCode`, CODE, 80);
  if (outcome !== 'SUCCESS' && reasonCode === null) {
    fail(`${path}.reasonCode`, 'required for denied or failed evidence');
  }
  return {
    eventId: patterned(source.eventId, `${path}.eventId`, UUID, 36),
    occurredAt: timestamp(source.occurredAt, `${path}.occurredAt`),
    category: oneOf(source.category, `${path}.category`, ['ADMIN_CHANGE', 'POLICY_DENIED']),
    action: patterned(source.action, `${path}.action`, CODE, 80),
    outcome,
    severity: oneOf(source.severity, `${path}.severity`, ['INFO', 'HIGH', 'CRITICAL']),
    actorType: oneOf(source.actorType, `${path}.actorType`, ['USER', 'SERVICE', 'SYSTEM', 'AGENT']),
    sourceService: patterned(source.sourceService, `${path}.sourceService`, SERVICE, 128),
    sourceModule: patterned(source.sourceModule, `${path}.sourceModule`, SOURCE_MODULE, 128),
    aggregateType: patterned(source.aggregateType, `${path}.aggregateType`, CODE, 80),
    aggregateRevision: positiveInteger(source.aggregateRevision, `${path}.aggregateRevision`),
    effectiveCapability: patterned(
      source.effectiveCapability,
      `${path}.effectiveCapability`,
      CODE,
      80
    ),
    purposeCode: patterned(source.purposeCode, `${path}.purposeCode`, CODE, 80),
    authorizationDecisionRef: patterned(
      source.authorizationDecisionRef,
      `${path}.authorizationDecisionRef`,
      REFERENCE
    ),
    scopeRevision: positiveInteger(source.scopeRevision, `${path}.scopeRevision`),
    fieldPolicyRevision: positiveInteger(source.fieldPolicyRevision, `${path}.fieldPolicyRevision`),
    approvalReceiptId: nullablePatterned(
      source.approvalReceiptId,
      `${path}.approvalReceiptId`,
      UUID,
      36
    ),
    reasonCode,
    beforeDigest: nullablePatterned(source.beforeDigest, `${path}.beforeDigest`, SHA256, 64),
    afterDigest: nullablePatterned(source.afterDigest, `${path}.afterDigest`, SHA256, 64),
    evidenceDigest: patterned(source.evidenceDigest, `${path}.evidenceDigest`, SHA256, 64),
    classification: oneOf(source.classification, `${path}.classification`, [
      'INTERNAL',
      'CONFIDENTIAL',
      'RESTRICTED',
    ]),
    retentionClass: oneOf(source.retentionClass, `${path}.retentionClass`, [
      'STANDARD',
      'EXTENDED',
      'LEGAL_HOLD',
    ]),
    causationId: patterned(source.causationId, `${path}.causationId`, UUID, 36),
    correlationId: patterned(source.correlationId, `${path}.correlationId`, UUID, 36),
    recordHash: patterned(source.recordHash, `${path}.recordHash`, SHA256, 64),
  };
}

export function parseHcmAuditEvidencePage(value: unknown): HcmAuditEvidencePage {
  const source = exactRecord(value, 'data', PAGE_FIELDS);
  if (!Array.isArray(source.items) || source.items.length > 100) {
    fail('data.items', 'expected an array of at most 100 entries');
  }
  return {
    items: source.items.map((item, index) => parseHcmAuditEvidence(item, `data.items[${index}]`)),
    size: boundedInteger(source.size, 'data.size', 0, 100),
    snapshotAt: timestamp(source.snapshotAt, 'data.snapshotAt'),
    nextCursor:
      source.nextCursor === null ? null : text(source.nextCursor, 'data.nextCursor', 4096),
  };
}

function query(filters: HcmAuditEvidenceFilters): URLSearchParams {
  const unknown = Object.keys(filters).find((key) => !FILTER_FIELDS.has(key));
  if (unknown) fail(`filters.${unknown}`, 'filter is not allowed');
  const search = new URLSearchParams({ product: 'HCM' });
  const window = filters.window ?? 'D7';
  search.set('window', oneOf(window, 'filters.window', ['H24', 'D7', 'D30', 'D90']));
  if (filters.category !== undefined) {
    search.set(
      'category',
      oneOf(filters.category, 'filters.category', ['ALL', 'ADMIN_CHANGE', 'POLICY_DENIED'])
    );
  }
  if (filters.severity !== undefined) {
    search.set(
      'severity',
      oneOf(filters.severity, 'filters.severity', ['ALL', 'INFO', 'HIGH', 'CRITICAL'])
    );
  }
  if (filters.outcome !== undefined) {
    search.set(
      'outcome',
      oneOf(filters.outcome, 'filters.outcome', ['ALL', 'SUCCESS', 'DENIED', 'FAILED'])
    );
  }
  if (filters.sourceService !== undefined && filters.sourceService !== '') {
    search.set(
      'sourceService',
      patterned(filters.sourceService.trim(), 'filters.sourceService', SERVICE, 128)
    );
  }
  if (filters.query !== undefined && filters.query !== '') {
    search.set('query', text(filters.query.trim(), 'filters.query', 160));
  }
  if (filters.size !== undefined) {
    search.set('size', String(boundedInteger(filters.size, 'filters.size', 10, 100)));
  }
  if (filters.cursor !== undefined) {
    search.set('cursor', text(filters.cursor, 'filters.cursor', 4096));
  }
  return search;
}

export async function listHcmAuditEvidence(
  filters: HcmAuditEvidenceFilters = {},
  signal?: AbortSignal
): Promise<HcmAuditEvidencePage> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/platform/v1/admin/audit-control/events?${query(filters).toString()}`,
    { signal }
  );
  return parseHcmAuditEvidencePage(response.data.data);
}

export async function getHcmAuditEvidence(
  eventId: string,
  signal?: AbortSignal
): Promise<HcmAuditEvidence> {
  const resolvedEventId = patterned(eventId, 'eventId', UUID, 36);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/platform/v1/admin/audit-control/events/${encodeURIComponent(resolvedEventId)}?product=HCM`,
    { signal }
  );
  const evidence = parseHcmAuditEvidence(response.data.data);
  if (evidence.eventId.toLowerCase() !== resolvedEventId.toLowerCase()) {
    fail('data.eventId', 'does not match the requested evidence');
  }
  return evidence;
}
