import type { MailAccount, MailComposeCapabilities } from '@dwp-frontend/shared-utils';

export type MailAccountCapabilityPresentation = Readonly<{
  key: 'send' | 'bcc' | 'html' | 'attachments' | 'scheduling' | 'sharedIdentity';
  ready: boolean;
}>;

export function mailAccountCapabilityPresentation(
  account: Pick<MailAccount, 'accountKind'>,
  capabilities: MailComposeCapabilities | undefined
): MailAccountCapabilityPresentation[] {
  const values: MailAccountCapabilityPresentation[] = [
    { key: 'send', ready: capabilities?.multipleRecipients === true },
    { key: 'bcc', ready: capabilities?.bcc === true },
    { key: 'html', ready: capabilities?.html === true },
    { key: 'attachments', ready: capabilities?.attachments === true },
    { key: 'scheduling', ready: capabilities?.scheduling === true },
  ];
  if (account.accountKind === 'SHARED') {
    values.push({ key: 'sharedIdentity', ready: capabilities?.multipleRecipients === true });
  }
  return values;
}
