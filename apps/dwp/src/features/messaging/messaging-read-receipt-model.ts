import type { MessagingMessage, MessagingReadReceipt } from '@dwp-frontend/shared-utils';

export function messagingReceiptMessageIds(messages: MessagingMessage[], currentUserId?: number) {
  return [
    ...new Set(
      messages
        .filter(
          (message) =>
            message.senderUserId === currentUserId &&
            message.messageKind === 'USER' &&
            !message.deletedAt
        )
        .map((message) => message.messageId)
    ),
  ]
    .slice(-50)
    .sort();
}

export function messagingReceiptState(receipt?: MessagingReadReceipt) {
  if (!receipt) return 'UNKNOWN';
  if (receipt.readCount > 0) return 'READ';
  // Non-disclosure must never be presented as proof that a person has not read a message.
  if (receipt.unavailableCount > 0) return 'UNAVAILABLE';
  if (receipt.unreadCount > 0) return 'UNREAD';
  return 'SENT';
}
