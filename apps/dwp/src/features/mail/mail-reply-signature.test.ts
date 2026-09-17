/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';

import { mailReplySignatureText, resolveMailReplySignature } from './mail-reply-signature';

import type { MailSignature } from '@dwp-frontend/shared-utils';

function signature(overrides: Partial<MailSignature>): MailSignature {
  return {
    signatureId: 'signature-1',
    name: 'Signature',
    body: 'Regards',
    bodyFormat: 'TEXT',
    scope: 'PERSONAL',
    accountId: null,
    defaultForNew: false,
    defaultForReply: true,
    version: 1,
    ...overrides,
  };
}

describe('mail reply signature', () => {
  it('prefers the matching account reply signature over a general reply signature', () => {
    const general = signature({ signatureId: 'general' });
    const account = signature({ signatureId: 'account', accountId: 'account-1' });
    const unrelated = signature({ signatureId: 'other', accountId: 'account-2' });
    expect(resolveMailReplySignature([general, account, unrelated], 'account-1')?.signatureId).toBe(
      'account'
    );
  });

  it('excludes account defaults from another account and ignores new-message-only signatures', () => {
    expect(
      resolveMailReplySignature(
        [
          signature({ signatureId: 'other', accountId: 'account-2' }),
          signature({ signatureId: 'new-only', defaultForReply: false, defaultForNew: true }),
        ],
        'account-1'
      )
    ).toBeNull();
  });

  it('converts HTML and mandatory content into safe plain reply text', () => {
    expect(
      mailReplySignatureText(
        signature({
          bodyFormat: 'HTML',
          body: '<p>Regards,<br>Alex</p>',
          mandatoryContent: '<p>Company notice</p>',
        })
      )
    ).toBe('Regards,\nAlex\n\nCompany notice');
  });
});
