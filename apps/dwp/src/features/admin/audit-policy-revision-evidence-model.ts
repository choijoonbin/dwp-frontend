import type { AuditPolicyImpactSnapshot, AuditPolicyRevision } from '@dwp-frontend/shared-utils';

export type AuditPolicyDiffRow = Readonly<{
  field: string;
  before: unknown;
  after: unknown;
}>;

const POLICY_FIELD_TYPES = {
  standardRetentionDays: 'number',
  extendedRetentionDays: 'number',
  exportLimitRows: 'number',
  requireExportReason: 'boolean',
  integrityEnabled: 'boolean',
  highRiskThreshold: 'number',
} as const;

const IMPACT_COUNT_FIELDS = [
  'auditEventCount',
  'affectedAuditEventCount',
  'affectedActorCount',
  'affectedTargetCount',
  'standardRetentionEventCount',
  'extendedRetentionEventCount',
  'legalHoldEventCount',
  'standardRetentionAffectedEventCount',
  'extendedRetentionAffectedEventCount',
  'highRiskClassificationAffectedEventCount',
] as const;

type ImpactCountField = (typeof IMPACT_COUNT_FIELDS)[number];

const IMPACT_COVERAGE = new Set([
  'COMPLETE_INTERNAL_AUDIT_EVENT_OWNER',
  'UNAVAILABLE_LEGACY_REVISION',
]);
const IMPACT_OWNERS = new Set(['PLATFORM_SYS_AUDIT_EVENTS']);
const IMPACT_EXCLUSIONS = new Set([
  'EXTERNAL_PRODUCT_DATA_RETENTION',
  'EXTERNAL_SHARING_POPULATIONS',
  'EXTERNAL_LEGAL_HOLD_POPULATIONS',
  'FILTER_SPECIFIC_EXPORT_POPULATIONS',
  'LEGACY_REVISION_NOT_SNAPSHOTTED',
]);

export function policyImpactEvidenceAvailable(snapshot: AuditPolicyImpactSnapshot): boolean {
  return snapshot.coverageState === 'COMPLETE_INTERNAL_AUDIT_EVENT_OWNER';
}

export function policyImpactCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function policyImpactCoverageLabelKey(value: unknown): string {
  return typeof value === 'string' && IMPACT_COVERAGE.has(value)
    ? `auditControl.governance.revisions.impact.coverage.${value}`
    : 'auditControl.governance.revisions.impact.coverage.UNKNOWN';
}

export function policyImpactOwnerLabelKey(value: unknown): string {
  return typeof value === 'string' && IMPACT_OWNERS.has(value)
    ? `auditControl.governance.revisions.impact.owners.${value}`
    : 'auditControl.governance.revisions.impact.owners.UNKNOWN';
}

export function policyImpactExclusionLabelKey(value: unknown): string {
  return typeof value === 'string' && IMPACT_EXCLUSIONS.has(value)
    ? `auditControl.governance.revisions.impact.exclusions.${value}`
    : 'auditControl.governance.revisions.impact.exclusions.UNKNOWN';
}

export function policyImpactHash(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

export function policyImpactHashLabel(value: unknown): string | null {
  const hash = policyImpactHash(value);
  return hash ? `${hash.slice(0, 12)}…` : null;
}

export function policyImpactCounts(
  snapshot: AuditPolicyImpactSnapshot
): Array<{ field: ImpactCountField; value: number | null }> {
  const evidenceAvailable = policyImpactEvidenceAvailable(snapshot);
  return IMPACT_COUNT_FIELDS.map((field) => ({
    field,
    value: evidenceAvailable ? policyImpactCount(snapshot[field]) : null,
  }));
}

function isKnownPolicyField(field: string): field is keyof typeof POLICY_FIELD_TYPES {
  return Object.prototype.hasOwnProperty.call(POLICY_FIELD_TYPES, field);
}

export function policyRevisionFieldLabelKey(field: string): string {
  return isKnownPolicyField(field)
    ? `auditControl.governance.revisions.fields.${field}`
    : 'auditControl.governance.revisions.fields.UNKNOWN';
}

function safePolicyValue(field: string, value: unknown): number | boolean | null {
  const expected = POLICY_FIELD_TYPES[field as keyof typeof POLICY_FIELD_TYPES];
  if (expected === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
  if (expected === 'boolean' && typeof value === 'boolean') return value;
  return null;
}

export function policyRevisionEvidenceRows(
  revision: Pick<AuditPolicyRevision, 'diff'>
): AuditPolicyDiffRow[] {
  return Object.entries(revision.diff).map(([field, value]) => ({
    field: isKnownPolicyField(field) ? field : 'UNKNOWN',
    before: safePolicyValue(field, value.before),
    after: safePolicyValue(field, value.after),
  }));
}
