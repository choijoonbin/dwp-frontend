import { describe, expect, it } from 'vitest';

import {
  mailComposeCapabilitiesForAccount,
  mailComposeHasExternalRecipients,
  mailComposeOptionsCanSend,
} from './mail-compose-options';

import type { MailComposeOptions } from '@dwp-frontend/shared-utils';

const options: MailComposeOptions = {
  accountId: 'account-1',
  recipients: [
    { type: 'TO', name: 'Recipient', email: 'recipient@example.com' },
    { type: 'BCC', name: null, email: 'audit@example.com' },
  ],
  bodyFormat: 'TEXT',
  attachmentIds: [],
  scheduledAt: null,
  timeZone: null,
  templateId: null,
  signatureId: null,
};

describe('mail compose capability gates', () => {
  it('requires a valid To recipient even when Cc or Bcc exists', () => {
    expect(mailComposeOptionsCanSend(options)).toBe(true);
    expect(
      mailComposeOptionsCanSend({
        ...options,
        recipients: [{ type: 'BCC', name: null, email: 'hidden@example.com' }],
      })
    ).toBe(false);
  });

  it('blocks past schedules and attachments that have not passed scanning', () => {
    expect(mailComposeOptionsCanSend({ ...options, scheduledAt: '2000-01-01T00:00:00Z' })).toBe(
      false
    );
    expect(
      mailComposeOptionsCanSend(options, [
        {
          attachmentId: 'attachment-1',
          fileName: 'review.pdf',
          contentType: 'application/pdf',
          sizeBytes: 100,
          scanState: 'SCANNING',
        },
      ])
    ).toBe(false);
  });

  it('switches capability gates with the displayed From account', () => {
    const accountCapabilities = {
      'account-1': { attachments: false },
      'account-2': { attachments: true },
    };
    expect(mailComposeCapabilitiesForAccount(accountCapabilities, 'account-1')).toEqual({
      attachments: false,
    });
    expect(mailComposeCapabilitiesForAccount(accountCapabilities, 'account-2')).toEqual({
      attachments: true,
    });
    expect(mailComposeCapabilitiesForAccount(accountCapabilities, 'missing')).toBeUndefined();
  });

  it('requires review when any recipient is outside the selected sender domain', () => {
    expect(mailComposeHasExternalRecipients(options.recipients, 'sender@example.com')).toBe(false);
    expect(
      mailComposeHasExternalRecipients(
        [...options.recipients, { type: 'CC', name: null, email: 'partner@outside.test' }],
        'sender@example.com'
      )
    ).toBe(true);
  });
});
