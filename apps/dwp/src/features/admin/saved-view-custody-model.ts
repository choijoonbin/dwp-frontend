import type {
  OrphanedSavedView,
  SavedViewCustodyUser,
  SavedViewOwnershipCandidate,
  SavedViewOwnershipReason,
  SavedViewOwnershipTransferSummary,
  SavedViewScope,
} from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils';

export type ScopeCounts = Record<SavedViewScope, number>;

export type SavedViewCustodyWorkspaceTab = 'PLAN' | 'ORPHANED' | 'HISTORY';

export const SAVED_VIEW_OWNERSHIP_REASONS: SavedViewOwnershipReason[] = [
  'OFFBOARDING',
  'TEAM_REORGANIZATION',
  'OWNER_CORRECTION',
];

export type SavedViewOwnershipExecutionFailure =
  'STALE_REVIEW' | 'PERSONAL_NAME_CONFLICT' | 'SHARED_NAME_CONFLICT' | 'UNKNOWN';

export type SavedViewTargetEligibilityFailure =
  | 'TARGET_INELIGIBLE'
  | 'NO_AFFECTED_VIEWS'
  | 'SOURCE_OWNER_NOT_SUCCESSOR'
  | 'SELF_ASSIGNMENT_NOT_ALLOWED'
  | 'IDENTITY_NOT_ELIGIBLE'
  | 'EVALUATION_UNAVAILABLE'
  | 'MISSING_SURFACE_ACCESS'
  | 'MISSING_TEAM_MEMBERSHIP'
  | 'MISSING_SHARED_VIEW_ADMIN_ROLE'
  | 'PERSONAL_NAME_CONFLICT'
  | 'UNKNOWN';

const MAX_ORPHAN_RETENTION_EXTENSION_MS = 365 * 86_400_000;

export function classifySavedViewOwnershipExecutionFailure(
  error: unknown
): SavedViewOwnershipExecutionFailure {
  if (!(error instanceof HttpError) || error.status !== 409) return 'UNKNOWN';
  const code = errorDetailCode(error);
  if (code === 'SAVED_VIEW_PERSONAL_NAME_CONFLICT' || code === 'SAVED_VIEW_CUSTODY_NAME_CONFLICT') {
    return 'PERSONAL_NAME_CONFLICT';
  }
  if (code === 'SAVED_VIEW_SHARED_NAME_CONFLICT') return 'SHARED_NAME_CONFLICT';
  if (
    code === 'SAVED_VIEW_CUSTODY_STALE' ||
    code === 'OBJECT_VERSION_CONFLICT' ||
    code === 'DECISION_REVISION_CONFLICT'
  ) {
    return 'STALE_REVIEW';
  }
  const message = error.message.toLocaleLowerCase();
  if (
    message.includes('target owner already has an active personal saved view') &&
    message.includes('same name and surface')
  ) {
    return 'PERSONAL_NAME_CONFLICT';
  }
  if (
    message.includes('saved-view ownership changed') ||
    message.includes('saved-view lifecycle changed') ||
    message.includes('orphaned saved view changed') ||
    message.includes('retained saved view changed') ||
    message.includes('saved view is no longer retained')
  ) {
    return 'STALE_REVIEW';
  }
  return 'UNKNOWN';
}

export function classifySavedViewTargetEligibilityFailure(
  error: unknown
): SavedViewTargetEligibilityFailure {
  if (!(error instanceof HttpError)) return 'UNKNOWN';
  const code = errorDetailCode(error);
  if (code === 'SAVED_VIEW_TARGET_INELIGIBLE') return 'TARGET_INELIGIBLE';
  if (isTargetEligibilityFailure(code)) return code;

  const message = error.message.toLocaleLowerCase();
  if (message.includes('active tenant user')) return 'IDENTITY_NOT_ELIGIBLE';
  if (
    message.includes('access to every product surface') ||
    message.includes('not entitled to every affected saved-view surface')
  ) {
    return 'MISSING_SURFACE_ACCESS';
  }
  if (message.includes('belong to every team')) return 'MISSING_TEAM_MEMBERSHIP';
  if (message.includes('tenant shared-view administrator')) {
    return 'MISSING_SHARED_VIEW_ADMIN_ROLE';
  }
  if (message.includes('cannot assign saved-view custody to themselves')) {
    return 'SELF_ASSIGNMENT_NOT_ALLOWED';
  }
  return 'UNKNOWN';
}

