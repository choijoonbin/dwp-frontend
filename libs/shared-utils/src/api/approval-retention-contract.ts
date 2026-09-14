import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';

type Schema = GatewayComponents['schemas'];
export type ApprovalRetentionRules = Readonly<
  Omit<Schema['approval_ApprovalRetentionPublicRules'], 'allowedClassifications'> & {
    allowedClassifications: readonly ('INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED')[];
  }
>;
export type ApprovalRetentionPolicy = Readonly<
  Omit<
    Required<Schema['approval_ApprovalRetentionPolicy']>,
    'pendingRevision' | 'pendingMakerUserId' | 'pendingRulesSha256' | 'published' | 'pending'
  > & {
    pendingRevision: number | null;
    pendingMakerUserId: number | null;
    pendingRulesSha256: string | null;
    published: ApprovalRetentionRules;
    pending: ApprovalRetentionRules | null;
  }
>;
export type ApprovalRetentionRecord = Readonly<
  Omit<Required<Schema['approval_ApprovalRetentionRecord']>, 'eligibleAfter' | 'claimId'> & {
    eligibleAfter: string | null;
    claimId: string | null;
  }
>;
export type ApprovalRetentionClaim = Readonly<
  Omit<Required<Schema['approval_ApprovalRetentionClaim']>, 'executionClaimId'> & {
    executionClaimId: string | null;
  }
>;
export type ApprovalRetentionSaveInput = Readonly<
  Omit<Schema['approval_ApprovalRetentionSavePolicy'], 'rules'> & {
    rules: ApprovalRetentionRules;
  }
>;
export type ApprovalRetentionClaimInput = Readonly<Schema['approval_ApprovalRetentionCreateClaim']>;

export const APPROVAL_RETENTION_BINDINGS = [
  ['retention-policy.data', 'GET', '/v1/admin/retention/policy'],
  ['retention-policy-initialize.action', 'POST', '/v1/admin/retention/policies'],
  ['retention-policy-draft.action', 'PUT', '/v1/admin/retention/policies/{policyId}/draft'],
  ['retention-policy-publish.action', 'POST', '/v1/admin/retention/policies/{policyId}/publish'],
  ['retention-record.data', 'GET', '/v1/admin/retention/records/{requestId}'],
  ['retention-record-claim.action', 'POST', '/v1/admin/retention/records/{requestId}/claims'],
  ['retention-claim.data', 'GET', '/v1/admin/retention/claims/{claimId}'],
] as const;
export type ApprovalRetentionRoute = (typeof APPROVAL_RETENTION_BINDINGS)[number][0];

