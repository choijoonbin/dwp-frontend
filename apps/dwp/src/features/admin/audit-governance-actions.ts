import type { AuditPolicyRevision } from '@dwp-frontend/shared-utils';

export type AuditPolicyRevisionAction = 'submit' | 'approve' | 'reject' | 'publish' | 'rollback';

export function auditPolicyRevisionPageState(page: {
  items: AuditPolicyRevision[];
  hasMore: boolean;
}) {
  return {
    items: page.items,
    partial: page.hasMore,
    showEmpty: page.items.length === 0 && !page.hasMore,
    createBlocked: false,
  };
}

export function integrityVerificationPresentation(value: string): {
  labelKey: string;
  color: 'success' | 'error' | 'warning';
  verified: boolean;
} {
  if (value === 'VERIFIED') {
    return { labelKey: 'auditControl.integrityStatus.VERIFIED', color: 'success', verified: true };
  }
  if (value === 'FAILED') {
    return { labelKey: 'auditControl.integrityStatus.FAILED', color: 'error', verified: false };
  }
  if (value === 'UNAVAILABLE') {
    return {
      labelKey: 'auditControl.integrityStatus.UNAVAILABLE',
      color: 'warning',
      verified: false,
    };
  }
  return {
    labelKey: 'auditControl.integrityStatus.UNKNOWN',
    color: 'warning',
    verified: false,
  };
}

/**
 * Mirrors the platform policy workflow and fails closed when the actor cannot be identified.
 * The pending approval records its requester explicitly; that requester must never receive
 * approve/reject controls because the server enforces the same separation of duties.
 */
export function auditPolicyRevisionActions(
  revision: AuditPolicyRevision,
  actorId: string | null | undefined,
  canConfigure: boolean
): AuditPolicyRevisionAction[] {
  if (!canConfigure || !actorId?.trim()) return [];
  if (revision.lifecycleState === 'DRAFT') return ['submit'];
  if (revision.lifecycleState === 'APPROVED') return ['publish'];
  if (revision.lifecycleState === 'SUPERSEDED') return ['rollback'];
  if (revision.lifecycleState !== 'IN_REVIEW') return [];

  const requester = revision.approval?.requestedBy?.trim();
  if (
    revision.approval?.lifecycleState !== 'PENDING' ||
    !requester ||
    requester.toLocaleLowerCase() === actorId.trim().toLocaleLowerCase()
  ) {
    return [];
  }
  return ['approve', 'reject'];
}
