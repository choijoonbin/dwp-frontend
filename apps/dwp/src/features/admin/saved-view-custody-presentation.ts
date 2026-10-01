import type { TFunction } from 'i18next';

const SCOPE_KEYS: Readonly<Record<string, string>> = {
  PERSONAL: 'savedViewCustody.scopes.PERSONAL',
  TEAM: 'savedViewCustody.scopes.TEAM',
  TENANT: 'savedViewCustody.scopes.TENANT',
};

const REASON_KEYS: Readonly<Record<string, string>> = {
  OFFBOARDING: 'savedViewCustody.reasons.OFFBOARDING',
  TEAM_REORGANIZATION: 'savedViewCustody.reasons.TEAM_REORGANIZATION',
  OWNER_CORRECTION: 'savedViewCustody.reasons.OWNER_CORRECTION',
};

const STATUS_KEYS: Readonly<Record<string, string>> = {
  ACTIVE: 'savedViewCustody.statuses.ACTIVE',
  INACTIVE: 'savedViewCustody.statuses.INACTIVE',
  SUSPENDED: 'savedViewCustody.statuses.SUSPENDED',
  LOCKED: 'savedViewCustody.statuses.LOCKED',
  DEACTIVATED: 'savedViewCustody.statuses.DEACTIVATED',
  INVITED: 'savedViewCustody.statuses.INVITED',
};

const DISPOSITION_KEYS: Readonly<Record<string, string>> = {
  TRANSFER: 'savedViewCustody.dispositions.TRANSFER',
  RETAIN_ORPHANED: 'savedViewCustody.dispositions.RETAIN_ORPHANED',
};

const ACTION_KEYS: Readonly<Record<string, string>> = {
  REASSIGN: 'savedViewCustody.actionHistory.actions.REASSIGN',
  EXTEND_RETENTION: 'savedViewCustody.actionHistory.actions.EXTEND_RETENTION',
  ARCHIVE_NOW: 'savedViewCustody.actionHistory.actions.ARCHIVE_NOW',
};

export function savedViewScopeLabel(value: string, t: TFunction<'admin'>): string {
  return t(SCOPE_KEYS[value] ?? 'savedViewCustody.scopes.UNKNOWN');
}

export function savedViewReasonLabel(value: string, t: TFunction<'admin'>): string {
  return t(REASON_KEYS[value] ?? 'savedViewCustody.reasons.UNKNOWN');
}

export function savedViewStatusLabel(value: string, t: TFunction<'admin'>): string {
  return t(STATUS_KEYS[value] ?? 'savedViewCustody.statuses.UNKNOWN');
}

export function savedViewDispositionLabel(value: string, t: TFunction<'admin'>): string {
  return t(DISPOSITION_KEYS[value] ?? 'savedViewCustody.dispositions.UNKNOWN');
}

export function savedViewLifecycleActionLabel(value: string, t: TFunction<'admin'>): string {
  return t(ACTION_KEYS[value] ?? 'savedViewCustody.actionHistory.actions.UNKNOWN');
}