function errorDetailCode(error: HttpError): string {
  if (!error.details || typeof error.details !== 'object') return '';
  const details = error.details as Record<string, unknown>;
  for (const key of ['eligibilityReason', 'domainErrorCode', 'errorCode', 'code']) {
    const value = details[key];
    if (typeof value === 'string' && value.trim()) return value.trim().toUpperCase();
  }
  return '';
}

function isTargetEligibilityFailure(value: string): value is SavedViewTargetEligibilityFailure {
  return [
    'NO_AFFECTED_VIEWS',
    'SOURCE_OWNER_NOT_SUCCESSOR',
    'SELF_ASSIGNMENT_NOT_ALLOWED',
    'IDENTITY_NOT_ELIGIBLE',
    'EVALUATION_UNAVAILABLE',
    'MISSING_SURFACE_ACCESS',
    'MISSING_TEAM_MEMBERSHIP',
    'MISSING_SHARED_VIEW_ADMIN_ROLE',
    'PERSONAL_NAME_CONFLICT',
  ].includes(value);
}

export function isValidOrphanRetentionExtension(
  nextRetentionUntil: string | null | undefined,
  currentRetentionUntil: string | null | undefined,
  now = Date.now()
): boolean {
  if (!nextRetentionUntil || !currentRetentionUntil) return false;
  const next = new Date(nextRetentionUntil).getTime();
  const current = new Date(currentRetentionUntil).getTime();
  return (
    isValidSavedViewRetentionDate(nextRetentionUntil, now) &&
    Number.isFinite(current) &&
    next > current
  );
}

export function isValidSavedViewRetentionDate(
  retentionUntil: string | null | undefined,
  now = Date.now()
): boolean {
  if (!retentionUntil) return false;
  const value = new Date(retentionUntil).getTime();
  return Number.isFinite(value) && value > now && value <= now + MAX_ORPHAN_RETENTION_EXTENSION_MS;
}

export function isEligibleSavedViewCustodyTarget(
  user: SavedViewCustodyUser | null | undefined,
  excludedUserIds: Array<number | null | undefined> = []
): user is SavedViewCustodyUser {
  return Boolean(
    user &&
    user.userId > 0 &&
    user.status === 'ACTIVE' &&
    user.identityPlane !== 'PROVIDER' &&
    user.eligibilityStatus !== 'INELIGIBLE' &&
    !excludedUserIds.some((userId) => userId != null && user.userId === userId)
  );
}

export function countSavedViewScopes(
  views: Array<Pick<SavedViewOwnershipCandidate, 'scope'>>
): ScopeCounts {
  return views.reduce<ScopeCounts>(
    (counts, view) => ({ ...counts, [view.scope]: counts[view.scope] + 1 }),
    { PERSONAL: 0, TEAM: 0, TENANT: 0 }
  );
}

export function daysUntil(value: string, now = Date.now()): number {
  return Math.ceil((new Date(value).getTime() - now) / 86_400_000);
}

export function isDueWithin(value: string, days: number, now = Date.now()): boolean {
  return daysUntil(value, now) <= days;
}

export function sortCustodySourceUsers(users: SavedViewCustodyUser[]): SavedViewCustodyUser[] {
  return [...users].sort((left, right) => {
    const leftActive = left.status === 'ACTIVE' ? 1 : 0;
    const rightActive = right.status === 'ACTIVE' ? 1 : 0;
    if (leftActive !== rightActive) return leftActive - rightActive;
    return left.displayName.localeCompare(right.displayName);
  });
}

export function filterOrphanedSavedViews(
  views: OrphanedSavedView[],
  query: string,
  surfaceLabel: (surfaceKey: string) => string
): OrphanedSavedView[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return views;
  return views.filter((view) =>
    [view.name, view.surfaceKey, surfaceLabel(view.surfaceKey), view.scope]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized)
  );
}

export function filterOwnershipHistory(
  history: SavedViewOwnershipTransferSummary[],
  query: string,
  userLabel: (userId: number | null | undefined) => string
): SavedViewOwnershipTransferSummary[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return history;
  return history.filter((entry) =>
    [
      userLabel(entry.sourceOwnerUserId),
      userLabel(entry.targetOwnerUserId),
      entry.sourceOwnerDisplayName,
      entry.targetOwnerDisplayName,
      entry.disposition,
      entry.reasonCode,
      entry.reason,
      entry.sourceReference,
      entry.createdBy,
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized)
  );
}
