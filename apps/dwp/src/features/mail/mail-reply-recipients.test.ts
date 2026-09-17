import { describe, expect, it } from 'vitest';

import { mailReplyAllRecipients } from './mail-reply-recipients';

import type { MailMessage } from '@dwp-frontend/shared-utils';

function message(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    messageId: 'message-1',
    senderEmail: 'sender@example.com',
    senderName: 'Sender',
    recipients: [
      { type: 'TO', name: 'Me', email: 'me@example.com' },
      { type: 'TO', name: 'Team', email: 'team@example.com' },
      { type: 'CC', name: 'Partner', email: 'partner@example.com' },
      { type: 'BCC', name: 'Hidden', email: 'hidden@example.com' },
    ],
    direction: 'INBOUND',
    bodyFormat: 'TEXT',
    body: 'Hello',
    attachments: [],
    sentAt: '2026-09-17T00:00:00Z',
    deliveryState: 'RECEIVED',
    ...overrides,
  };
}

describe('mailReplyAllRecipients', () => {
  it('addresses the latest inbound sender and visible recipients while excluding own identities', () => {
    expect(mailReplyAllRecipients([message()], ['ME@example.com'])).toEqual([
      { type: 'TO', name: 'Sender', email: 'sender@example.com' },
      { type: 'TO', name: 'Team', email: 'team@example.com' },
      { type: 'CC', name: 'Partner', email: 'partner@example.com' },
    ]);
  });

  it('uses the latest inbound message and deduplicates addresses', () => {
    const latest = message({
      messageId: 'message-3',
      senderEmail: 'latest@example.com',
      recipients: [{ type: 'CC', email: 'LATEST@example.com' }],
    });
    expect(
      mailReplyAllRecipients(
        [
          message({ messageId: 'message-1' }),
          message({ messageId: 'message-2', direction: 'OUTBOUND' }),
          latest,
        ],
        []
      )
    ).toEqual([{ type: 'TO', name: 'Sender', email: 'latest@example.com' }]);
  });
});
