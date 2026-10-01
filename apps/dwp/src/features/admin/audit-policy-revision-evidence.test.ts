import { describe, expect, it } from 'vitest';

import {
  policyImpactCounts,
  policyImpactCoverageLabelKey,
  policyImpactEvidenceAvailable,
  policyImpactExclusionLabelKey,
  policyImpactHash,
  policyImpactHashLabel,
  policyImpactOwnerLabelKey,
  policyRevisionEvidenceRows,
} from './audit-policy-revision-evidence-model';

import type { AuditPolicyImpactSnapshot } from '@dwp-frontend/shared-utils';

const impact = {
  observedAt: '2026-10-01T00:00:00Z',
  coverageState: 'COMPLETE_INTERNAL_AUDIT_EVENT_OWNER',
  includedOwners: ['PLATFORM_SYS_AUDIT_EVENTS'],
  exclusions: ['EXTERNAL_PRODUCT_DATA_RETENTION'],
  auditEventCount: 120,
  affectedAuditEventCount: 30,
  affectedActorCount: 9,
  affectedTargetCount: 14,
  standardRetentionEventCount: 80,
  extendedRetentionEventCount: 40,
  legalHoldEventCount: 4,
  standardRetentionAffectedEventCount: 20,
  extendedRetentionAffectedEventCount: 10,
  highRiskClassificationAffectedEventCount: 6,
  exportableEventCountBefore: 100,
  exportableEventCountAfter: 50,
  integrityProtectedEventCountBefore: 0,
  integrityProtectedEventCountAfter: 120,
} as AuditPolicyImpactSnapshot;

describe('audit policy revision evidence', () => {
  it('keeps every canonical before and after value for review', () => {
    expect(
      policyRevisionEvidenceRows({
        diff: {
          standardRetentionDays: { before: 365, after: 730 },
          requireExportReason: { before: false, after: true },
        },
      })
    ).toEqual([
      { field: 'standardRetentionDays', before: 365, after: 730 },
      { field: 'requireExportReason', before: false, after: true },
    ]);
  });

  it('fails closed for unknown fields and non-scalar values', () => {
    expect(
      policyRevisionEvidenceRows({
        diff: {
          internalPolicyDocument: { before: { secret: true }, after: ['raw'] },
          exportLimitRows: { before: { invalid: true }, after: 5000 },
        },
      })
    ).toEqual([
      { field: 'UNKNOWN', before: null, after: null },
      { field: 'exportLimitRows', before: null, after: 5000 },
    ]);
  });

  it('projects only bounded immutable impact evidence', () => {
    expect(policyImpactCounts(impact)).toContainEqual({
      field: 'affectedAuditEventCount',
      value: 30,
    });
    expect(
      policyImpactCounts({ ...impact, affectedActorCount: -1 } as AuditPolicyImpactSnapshot)
    ).toContainEqual({ field: 'affectedActorCount', value: null });
    expect(policyImpactHash('a'.repeat(64))).toBe('a'.repeat(64));
    expect(policyImpactHashLabel('a'.repeat(64))).toBe('aaaaaaaaaaaa…');
    expect(policyImpactHash('RAW-HASH')).toBeNull();
  });

  it('does not present legacy or unknown backfill zeroes as observed counts', () => {
    const legacy = {
      ...impact,
      coverageState: 'UNAVAILABLE_LEGACY_REVISION',
      auditEventCount: 0,
      affectedAuditEventCount: 0,
    } as AuditPolicyImpactSnapshot;
    const unknown = { ...impact, coverageState: 'FUTURE_COVERAGE' } as AuditPolicyImpactSnapshot;

    expect(policyImpactEvidenceAvailable(legacy)).toBe(false);
    expect(policyImpactCounts(legacy).every(({ value }) => value === null)).toBe(true);
    expect(policyImpactEvidenceAvailable(unknown)).toBe(false);
    expect(policyImpactCounts(unknown).every(({ value }) => value === null)).toBe(true);
  });

  it('uses localized fallbacks for future coverage, owner, and exclusion values', () => {
    expect(policyImpactCoverageLabelKey('FUTURE')).toBe(
      'auditControl.governance.revisions.impact.coverage.UNKNOWN'
    );
    expect(policyImpactOwnerLabelKey('FUTURE')).toBe(
      'auditControl.governance.revisions.impact.owners.UNKNOWN'
    );
    expect(policyImpactExclusionLabelKey('FUTURE')).toBe(
      'auditControl.governance.revisions.impact.exclusions.UNKNOWN'
    );
    expect(policyImpactExclusionLabelKey('LEGACY_REVISION_NOT_SNAPSHOTTED')).toBe(
      'auditControl.governance.revisions.impact.exclusions.LEGACY_REVISION_NOT_SNAPSHOTTED'
    );
  });
});
