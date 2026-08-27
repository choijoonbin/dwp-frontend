import { describe, expect, it } from 'vitest';

import { buildMessagingTimelineItems } from './messaging-timeline-model';

import type { MessagingMessage } from '@dwp-frontend/shared-utils';

function message(
  id: string,
  senderUserId: number,
  sequence: number,
  createdAt: string
): MessagingMessage {
  return {
    messageId: id,
    conversationId: 'conversation-1',
    senderUserId,
    senderName: `Person ${senderUserId}`,
    body: id,
    contentType: 'TEXT',
    messageKind: 'USER',
    createdAt,
    sequence,
    version: 0,
    reactions: [],
    attachments: [],
  };
}

describe('buildMessagingTimelineItems', () => {
  it('adds date and unread boundaries while grouping consecutive messages', () => {
    const items = buildMessagingTimelineItems(
      [
        message('one', 2, 10, '2026-08-27T01:00:00Z'),
        message('two', 2, 11, '2026-08-27T01:03:00Z'),
        message('three', 3, 12, '2026-08-27T01:04:00Z'),
      ],
      1,
      10
    );

    expect(items.map((item) => item.kind)).toEqual([
      'date',
      'message',
      'unread',
      'message',
      'message',
    ]);
    const firstMessage = items[1];
    const secondMessage = items[3];
    expect(firstMessage.kind === 'message' && firstMessage.groupedWithNext).toBe(false);
    expect(secondMessage.kind === 'message' && secondMessage.groupedWithPrevious).toBe(false);
  });

  it('does not insert an unread boundary for messages sent by the current user', () => {
    const items = buildMessagingTimelineItems(
      [message('mine', 1, 20, '2026-08-27T02:00:00Z')],
      1,
      10
    );
    expect(items.some((item) => item.kind === 'unread')).toBe(false);
  });
});
