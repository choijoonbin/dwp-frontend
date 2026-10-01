import { describe, expect, it } from 'vitest';

import type { AuditPolicyRevision } from '@dwp-frontend/shared-utils';

import {
  auditPolicyRevisionPageState,
  auditPolicyRevisionActions,
  integrityVerificationPresentation,
} from './audit-governance-actions';

const revision = (overrides: Partial<AuditPolicyRevision>): AuditPolicyRevision => ({
  revisionId: 'revision-1',
  revisionNumber: 1,
  lifecycleState: 'IN_REVIEW',
  standardRetentionDays: 365,
  extendedRetentionDays: 2555,
  exportLimitRows: 10_000,
  requireExportReason: true,
  integrityEnabled: true,
  highRiskThreshold: 70,
  changeReason: 'Review retention',
  diff: {},
  contentSha256: 'a'.repeat(64),
  impactSnapshot: {
    observedAt: '2026-09-29T00:00:00Z',
    coverageState: 'UNAVAILABLE_LEGACY_REVISION',
    includedOwners: [],
    exclusions: ['LEGACY_REVISION_NOT_SNAPSHOTTED'],
    auditEventCount: 0,
    affectedAuditEventCount: 0,
    affectedActorCount: 0,
    affectedTargetCount: 0,
    standardRetentionEventCount: 0,
    extendedRetentionEventCount: 0,
    legalHoldEventCount: 0,
    standardRetentionAffectedEventCount: 0,
    extendedRetentionAffectedEventCount: 0,
    highRiskClassificationAffectedEventCount: 0,
    exportableEventCountBefore: 0,
    exportableEventCountAfter: 0,
    integrityProtectedEventCountBefore: 0,
    integrityProtectedEventCountAfter: 0,
  },
  impactSha256: 'b'.repeat(64),
  createdBy: '41',
  createdAt: '2026-09-29T00:00:00Z',
  version: 1,
  approval: {
    approvalId: 'approval-1',
    lifecycleState: 'PENDING',
    requestedBy: '41',
    requestedAt: '2026-09-29T00:00:00Z',
    expiresAt: '2026-09-30T00:00:00Z',
    version: 0,
  },
  ...overrides,
});

describe('auditPolicyRevisionActions', () => {
  it('keeps creation available with partial terminal history or a stale approved revision', () => {
    const observed = revision({ lifecycleState: 'PUBLISHED' });
    const terminalHistory = Array.from({ length: 100 }, () => observed);

    expect(auditPolicyRevisionPageState({ items: terminalHistory, hasMore: true })).toEqual({
      items: terminalHistory,
      partial: true,
      showEmpty: false,
      createBlocked: false,
    });
    expect(auditPolicyRevisionPageState({ items: [], hasMore: true })).toMatchObject({
      partial: true,
      showEmpty: false,
      createBlocked: false,
    });
    expect(
      auditPolicyRevisionPageState({
        items: [revision({ lifecycleState: 'APPROVED' })],
        hasMore: true,
      }).createBlocked
    ).toBe(false);
  });

  it('fails closed for an unknown integrity verification status', () => {
    expect(integrityVerificationPresentation('FUTURE')).toEqual({
      labelKey: 'auditControl.integrityStatus.UNKNOWN',
      color: 'warning',
      verified: false,
    });
  });

  it('hides approve and reject from the approval requester', () => {
    expect(auditPolicyRevisionActions(revision({}), '41', true)).toEqual([]);
  });

  it('allows an independently identified configurator to decide a pending approval', () => {
    expect(auditPolicyRevisionActions(revision({}), '52', true)).toEqual(['approve', 'reject']);
  });

  it('fails closed without exact configure authority or an actor identity', () => {
    expect(auditPolicyRevisionActions(revision({}), '52', false)).toEqual([]);
    expect(auditPolicyRevisionActions(revision({}), null, true)).toEqual([]);
  });
});
