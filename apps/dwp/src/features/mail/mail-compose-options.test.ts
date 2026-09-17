import { describe, expect, it } from 'vitest';

import { mailComposeOptionsCanSend } from './mail-compose-options';

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
});
