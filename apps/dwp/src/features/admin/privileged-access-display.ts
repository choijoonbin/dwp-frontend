import { formatDate } from '@dwp-frontend/shared-i18n';

import type { TFunction } from 'i18next';

export function privilegedAccessError(_error: unknown, fallback: string) {
  return fallback;
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
  if (value === 'TENANT') return t('roleGovernance.scopes.TENANT');
  if (value === 'ORG_UNIT') return t('roleGovernance.scopes.ORG_UNIT');
  if (value === 'RESOURCE') return t('roleGovernance.scopes.RESOURCE');
  return t('roleGovernance.scopes.UNKNOWN');
}

export function activationModeLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'SELF_SERVICE') return t('privilegedAccess.activationModes.SELF_SERVICE');
  if (value === 'APPROVAL') return t('privilegedAccess.activationModes.APPROVAL');
  if (value === 'DISABLED') return t('privilegedAccess.activationModes.DISABLED');
  return t('privilegedAccess.activationModes.UNKNOWN');
}

export function assuranceLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'PHISHING_RESISTANT') {
    return t('privilegedAccess.assurance.PHISHING_RESISTANT');
  }
  if (value === 'MFA') return t('privilegedAccess.assurance.MFA');
  if (value === 'SESSION') return t('privilegedAccess.assurance.SESSION');
  return t('privilegedAccess.assurance.UNKNOWN');
}

export function emergencyModeLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'REGISTERED_PRINCIPAL') {
    return t('privilegedAccess.emergencyModes.REGISTERED_PRINCIPAL');
  }
  if (value === 'DUAL_APPROVAL') return t('privilegedAccess.emergencyModes.DUAL_APPROVAL');
  if (value === 'DISABLED') return t('privilegedAccess.emergencyModes.DISABLED');
  return t('privilegedAccess.emergencyModes.UNKNOWN');
}

export function delegatedActionLabel(value: string, t: TFunction<'admin'>): string {
  if (value === 'ACCESS.ROLE.MANAGE') {
    return t('privilegedAccess.actionsCatalog.ACCESS.ROLE.MANAGE');
  }
  if (value === 'ACCESS.RESOURCE.MANAGE') {
    return t('privilegedAccess.actionsCatalog.ACCESS.RESOURCE.MANAGE');
  }
  if (value === 'ACCESS.ASSIGNMENT.MANAGE') {
    return t('privilegedAccess.actionsCatalog.ACCESS.ASSIGNMENT.MANAGE');
  }
  return t('privilegedAccess.actionsCatalog.UNKNOWN');
}

const PRIVILEGED_STATES = new Set([
  'ACTIVE',
  'PENDING_APPROVAL',
  'DENIED',
  'CANCELLED',
  'REVOKED',
  'EXPIRED',
  'RETIRED',
  'SUSPENDED',
]);
const VERIFICATION_STATES = new Set(['NOT_VERIFIED', 'VERIFIED', 'OVERDUE']);

export function privilegedStateLabelKey(value: string): string {
  return `privilegedAccess.states.${PRIVILEGED_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export function privilegedVerificationLabelKey(value: string): string {
  return `privilegedAccess.verification.states.${
    VERIFICATION_STATES.has(value) ? value : 'UNKNOWN'
  }`;
}