function invalid(): never {
  throw new Error('Invalid approval retention contract');
}
function object(value: unknown, required: readonly string[], optional: readonly string[] = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    invalid();
  const row = value as Record<string, unknown>;
  if (
    required.some((key) => !Object.hasOwn(row, key)) ||
    Object.keys(row).some((key) => !required.includes(key) && !optional.includes(key))
  )
    invalid();
  return row;
}
export function approvalRetentionId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
  )
    invalid();
  return value;
}
export function approvalRetentionVersion(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum)
    invalid();
  return value;
}
export function approvalRetentionKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) invalid();
  return value;
}
function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) invalid();
  return value;
}
function code(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{0,99}$/.test(value)) invalid();
  return value;
}
function claimReason(value: unknown): string {
  const result = code(value);
  if (
    ![
      'RECORD_ALREADY_CLAIMED',
      'POLICY_PURGE_DISABLED',
      'CLASSIFICATION_DENIED',
      'ACTIVE_OR_PENDING_HOLD',
      'RECORD_NOT_TERMINAL',
      'BLOCKED_SHARED_LINK',
      'RECORD_WORK_UNSETTLED',
      'INVENTORY_CAP_EXCEEDED',
      'RETENTION_NOT_ELAPSED',
      'ELIGIBLE_FOR_DURABLE_INTENT',
    ].includes(result)
  )
    invalid();
  return result;
}
function scope(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{2,79}$/.test(value)) invalid();
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') invalid();
  return value;
}
function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value == null ? null : parse(value);
}
function timestamp(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !/(Z|[+-]\d\d:\d\d)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid();
  return value;
}
export function readApprovalRetentionRules(value: unknown): Readonly<ApprovalRetentionRules> {
  const row = object(value, [
    'allowPurge',
    'allowedClassifications',
    'recordRetentionDays',
    'deletedDraftRecoveryDays',
    'receiptRetentionDays',
    'holdEvidenceRetentionDays',
    'auditEvidenceRetentionDays',
    'maxInventoryRows',
    'maxObjectsPerRecord',
  ]);
  const values = row.allowedClassifications;
  if (
    !Array.isArray(values) ||
    values.length < 1 ||
    values.length > 3 ||
    new Set(values).size !== values.length ||
    values.some((value) => !['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(value))
  )
    invalid();
  const days = (value: unknown) => {
    const result = approvalRetentionVersion(value, 3650);
    if (result < 1) invalid();
    return result;
  };
  const rows = approvalRetentionVersion(row.maxInventoryRows, 50000);
  const objects = approvalRetentionVersion(row.maxObjectsPerRecord, 1000);
  if (rows < 1 || objects < 1) invalid();
  return Object.freeze({
    allowPurge: bool(row.allowPurge),
    allowedClassifications: Object.freeze([
      ...values,
    ]) as ApprovalRetentionRules['allowedClassifications'],
    recordRetentionDays: days(row.recordRetentionDays),
    deletedDraftRecoveryDays: days(row.deletedDraftRecoveryDays),
    receiptRetentionDays: days(row.receiptRetentionDays),
    holdEvidenceRetentionDays: days(row.holdEvidenceRetentionDays),
    auditEvidenceRetentionDays: days(row.auditEvidenceRetentionDays),
    maxInventoryRows: rows,
    maxObjectsPerRecord: objects,
  });
}
export function readApprovalRetentionPolicy(
  value: unknown,
  expectedId?: string
): Readonly<ApprovalRetentionPolicy> {
  const row = object(
    value,
    [
      'policyId',
      'resourceSetKey',
      'version',
      'publishedRevision',
      'publishedRulesSha256',
      'published',
      'publishEligible',
      'publishReason',
      'runtimeReadiness',
    ],
    ['pendingRevision', 'pendingMakerUserId', 'pendingRulesSha256', 'pending']
  );
  const result = {
    policyId: approvalRetentionId(row.policyId),
    resourceSetKey: scope(row.resourceSetKey),
    version: approvalRetentionVersion(row.version),
    publishedRevision: approvalRetentionVersion(row.publishedRevision),
    pendingRevision: nullable(row.pendingRevision, approvalRetentionVersion),
    pendingMakerUserId: nullable(row.pendingMakerUserId, approvalRetentionVersion),
    publishedRulesSha256: digest(row.publishedRulesSha256),
    pendingRulesSha256: nullable(row.pendingRulesSha256, digest),
    published: readApprovalRetentionRules(row.published),
    pending: nullable(row.pending, readApprovalRetentionRules),
    publishEligible: bool(row.publishEligible),
    publishReason: code(row.publishReason),
    runtimeReadiness: code(row.runtimeReadiness),
  };
  if (expectedId != null && result.policyId !== expectedId) invalid();
  if (result.publishedRevision === 0 && result.published.allowPurge) invalid();
  if (result.pending == null) {
    if (
      result.pendingRevision != null ||
      result.pendingMakerUserId != null ||
      result.pendingRulesSha256 != null ||
      result.publishEligible ||
      result.publishReason !== 'NO_PENDING_REVISION'
    )
      invalid();
  } else if (
    result.pendingRevision == null ||
    result.pendingRevision <= result.publishedRevision ||
    result.pendingMakerUserId == null ||
    result.pendingMakerUserId < 1 ||
    result.pendingRulesSha256 == null ||
    !['INDEPENDENT_CHECKER_REQUIRED', 'ELIGIBLE_REQUIRES_SIGNED_HIGH'].includes(
      result.publishReason
    ) ||
    result.publishEligible !== (result.publishReason === 'ELIGIBLE_REQUIRES_SIGNED_HIGH')
  )
    invalid();
  return Object.freeze(result);
}
export function readApprovalRetentionRecord(
  value: unknown,
  requestId: string
): Readonly<ApprovalRetentionRecord> {
  const row = object(
    value,
    [
      'requestId',
      'resourceSetKey',
      'version',
      'policyId',
      'policyVersion',
      'holdVersion',
      'state',
      'claimEligible',
      'claimReason',
      'inventorySha256',
      'inventoryRows',
      'inventoryTables',
      'objectCount',
      'runtimeReadiness',
    ],
    ['eligibleAfter', 'claimId']
  );
  const result = {
    requestId: approvalRetentionId(row.requestId),
    resourceSetKey: scope(row.resourceSetKey),
    version: approvalRetentionVersion(row.version),
    policyId: approvalRetentionId(row.policyId),
    policyVersion: approvalRetentionVersion(row.policyVersion),
    holdVersion: approvalRetentionVersion(row.holdVersion),
    state: code(row.state),
    claimEligible: bool(row.claimEligible),
    claimReason: claimReason(row.claimReason),
    inventorySha256: digest(row.inventorySha256),
    inventoryRows: approvalRetentionVersion(row.inventoryRows),
    inventoryTables: approvalRetentionVersion(row.inventoryTables, 1000),
    objectCount: approvalRetentionVersion(row.objectCount),
    eligibleAfter: nullable(row.eligibleAfter, timestamp),
    claimId: nullable(row.claimId, approvalRetentionId),
    runtimeReadiness: code(row.runtimeReadiness),
  };
  if (
    result.requestId !== approvalRetentionId(requestId) ||
    result.inventoryTables < 1 ||
    result.claimEligible !== (result.claimReason === 'ELIGIBLE_FOR_DURABLE_INTENT') ||
    (result.claimEligible && (result.state !== 'LIVE' || result.claimId != null))
  )
    invalid();
  return Object.freeze(result);
}
export function readApprovalRetentionClaim(
  value: unknown,
  expected: { claimId?: string; requestId?: string }
): Readonly<ApprovalRetentionClaim> {
  const row = object(
    value,
    [
      'claimId',
      'requestId',
      'resourceSetKey',
      'version',
      'state',
      'reason',
      'inventorySha256',
      'foreignRequests',
      'verifiedAcknowledgements',
      'foreignCopyState',
      'runtimeReadiness',
    ],
    ['executionClaimId']
  );
  const result = {
    claimId: approvalRetentionId(row.claimId),
    requestId: approvalRetentionId(row.requestId),
    resourceSetKey: scope(row.resourceSetKey),
    version: approvalRetentionVersion(row.version),
    state: code(row.state),
    reason: code(row.reason),
    inventorySha256: digest(row.inventorySha256),
    executionClaimId: nullable(row.executionClaimId, approvalRetentionId),
    foreignRequests: approvalRetentionVersion(row.foreignRequests, 2000),
    verifiedAcknowledgements: approvalRetentionVersion(row.verifiedAcknowledgements, 2000),
    foreignCopyState: code(row.foreignCopyState),
    runtimeReadiness: code(row.runtimeReadiness),
  };
  if (
    (expected.claimId != null && result.claimId !== expected.claimId) ||
    (expected.requestId != null && result.requestId !== expected.requestId) ||
    result.verifiedAcknowledgements > result.foreignRequests ||
    !['ALL_DECLARED_COPIES_CONFIRMED', 'VERIFIED_FOREIGN_COPY_ACKS_PENDING'].includes(
      result.foreignCopyState
    ) ||
    (result.foreignCopyState === 'ALL_DECLARED_COPIES_CONFIRMED' &&
      (result.foreignRequests < 2 || result.foreignRequests !== result.verifiedAcknowledgements))
  )
    invalid();
  return Object.freeze(result);
}
