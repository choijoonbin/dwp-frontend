import { formatDate } from '@dwp-frontend/shared-i18n';

import type { TFunction } from 'i18next';

export function privilegedAccessError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function displayPrivilegedDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

export function privilegedStatusColor(state: string) {
  if (state === 'ACTIVE') return 'success' as const;
  if (state === 'PENDING_APPROVAL') return 'warning' as const;
  if (state === 'DENIED' || state === 'REVOKED') return 'error' as const;
  return 'default' as const;
}

export function privilegedScopeLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'ORG_UNIT') return t('roleGovernance.scopes.ORG_UNIT');
  if (value === 'RESOURCE') return t('roleGovernance.scopes.RESOURCE');
  return t('roleGovernance.scopes.TENANT');
}

export function activationModeLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'SELF_SERVICE') return t('privilegedAccess.activationModes.SELF_SERVICE');
  if (value === 'DISABLED') return t('privilegedAccess.activationModes.DISABLED');
  return t('privilegedAccess.activationModes.APPROVAL');
}

export function assuranceLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'PHISHING_RESISTANT') {
    return t('privilegedAccess.assurance.PHISHING_RESISTANT');
  }
  if (value === 'MFA') return t('privilegedAccess.assurance.MFA');
  return t('privilegedAccess.assurance.SESSION');
}

export function emergencyModeLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'REGISTERED_PRINCIPAL') {
    return t('privilegedAccess.emergencyModes.REGISTERED_PRINCIPAL');
  }
  if (value === 'DUAL_APPROVAL') return t('privilegedAccess.emergencyModes.DUAL_APPROVAL');
  return t('privilegedAccess.emergencyModes.DISABLED');
}

export function delegatedActionLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'ACCESS.ROLE.MANAGE') {
    return t('privilegedAccess.actionsCatalog.ACCESS.ROLE.MANAGE');
  }
  if (value === 'ACCESS.RESOURCE.MANAGE') {
    return t('privilegedAccess.actionsCatalog.ACCESS.RESOURCE.MANAGE');
  }
  return t('privilegedAccess.actionsCatalog.ACCESS.ASSIGNMENT.MANAGE');
}
