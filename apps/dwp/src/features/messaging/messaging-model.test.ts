import { describe, expect, it } from 'vitest';

import {
  mergeMessagingMessages,
  messagingReplyCounts,
  messagingRootMessages,
  messagingThread,
  shouldSendMessagingMessage,
  upsertMessagingMessage,
} from './messaging-model';

import type { MessagingMessage } from '@dwp-frontend/shared-utils';

function message(messageId: string, replyToMessageId: string | null = null): MessagingMessage {
  return {
    messageId,
    conversationId: 'conversation-1',
    senderUserId: 1,
    senderName: 'Test User',
    body: messageId,
    contentType: 'TEXT',
    messageKind: 'USER',
    replyToMessageId,
    createdAt: '2026-08-19T00:00:00Z',
    version: 1,
    reactions: [],
  };
}

function sequencedMessage(messageId: string, sequence: number, body = messageId) {
  return { ...message(messageId), sequence, body };
}

describe('messaging interaction model', () => {
  it('sends with Enter while preserving Shift+Enter and IME composition', () => {
    expect(shouldSendMessagingMessage({ key: 'Enter', shiftKey: false, isComposing: false })).toBe(
      true
    );
    expect(shouldSendMessagingMessage({ key: 'Enter', shiftKey: true, isComposing: false })).toBe(
      false
    );
    expect(shouldSendMessagingMessage({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(
      false
    );
  });

  it('keeps replies out of the main timeline and groups them under their root', () => {
    const messages = [message('root-1'), message('reply-1', 'root-1'), message('root-2')];

    expect(messagingRootMessages(messages).map((item) => item.messageId)).toEqual([
      'root-1',
      'root-2',
    ]);
    expect(messagingThread(messages, 'root-1')?.replies.map((item) => item.messageId)).toEqual([
      'reply-1',
    ]);
    expect(messagingThread(messages, 'reply-1')?.root.messageId).toBe('root-1');
    expect(messagingReplyCounts(messages).get('root-1')).toBe(1);
  });

  it('inserts delta messages by their durable conversation sequence', () => {
    const next = upsertMessagingMessage(
      [sequencedMessage('first', 1), sequencedMessage('third', 3)],
      sequencedMessage('second', 2)
    );

    expect(next.map((item) => item.messageId)).toEqual(['first', 'second', 'third']);
  });

  it('replaces an edited delta without duplicating the message', () => {
    const original = sequencedMessage('same', 1, 'before');
    const edited = { ...original, body: 'after', version: 2 };

    expect(upsertMessagingMessage([original], edited)).toEqual([edited]);
  });

  it('merges paged history with live deltas without duplicates', () => {
    const merged = mergeMessagingMessages(
      [sequencedMessage('older', 1), sequencedMessage('same', 2, 'stale')],
      [sequencedMessage('same', 2, 'current'), sequencedMessage('latest', 3)]
    );

    expect(merged.map((item) => item.messageId)).toEqual(['older', 'same', 'latest']);
    expect(merged[1]?.body).toBe('current');
  });
});
