import { describe, expect, it } from 'vitest';

import {
  mailPreferencesEqual,
  preferenceTab,
  readinessActionPath,
  resolveReadinessAction,
} from './mail-preferences-model';

import type {
  MailAccount,
  MailAccountReadinessEvidence,
  MailPreferences,
} from '@dwp-frontend/shared-utils';

const NOW = Date.parse('2026-10-28T02:00:00.000Z');

const account: MailAccount = {
  accountId: 'account-1',
  emailAddress: 'user@example.com',
  displayName: 'Work',
  accountKind: 'PERSONAL',
  providerType: 'DWP_SANDBOX',
  connectionState: 'ACTIVE',
  synchronizationState: 'READY',
  defaultAccount: true,
};

const readiness: MailAccountReadinessEvidence = {
  state: 'READY',
  source: 'CONNECTOR_RUNTIME',
  observedAt: '2026-10-28T01:59:00.000Z',
  errorCode: null,
  credentialConfigured: true,
  lastSuccessfulSyncAt: '2026-10-28T01:59:00.000Z',
  lastSuccessfulSyncScope: 'INBOX',
  action: 'NONE',
  consentEvidence: {
    state: 'NOT_REQUIRED',
    source: 'CONNECTOR_RUNTIME',
    observedAt: '2026-10-28T01:59:00.000Z',
    expiresAt: null,
    errorCode: null,
    action: 'NONE',
  },
  tokenEvidence: {
    state: 'NOT_REQUIRED',
    source: 'CONNECTOR_RUNTIME',
    observedAt: '2026-10-28T01:59:00.000Z',
    expiresAt: null,
    errorCode: null,
    action: 'NONE',
  },
  featureReadiness: {},
};

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

  it('retries stale readiness instead of rendering a stale READY receipt as usable', () => {
    expect(resolveReadinessAction(account, readiness, NOW)).toBe('NONE');
    expect(
      resolveReadinessAction(account, { ...readiness, observedAt: '2026-10-28T01:50:00.000Z' }, NOW)
    ).toBe('RETRY');
    expect(resolveReadinessAction(account, undefined, NOW)).toBe('ACTIVATE_EXTERNALLY');
  });
});
