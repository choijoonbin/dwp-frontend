import { describe, expect, it } from 'vitest';

import { mailPreferencesEqual, preferenceTab, readinessActionPath } from './mail-preferences-model';

import type { MailPreferences } from '@dwp-frontend/shared-utils';

function preferences(overrides: Partial<MailPreferences> = {}): MailPreferences {
  return {
    density: 'COMFORTABLE',
    remoteImages: 'ASK',
    sendDelaySeconds: 5,
    keyboardShortcuts: true,
    notifyNewMail: true,
    notifySharedAssignment: true,
    notifyFollowUpDue: true,
    defaultAccountId: 'account-1',
    defaultSignatureId: null,
    version: 1,
    ...overrides,
  };
}

describe('mail preferences draft state', () => {
  it('keeps a valid tab in the URL and falls back for unsupported values', () => {
    expect(preferenceTab('notifications')).toBe('notifications');
    expect(preferenceTab('unknown')).toBe('accounts');
    expect(preferenceTab(null)).toBe('accounts');
  });

  it('detects editable changes while ignoring server version churn', () => {
    expect(mailPreferencesEqual(preferences(), preferences({ version: 2 }))).toBe(true);
    expect(mailPreferencesEqual(preferences(), preferences({ notifyNewMail: false }))).toBe(false);
  });

  it('routes recovery to supported access or administrator handoff contracts', () => {
    expect(readinessActionPath('REQUEST_ACCESS', 'account-1')).toBe(
      '/apps?requestResource=APP.MAIL&requestAccountId=account-1'
    );
    expect(readinessActionPath('ACTIVATE_EXTERNALLY', 'account-1')).toBe(
      '/apps?requestManagement=APP.MAIL&requestSurface=mail.management&requestAccountId=account-1'
    );
  });
});
