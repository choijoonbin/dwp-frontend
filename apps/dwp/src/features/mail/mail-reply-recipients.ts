import { mailMessageRecipients } from './mail-message-presentation';

import type { MailMessage } from '@dwp-frontend/shared-utils';
import type { MailMessageRecipient } from './mail-message-presentation';

function normalizedEmail(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

export function mailReplyAllRecipients(
  messages: readonly MailMessage[],
  ownEmailAddresses: readonly (string | null | undefined)[]
): MailMessageRecipient[] {
  const source = [...messages].reverse().find((message) => message.direction === 'INBOUND');
  if (!source) return [];
  const own = new Set(
    ownEmailAddresses
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalizedEmail)
  );
  const candidates: MailMessageRecipient[] = [
    { type: 'TO', name: source.senderName || null, email: source.senderEmail },
    ...mailMessageRecipients(source).filter((recipient) => recipient.type !== 'BCC'),
  ];
  const seen = new Set<string>();
  return candidates.filter((recipient) => {
    const email = normalizedEmail(recipient.email);
    if (!email || own.has(email) || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}
