import { describe, expect, it } from 'vitest';

import {
  buildMessagingHomeView,
  compareMessagingAttention,
  messagingAttentionState,
  messagingFocusReason,
} from './messaging-home-model';

import type { MessagingConversation, MessagingHome } from '@dwp-frontend/shared-utils';

function conversation(
  conversationId: string,
  overrides: Partial<MessagingConversation> = {}
): MessagingConversation {
  return {
    conversationId,
    conversationKey: conversationId,
    conversationType: 'CHANNEL',
    name: conversationId,
    topic: null,
    visibility: 'PRIVATE',
    dataClassification: 'INTERNAL',
    linkedSpaceKey: null,
    linkedSpaceName: null,
    lifecycleState: 'ACTIVE',
    memberCount: 3,
    unreadCount: 0,
    favorite: false,
    pinned: false,
    lastMessage: null,
    lastMessageAt: null,
    version: 1,
    ...overrides,
  };
}

function home(overrides: Partial<MessagingHome> = {}): MessagingHome {
  return {
    generatedAt: '2026-08-27T00:30:00Z',
    metrics: {
      unreadConversations: 0,
      mentions: 0,
      spaceChannels: 0,
      directMessages: 0,
      savedItems: 0,
    },
    priority: [],
    spaces: [],
    people: [],
    ...overrides,
  };
}

describe('messaging home model', () => {
  it('selects the strongest truthful attention signal without double-counting it', () => {
    expect(
      messagingAttentionState(
        home({
          metrics: {
            unreadConversations: 7,
            mentions: 2,
            spaceChannels: 4,
            directMessages: 3,
            savedItems: 5,
          },
        })
      )
    ).toBe('MENTIONS');
    expect(
      messagingAttentionState(
        home({
          metrics: {
            unreadConversations: 0,
            mentions: 0,
            spaceChannels: 4,
            directMessages: 3,
            savedItems: 2,
          },
        })
      )
    ).toBe('SAVED');
  });

  it('prioritizes unread direct work before Space and other conversations', () => {
    const items = [
      conversation('channel', { unreadCount: 5, lastMessageAt: '2026-08-27T00:29:00Z' }),
      conversation('space', { visibility: 'SPACE', unreadCount: 3 }),
      conversation('direct', { conversationType: 'DIRECT', unreadCount: 1 }),
    ];

    expect(items.sort(compareMessagingAttention).map((item) => item.conversationId)).toEqual([
      'direct',
      'space',
      'channel',
    ]);
    expect(messagingFocusReason(items[0]!)).toBe('UNREAD');
  });

  it('excludes read-only pinned noise and bounds every home section', () => {
    const result = buildMessagingHomeView(
      home({
        priority: Array.from({ length: 8 }, (_, index) =>
          conversation(`conversation-${index}`, { unreadCount: index === 0 ? 0 : index })
        ),
        spaces: Array.from({ length: 6 }, (_, index) => conversation(`space-${index}`)),
      })
    );

    expect(result.focusConversations).toHaveLength(6);
    expect(result.spaceConversations).toHaveLength(4);
    expect(result.focusConversations).not.toContainEqual(
      expect.objectContaining({ conversationId: 'conversation-0' })
    );
  });
});
