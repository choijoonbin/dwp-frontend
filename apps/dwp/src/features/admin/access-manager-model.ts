import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import type { IdentityUserAccess } from '@dwp-frontend/shared-utils';

export function sortedRoleCodes(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function equalRoleCodes(left: string[], right: string[]): boolean {
  const normalizedLeft = sortedRoleCodes(left);
  const normalizedRight = sortedRoleCodes(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

export function identityInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function effectiveRoleCodes(user: IdentityUserAccess): string[] {
  return user.effectiveRoles?.length ? user.effectiveRoles : user.roles;
}

export function formatIdentityDateTime(
  value: string | null | undefined,
  locale: string,
  fallback: string
): string {
  if (!value) return fallback;
  return formatDate(
    value,
    { dateStyle: 'medium', timeStyle: 'short' },
    resolveSupportedLocale(locale)
  );
}

const IDENTITY_STATUS_LABEL_KEYS: Record<string, string> = {
  ACTIVE: 'common.status.ACTIVE',
  INVITED: 'common.status.INVITED',
  INACTIVE: 'common.status.INACTIVE',
};

const MANAGEMENT_REASON_LABEL_KEYS: Record<string, string> = {
  SELF: 'access.managementReasons.SELF',
  IDENTITY_INACTIVE: 'access.managementReasons.IDENTITY_INACTIVE',
  PROTECTED_ROLE: 'access.managementReasons.PROTECTED_ROLE',
  ROLE_ASSIGNMENT_REQUIRES_TENANT_ADMIN:
    'access.managementReasons.ROLE_ASSIGNMENT_REQUIRES_TENANT_ADMIN',
};

export function identityStatusLabelKey(status: string): string {
  return IDENTITY_STATUS_LABEL_KEYS[status] ?? 'access.statusUnknown';
}

export function managementReasonLabelKey(reason: string | null | undefined): string {
  if (!reason) return 'access.managementReasons.UNKNOWN';
  return MANAGEMENT_REASON_LABEL_KEYS[reason] ?? 'access.managementReasons.UNKNOWN';
}
