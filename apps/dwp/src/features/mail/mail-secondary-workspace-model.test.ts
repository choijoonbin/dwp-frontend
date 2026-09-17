import { describe, expect, it } from 'vitest';

import {
  getMailSecondaryView,
  mailAccountReadiness,
  mailDeliveryPresentation,
  mailThreadAccessibleName,
  MAIL_SECONDARY_VIEWS,
  resolveMailSecondaryView,
} from './mail-secondary-workspace-model';

import type { MailAccount, MailThread } from '@dwp-frontend/shared-utils';

describe('mail secondary workspace model', () => {
  it('gives every user workflow a stable and unique route', () => {
    expect(MAIL_SECONDARY_VIEWS).toHaveLength(11);
    const routes = MAIL_SECONDARY_VIEWS.map((item) => item.path);
    expect(new Set(routes).size).toBe(routes.length);
    expect(resolveMailSecondaryView('/mail/follow-up/')).toBe('follow-up');
    expect(getMailSecondaryView('templates').capability).toBe('AVAILABLE');
    expect(getMailSecondaryView('accounts').capability).toBe('AVAILABLE');
  });

  it('never presents the current SENT state as confirmed recipient delivery', () => {
    expect(mailDeliveryPresentation('SENT')).toMatchObject({
      confirmedDelivered: false,
      retryAllowed: false,
      severity: 'info',
      labelFallback: 'Accepted by provider',
    });
    expect(mailDeliveryPresentation('FAILED').retryAllowed).toBe(false);
  });

  it('keeps accounts read-only until both connection and synchronization are ready', () => {
    const account: MailAccount = {
      accountId: 'account-1',
      emailAddress: 'member@example.com',
      displayName: 'Member',
      accountKind: 'PERSONAL',
      providerType: 'DWP_SANDBOX',
      connectionState: 'ACTIVE',
      synchronizationState: 'READY',
      defaultAccount: true,
    };

    expect(mailAccountReadiness(account)).toBe('AVAILABLE');
    expect(mailAccountReadiness({ ...account, synchronizationState: 'DEGRADED' })).toBe(
      'READ_ONLY'
    );
    expect(mailAccountReadiness({ ...account, connectionState: 'DISCONNECTED' })).toBe('READ_ONLY');
  });

  it('builds a useful accessible name from actual thread state', () => {
    const thread = {
      accountName: 'Support',
      participants: [{ name: 'Alex Kim', email: 'alex@example.com' }],
      subject: 'Contract review',
      unread: true,
      attachments: true,
      assignedName: 'Mina Lee',
    } as MailThread;

    expect(mailThreadAccessibleName(thread)).toBe(
      'Alex Kim, Contract review, unread, has attachment, assigned to Mina Lee'
    );
  });
});
