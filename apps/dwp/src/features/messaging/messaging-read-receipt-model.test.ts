import { describe, expect, it } from 'vitest';

import { messagingReceiptMessageIds, messagingReceiptState } from './messaging-read-receipt-model';
import type { MessagingMessage, MessagingReadReceipt } from '@dwp-frontend/shared-utils';

const receipt = {
  messageId: 'message',
  recipients: [],
  readCount: 0,
  unreadCount: 0,
  unavailableCount: 0,
} satisfies MessagingReadReceipt;
describe('privacy-aware read status', () => {
  it('does not turn missing or failed read data into unread', () => {
    expect(messagingReceiptState()).toBe('UNKNOWN');
    expect(messagingReceiptState(receipt)).toBe('SENT');
  });
  it('keeps private participants distinct from unconfirmed participants', () => {
    expect(messagingReceiptState({ ...receipt, unreadCount: 1 })).toBe('UNREAD');
    expect(messagingReceiptState({ ...receipt, unreadCount: 1, unavailableCount: 2 })).toBe(
      'UNAVAILABLE'
    );
    expect(messagingReceiptState({ ...receipt, readCount: 1, unavailableCount: 2 })).toBe('READ');
  });
  it('batches only authored nondeleted user messages, with a stable bounded key', () => {
    const messages = Array.from(
      { length: 70 },
      (_, id) =>
        ({ messageId: `id-${id}`, senderUserId: 42, messageKind: 'USER' }) as MessagingMessage
    );
    messages.push({ ...messages[69]!, messageId: 'other', senderUserId: 43 });
    messages.push({ ...messages[69]!, messageId: 'deleted', deletedAt: '2026-09-04' });
    messages.push({ ...messages[69]!, messageId: 'system', messageKind: 'SYSTEM' });
    const ids = messagingReceiptMessageIds(messages, 42);
    expect(ids).toHaveLength(50);
    expect(ids).not.toContain('other');
    expect(ids).not.toContain('deleted');
    expect(ids).not.toContain('system');
    expect(messagingReceiptMessageIds(messages)).toEqual([]);
  });
});
