import type {
  MailAccount,
  MailAccountReadinessEvidence,
  MailPreferences,
  MailReadinessAction,
} from '@dwp-frontend/shared-utils';

import { mailAccountReadinessIsReady } from './mail-account-capability-presentation';

export type PreferenceTab = 'accounts' | 'reading' | 'notifications' | 'shortcuts';

const PREFERENCE_TABS = new Set<PreferenceTab>([
  'accounts',
  'reading',
  'notifications',
  'shortcuts',
]);

export function preferenceTab(value: string | null): PreferenceTab {
  return value && PREFERENCE_TABS.has(value as PreferenceTab)
    ? (value as PreferenceTab)
    : 'accounts';
}

export function mailPreferencesEqual(left: MailPreferences, right: MailPreferences) {
  return (
    left.density === right.density &&
    left.remoteImages === right.remoteImages &&
    left.sendDelaySeconds === right.sendDelaySeconds &&
    left.keyboardShortcuts === right.keyboardShortcuts &&
    left.notifyNewMail === right.notifyNewMail &&
    left.notifySharedAssignment === right.notifySharedAssignment &&
    left.notifyFollowUpDue === right.notifyFollowUpDue &&
    (left.defaultAccountId ?? null) === (right.defaultAccountId ?? null) &&
    (left.defaultSignatureId ?? null) === (right.defaultSignatureId ?? null)
  );
}

export function resolveReadinessAction(
  account: MailAccount,
  readiness?: MailAccountReadinessEvidence,
  now = Date.now()
): MailReadinessAction {
  if (account.connectionState === 'REAUTHENTICATION_REQUIRED') return 'ACTIVATE_EXTERNALLY';
  const actions = [
    readiness?.action,
    readiness?.consentEvidence?.action,
    readiness?.tokenEvidence?.action,
  ];
  const reportedAction = actions.find((action) => action && action !== 'NONE');
  if (reportedAction) return reportedAction;
  if (!readiness) return 'ACTIVATE_EXTERNALLY';
  return mailAccountReadinessIsReady(readiness, now) ? 'NONE' : 'RETRY';
}

export function readinessActionPath(action: MailReadinessAction, accountId: string) {
  const params = new URLSearchParams();
  if (action === 'REQUEST_ACCESS') {
    params.set('requestResource', 'APP.MAIL');
    params.set('requestAccountId', accountId);
  } else {
    params.set('requestManagement', 'APP.MAIL');
    params.set('requestSurface', 'mail.management');
    params.set('requestAccountId', accountId);
  }
  return `/apps?${params.toString()}`;
}
