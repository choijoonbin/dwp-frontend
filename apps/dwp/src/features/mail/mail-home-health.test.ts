import { describe, expect, it } from 'vitest';

import {
  MAIL_HOME_STALE_AFTER_MS,
  mailHomeHealthActionPath,
  resolveMailHomeHealth,
} from './mail-home-health';

import type { MailAccount } from '@dwp-frontend/shared-utils';

const NOW = Date.parse('2026-10-28T02:00:00.000Z');

function account(overrides: Partial<MailAccount> = {}): MailAccount {
  return {
    accountId: 'account-1',
    emailAddress: 'user@example.com',
    displayName: 'Work',
    accountKind: 'PERSONAL',
    providerType: 'MICROSOFT_GRAPH',
    connectionState: 'ACTIVE',
    synchronizationState: 'READY',
    defaultAccount: true,
    readiness: {
      state: 'READY',
      source: 'CONNECTOR_RUNTIME',
      observedAt: '2026-10-28T01:59:00.000Z',
      credentialConfigured: true,
      lastSuccessfulSyncAt: '2026-10-28T01:55:00.000Z',
      lastSuccessfulSyncScope: 'INBOX',
      errorCode: null,
      action: 'NONE',
      consentEvidence: {
        state: 'VERIFIED',
        source: 'CONNECTOR_RUNTIME',
        observedAt: '2026-10-28T01:59:00.000Z',
        expiresAt: null,
        errorCode: null,
        action: 'NONE',
      },
      tokenEvidence: {
        state: 'VERIFIED',
        source: 'CONNECTOR_RUNTIME',
        observedAt: '2026-10-28T01:59:00.000Z',
        expiresAt: '2026-10-28T03:00:00.000Z',
        errorCode: null,
        action: 'NONE',
      },
      featureReadiness: {},
    },
    ...overrides,
  };
}

describe('mail home health', () => {
  it('distinguishes accounts that are missing, stale, and healthy', () => {
    expect(resolveMailHomeHealth([], NOW).state).toBe('NO_ACCOUNT');
    expect(
      resolveMailHomeHealth(
        [
          account({
            readiness: {
              ...account().readiness!,
              lastSuccessfulSyncAt: '2026-10-28T00:00:00.000Z',
            },
          }),
        ],
        NOW
      ).state
    ).toBe('STALE');
    expect(resolveMailHomeHealth([account()], NOW).state).toBe('HEALTHY');
  });

  it('keeps external provider activation visibly blocked', () => {
    expect(
      resolveMailHomeHealth([account({ connectionState: 'REAUTHENTICATION_REQUIRED' })], NOW)
    ).toMatchObject({ state: 'BLOCKED_EXTERNAL', affectedAccountCount: 1 });
    expect(
      resolveMailHomeHealth(
        [
          account({
            readiness: {
              ...account().readiness!,
              consentEvidence: {
                ...account().readiness!.consentEvidence!,
                state: 'REQUIRED',
                action: 'ACTIVATE_EXTERNALLY',
              },
            },
          }),
        ],
        NOW
      )
    ).toMatchObject({ state: 'BLOCKED_EXTERNAL', affectedAccountCount: 1 });
  });

  it('classifies disconnected or current negative readiness evidence as action required', () => {
    expect(
      resolveMailHomeHealth([account({ connectionState: 'DISCONNECTED' })], NOW)
    ).toMatchObject({ state: 'ACTION_REQUIRED', affectedAccountCount: 1 });
    expect(
      resolveMailHomeHealth(
        [
          account({
            readiness: {
              ...account().readiness!,
              credentialConfigured: false,
              action: 'CONTACT_ADMIN',
            },
          }),
        ],
        NOW
      )
    ).toMatchObject({ state: 'ACTION_REQUIRED', affectedAccountCount: 1 });
  });

  it('keeps suspended connections and paused synchronization separate from recovery actions', () => {
    expect(resolveMailHomeHealth([account({ connectionState: 'SUSPENDED' })], NOW).state).toBe(
      'PAUSED'
    );
    expect(resolveMailHomeHealth([account({ synchronizationState: 'PAUSED' })], NOW).state).toBe(
      'PAUSED'
    );
  });

  it('treats the 30 minute boundary as current and anything older as stale', () => {
    const atBoundary = new Date(NOW - MAIL_HOME_STALE_AFTER_MS).toISOString();
    const beyondBoundary = new Date(NOW - MAIL_HOME_STALE_AFTER_MS - 1).toISOString();
    const withSyncAt = (lastSuccessfulSyncAt: string) =>
      account({ readiness: { ...account().readiness!, lastSuccessfulSyncAt } });

    expect(resolveMailHomeHealth([withSyncAt(atBoundary)], NOW).state).toBe('HEALTHY');
    expect(resolveMailHomeHealth([withSyncAt(beyondBoundary)], NOW).state).toBe('STALE');
  });

  it('never reports stale or future readiness receipts as healthy', () => {
    for (const observedAt of [
      '2026-10-28T01:50:00.000Z',
      '2026-10-28T02:00:00.001Z',
      'not-an-instant',
    ]) {
      expect(
        resolveMailHomeHealth(
          [account({ readiness: { ...account().readiness!, observedAt } })],
          NOW
        ).state
      ).toBe('STALE');
    }
  });

  it('uses the oldest account sync so one stale account cannot be hidden by a fresh account', () => {
    const result = resolveMailHomeHealth(
      [
        account(),
        account({
          accountId: 'account-2',
          readiness: {
            ...account().readiness!,
            lastSuccessfulSyncAt: '2026-10-28T00:30:00.000Z',
          },
        }),
      ],
      NOW
    );

    expect(result.state).toBe('STALE');
    expect(result.affectedAccountCount).toBe(1);
    expect(result.oldestSuccessfulSyncAt).toBe('2026-10-28T00:30:00.000Z');
  });

  it.each(['NO_ACCOUNT', 'BLOCKED_EXTERNAL', 'ACTION_REQUIRED', 'PAUSED', 'STALE'] as const)(
    'routes %s recovery actions to account recovery',
    (state) => {
      expect(mailHomeHealthActionPath(state, '/mail/inbox')).toBe('/mail/accounts');
    }
  );

  it('keeps a healthy action on the user work path', () => {
    expect(mailHomeHealthActionPath('HEALTHY', '/mail/inbox?lane=NEEDS_REPLY')).toBe(
      '/mail/inbox?lane=NEEDS_REPLY'
    );
  });
});
