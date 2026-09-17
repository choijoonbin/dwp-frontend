import { describe, expect, it } from 'vitest';

import {
  MAIL_WRITING_ASSET_VARIABLES,
  mailRecipientIdentityChanged,
  mailWritingAssetVariableToken,
  mailTemplateRequiresRecipientReview,
  mailWritingAssetBody,
  materializeMailTemplate,
  resolveMailNewSignature,
} from './mail-writing-asset-content';

import type { MailSignature, MailTemplate } from '@dwp-frontend/shared-utils';

function template(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    templateId: 'template-1',
    name: 'Template',
    subject: 'Hello {{recipientName}}',
    body: '<p>Welcome {{recipientName}}</p>',
    bodyFormat: 'HTML',
    scope: 'ORGANIZATION',
    accountId: null,
    mandatoryContent: '<p>Required {{department}}</p>',
    version: 1,
    ...overrides,
  };
}

function signature(overrides: Partial<MailSignature>): MailSignature {
  return {
    signatureId: 'signature-1',
    name: 'Signature',
    body: 'Regards',
    bodyFormat: 'TEXT',
    scope: 'PERSONAL',
    accountId: null,
    defaultForNew: true,
    defaultForReply: false,
    version: 1,
    ...overrides,
  };
}

describe('mail writing asset materialization', () => {
  it('offers only supported variables and creates their exact insertion tokens', () => {
    expect(MAIL_WRITING_ASSET_VARIABLES).toEqual(['displayName', 'department', 'recipientName']);
    expect(MAIL_WRITING_ASSET_VARIABLES.map(mailWritingAssetVariableToken)).toEqual([
      '{{displayName}}',
      '{{department}}',
      '{{recipientName}}',
    ]);
  });

  it('resolves approved variables and keeps required organization content in the inserted body', () => {
    const resolved = materializeMailTemplate(template(), {
      recipientName: 'Dana',
      department: 'Finance',
    });

    expect(resolved.subject).toBe('Hello Dana');
    expect(mailWritingAssetBody(resolved)).toBe(
      '<p>Welcome Dana</p><br><br><p>Required Finance</p>'
    );
    expect(mailTemplateRequiresRecipientReview(template())).toBe(true);
  });

  it('uses the server priority for an implicit new-message signature', () => {
    const personal = signature({ signatureId: 'personal', scope: 'PERSONAL' });
    const organization = signature({ signatureId: 'organization', scope: 'ORGANIZATION' });
    const account = signature({
      signatureId: 'account',
      scope: 'ACCOUNT',
      accountId: 'account-1',
    });

    expect(
      resolveMailNewSignature([personal, organization, account], 'account-1', null)?.signatureId
    ).toBe('account');
    expect(
      resolveMailNewSignature([personal, organization, account], 'account-2', null)?.signatureId
    ).toBe('organization');
    expect(
      resolveMailNewSignature([personal, organization, account], 'account-1', 'personal')
        ?.signatureId
    ).toBe('personal');
  });

  it('requires personalization review when a recipient name or address changes', () => {
    expect(
      mailRecipientIdentityChanged(
        { name: 'Dana', email: 'dana@example.com' },
        { name: 'Dani', email: 'dana@example.com' }
      )
    ).toBe(true);
    expect(
      mailRecipientIdentityChanged(
        { name: 'Dana', email: 'dana@example.com' },
        { name: 'Dana', email: 'dana@example.com' }
      )
    ).toBe(false);
  });
});
