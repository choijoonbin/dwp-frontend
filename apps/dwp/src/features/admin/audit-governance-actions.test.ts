import { describe, expect, it } from 'vitest';

import type { AuditPolicyRevision } from '@dwp-frontend/shared-utils';

import {
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
