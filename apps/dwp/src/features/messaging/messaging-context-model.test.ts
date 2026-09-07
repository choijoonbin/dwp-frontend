import { describe, expect, it } from 'vitest';
import { buildMessagingContext } from './messaging-context-model';
import type { MessagingMember, MessagingMessage } from '@dwp-frontend/shared-utils';

function message(id: string, sequence: number, overrides: Partial<MessagingMessage> = {}) {
  return {
    messageId: id,
    sequence,
    createdAt: '2026-09-04T00:00:00Z',
    replyCount: 0,
    ...overrides,
  } as MessagingMessage;
}

describe('conversation context', () => {
  it('summarizes only undeleted root messages in sequence order without mutating the stream', () => {
    const messages = [
      message('third', 3, { replyCount: 2 }),
      message('first', 1, { replyCount: 4 }),
      message('deleted', 4, { deletedAt: '2026-09-04T01:00:00Z' }),
      message('reply', 5, { replyToMessageId: 'first' }),
      message('second', 2),
    ];
    const result = buildMessagingContext(messages, []);
    expect(result.recentMessages.map((item) => item.messageId)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(result.activeThreads.map((item) => item.messageId)).toEqual(['third', 'first']);
    expect(result.replyTotal).toBe(6);
    expect(messages[0].messageId).toBe('third');
  });
  it('does not count missing, offline or away presence as active and ranks active members first', () => {
    const members = [undefined, 'OFFLINE', 'AWAY', 'AVAILABLE', 'FOCUS', 'BUSY'].map(
      (presenceState, userId) => ({ userId, presenceState }) as MessagingMember
    );
    const result = buildMessagingContext([], members);
    expect(result.activeCount).toBe(3);
    expect(result.members.map((member) => member.userId)).toEqual([3, 4, 5, 0, 1, 2]);
    expect(result.recentMessages).toEqual([]);
  });
});
