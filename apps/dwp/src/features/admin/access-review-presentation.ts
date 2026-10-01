const VALUES = {
  recommendations: new Set(['KEEP', 'REVIEW', 'UNAVAILABLE']),
  recommendationReasons: new Set([
    'RECENT_ACTIVITY',
    'PRIVILEGED_ROLE',
    'NEVER_SIGNED_IN',
    'INACTIVE_90_DAYS',
    'EVIDENCE_UNAVAILABLE',
  ]),
  sources: new Set(['DIRECT', 'GROUP']),
  decisions: new Set(['PENDING', 'APPROVE', 'REVOKE']),
  remediation: new Set(['NOT_REQUIRED', 'PENDING', 'APPLIED', 'MANUAL_REQUIRED']),
  states: new Set(['DRAFT', 'ACTIVE', 'COMPLETED']),
  scopes: new Set(['TENANT', 'ROLE', 'GROUP']),
  reviewerStrategies: new Set(['TENANT_ADMIN', 'NAMED_REVIEWER']),
} as const;

export type AccessReviewPresentationGroup = keyof typeof VALUES;

export function accessReviewLabelKey(group: AccessReviewPresentationGroup, value: string): string {
  return `accessReviews.${group}.${VALUES[group].has(value) ? value : 'UNKNOWN'}`;
}
