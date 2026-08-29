import { describe, expect, it } from 'vitest';

import { messagingSendAttemptMatches, type MessagingSendAttempt } from './messaging-send-model';

function attempt(conversationId: string, threadRootId: string | null = null): MessagingSendAttempt {
  return {
    conversationId,
    threadRootId,
    payload: {
      body: 'Operational update',
      idempotencyKey: 'idempotency-key',
      attachmentIds: [],
      mentionedUserIds: [],
      ...(threadRootId ? { replyToMessageId: threadRootId } : {}),
    },
  };
}

describe('messaging send attempt model', () => {
  it('keeps a main-message retry bound to its original conversation', () => {
    const current = attempt('conversation-a');

    expect(messagingSendAttemptMatches(current, 'conversation-a', null)).toBe(true);
    expect(messagingSendAttemptMatches(current, 'conversation-b', null)).toBe(false);
  });

  it('keeps a thread retry bound to both its conversation and root message', () => {
    const current = attempt('conversation-a', 'root-a');

    expect(messagingSendAttemptMatches(current, 'conversation-a', 'root-a')).toBe(true);
    expect(messagingSendAttemptMatches(current, 'conversation-a', 'root-b')).toBe(false);
    expect(messagingSendAttemptMatches(current, 'conversation-b', 'root-a')).toBe(false);
  });

  it('fails closed when no active conversation or send attempt exists', () => {
    expect(messagingSendAttemptMatches(null, 'conversation-a', null)).toBe(false);
    expect(messagingSendAttemptMatches(attempt('conversation-a'), null, null)).toBe(false);
  });
});
