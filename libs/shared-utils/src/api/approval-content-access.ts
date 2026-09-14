export type ApprovalContentAccessState = 'FULL' | 'REDACTED';

export type ApprovalContentAccessReason =
  | 'CURRENT_AUTHORITY_VERIFIED'
  | 'LEGACY_CURRENT_AUTHORITY_VERIFIED'
  | 'CURRENT_AUTHORITY_UNAVAILABLE'
  | 'CURRENT_IDENTITY_INACTIVE'
  | 'CURRENT_PERMISSION_REVOKED'
  | 'TASK_NOT_AVAILABLE'
  | 'DELEGATION_AUTHORITY_REVOKED'
  | 'CURRENT_ROLE_REVOKED';

export type ApprovalContentAccess = {
  state: ApprovalContentAccessState;
  reason: ApprovalContentAccessReason;
  evaluatedAt: string;
};

export type ResolvedApprovalContentAccess = Readonly<{
  full: boolean;
  reason: ApprovalContentAccessReason | 'UNKNOWN';
  evaluatedAt: string | null;
}>;

const APPROVAL_CONTENT_ACCESS_REASONS = new Set<ApprovalContentAccessReason>([
  'CURRENT_AUTHORITY_VERIFIED',
  'LEGACY_CURRENT_AUTHORITY_VERIFIED',
  'CURRENT_AUTHORITY_UNAVAILABLE',
  'CURRENT_IDENTITY_INACTIVE',
  'CURRENT_PERMISSION_REVOKED',
  'TASK_NOT_AVAILABLE',
  'DELEGATION_AUTHORITY_REVOKED',
  'CURRENT_ROLE_REVOKED',
]);

const APPROVAL_FULL_CONTENT_ACCESS_REASONS = new Set<ApprovalContentAccessReason>([
  'CURRENT_AUTHORITY_VERIFIED',
  'LEGACY_CURRENT_AUTHORITY_VERIFIED',
]);

export function resolveApprovalContentAccess(detail: {
  contentAccess?: unknown;
}): ResolvedApprovalContentAccess {
  const access = detail.contentAccess;
  if (typeof access !== 'object' || access === null || Array.isArray(access)) {
    return { full: false, reason: 'UNKNOWN', evaluatedAt: null };
  }
  const value = access as Record<string, unknown>;
  const reason =
    typeof value.reason === 'string' &&
    APPROVAL_CONTENT_ACCESS_REASONS.has(value.reason as ApprovalContentAccessReason)
      ? (value.reason as ApprovalContentAccessReason)
      : 'UNKNOWN';
  const evaluatedAt =
    typeof value.evaluatedAt === 'string' && Number.isFinite(Date.parse(value.evaluatedAt))
      ? value.evaluatedAt
      : null;
  const full =
    value.state === 'FULL' &&
    reason !== 'UNKNOWN' &&
    APPROVAL_FULL_CONTENT_ACCESS_REASONS.has(reason) &&
    evaluatedAt !== null;
  return { full, reason: full || value.state === 'REDACTED' ? reason : 'UNKNOWN', evaluatedAt };
}
