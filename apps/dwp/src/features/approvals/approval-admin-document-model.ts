import { validateApprovalDocumentRules } from '@dwp-frontend/shared-utils/api/approval-document-api';
import type {
  ApprovalDocumentFieldRule,
  ApprovalDocumentHold,
  ApprovalDocumentPolicy,
  ApprovalDocumentRules,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

export const approvalDocumentFlags = [
  'allowComments',
  'allowPrint',
  'allowJsonExport',
  'allowArchiveExport',
  'includeComments',
  'includeEvidence',
] as const;
export const approvalDocumentBounds = [
  ['maxBatchItems', 1, 50],
  ['maxBytes', 1024, 5242880],
  ['snapshotTtlSeconds', 60, 3600],
  ['evidenceRetentionDays', 1, 3650],
] as const;
export const approvalDocumentFieldTypes: readonly ApprovalDocumentFieldRule['type'][] = [
  'STRING',
  'NUMBER',
  'DECIMAL_STRING',
  'BOOLEAN',
  'STRING_LIST',
  'OBJECT',
  'OBJECT_LIST',
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const version = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const person = (value: unknown): value is number => version(value) && value > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && uuid.test(value);
const timestamp = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
export const approvalDocumentRequestIdValid = (value: string) => uuid.test(value);
export function approvalDocumentRulesValid(rules: unknown): rules is ApprovalDocumentRules {
  try {
    validateApprovalDocumentRules(rules as ApprovalDocumentRules);
    return true;
  } catch {
    return false;
  }
}
export function approvalDocumentPolicyValid(policy: unknown): policy is ApprovalDocumentPolicy {
  if (
    !record(policy) ||
    !identifier(policy.policyId) ||
    !version(policy.version) ||
    !(
      policy.resourceSetKey === 'ALL' ||
      (typeof policy.resourceSetKey === 'string' &&
        /^RS_[A-Z0-9_]{1,76}$/.test(policy.resourceSetKey))
    )
  )
    return false;
  const revision = (item: unknown): item is ApprovalDocumentPolicy['published'] =>
    Boolean(
      record(item) &&
      version(item.revision) &&
      typeof item.sha256 === 'string' &&
      /^[0-9a-f]{64}$/.test(item.sha256) &&
      timestamp(item.createdAt) &&
      (item.makerUserId === null || person(item.makerUserId)) &&
      approvalDocumentRulesValid(item.rules)
    );
  return (
    revision(policy.published) &&
    (policy.pending === null ||
      (revision(policy.pending) &&
        person(policy.pending.makerUserId) &&
        policy.pending.revision > policy.published.revision))
  );
}
export function approvalDocumentMakerBlocked(
  maker: number | null | undefined,
  actor: string
): boolean {
  return !person(maker) || !/^[1-9][0-9]*$/.test(actor) || String(maker) === actor;
}
export function approvalDocumentHoldValid(
  hold: unknown,
  requestId: string
): hold is ApprovalDocumentHold {
  return Boolean(
    record(hold) &&
    hold.requestId === requestId &&
    uuid.test(requestId) &&
    version(hold.version) &&
    typeof hold.active === 'boolean' &&
    typeof hold.preservationPending === 'boolean' &&
    hold.purgeEligible === false &&
    typeof hold.purgeState === 'string' &&
    hold.purgeState.length > 0 &&
    timestamp(hold.retainUntil) &&
    Array.isArray(hold.journal) &&
    hold.journal.length <= 500 &&
    (hold.pending === null ||
      (record(hold.pending) &&
        identifier(hold.pending.proposalId) &&
        person(hold.pending.makerUserId) &&
        (hold.pending.operation === 'PLACE' || hold.pending.operation === 'RELEASE') &&
        (hold.pending.operation === 'PLACE') !== hold.active &&
        typeof hold.pending.reason === 'string' &&
        timestamp(hold.pending.createdAt))) &&
    hold.preservationPending ===
      (record(hold.pending) && hold.pending.operation === 'PLACE' && !hold.active) &&
    hold.journal.every(
      (entry) =>
        record(entry) &&
        identifier(entry.entryId) &&
        version(entry.version) &&
        person(entry.makerUserId) &&
        person(entry.checkerUserId) &&
        entry.makerUserId !== entry.checkerUserId &&
        (entry.operation === 'PLACE' || entry.operation === 'RELEASE') &&
        typeof entry.reason === 'string' &&
        typeof entry.reviewComment === 'string' &&
        timestamp(entry.occurredAt)
    )
  );
}
export function approvalDocumentFieldCount(fields: readonly ApprovalDocumentFieldRule[]): number {
  return fields.reduce((count, field) => count + 1 + approvalDocumentFieldCount(field.children), 0);
}
export function approvalDocumentNewField(
  fields: readonly ApprovalDocumentFieldRule[]
): ApprovalDocumentFieldRule {
  const keys = new Set(fields.map((field) => field.key));
  let index = 1;
  while (keys.has(`field_${index}`)) index += 1;
  return { key: `field_${index}`, type: 'STRING', maxLength: 1000, children: [], maxRows: null };
}
export function approvalDocumentFieldType(
  field: ApprovalDocumentFieldRule,
  type: ApprovalDocumentFieldRule['type']
): ApprovalDocumentFieldRule {
  return {
    ...field,
    type,
    children: ['OBJECT', 'OBJECT_LIST'].includes(type) ? field.children : [],
    maxRows: type === 'OBJECT_LIST' ? (field.maxRows ?? 20) : null,
  };
}
export function approvalDocumentRuleDifferences(
  current: ApprovalDocumentRules,
  proposed: ApprovalDocumentRules
): string[] {
  return (Object.keys(current) as (keyof ApprovalDocumentRules)[]).filter(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(proposed[key])
  );
}
