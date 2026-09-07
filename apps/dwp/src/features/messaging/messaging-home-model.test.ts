import { describe, expect, it } from 'vitest';

import {
  buildMessagingHomeView,
  compareMessagingAttention,
  filterMessagingHomeConversations,
  messagingAttentionState,
  messagingFocusReason,
  messagingHomeFilter,
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

  it('accepts only known persisted focus values', () => {
    expect(messagingHomeFilter('MENTIONS')).toBe('MENTIONS');
    expect(messagingHomeFilter('SPACE')).toBe('SPACE');
    expect(messagingHomeFilter('DIRECT')).toBe('DIRECT');
    expect(messagingHomeFilter('admin')).toBe('ALL');
    expect(messagingHomeFilter(null)).toBe('ALL');
  });

  it('uses the server mention scope rather than guessing from preview text', () => {
    const ordinary = conversation('ordinary', { unreadCount: 3 });
    const mention = conversation('mention', { unreadCount: 1 });
    const readMention = conversation('read-mention');
    expect(
      filterMessagingHomeConversations([ordinary], 'MENTIONS', [mention, readMention])
    ).toEqual([mention]);
    expect(filterMessagingHomeConversations([ordinary], 'MENTIONS')).toEqual([]);
  });

  it('filters the complete source before limiting rows and excludes duplicate or archived work', () => {
    const direct = conversation('direct', { unreadCount: 1, conversationType: 'DIRECT' });
    const space = conversation('space', { unreadCount: 2, visibility: 'SPACE' });
    const archived = conversation('archived', { unreadCount: 10, lifecycleState: 'ARCHIVED' });
    const source = [direct, space, archived, direct];
    expect(filterMessagingHomeConversations(source, 'ALL')).toEqual([direct, space]);
    expect(filterMessagingHomeConversations(source, 'SPACE')).toEqual([space]);
    expect(filterMessagingHomeConversations(source, 'DIRECT')).toEqual([direct]);
  });

  it('includes read direct conversations in the connection rail but not the attention queue', () => {
    const direct = conversation('read-direct', { conversationType: 'DIRECT' });
    const archived = conversation('closed-direct', {
      conversationType: 'DIRECT',
      lifecycleState: 'ARCHIVED',
    });
    const view = buildMessagingHomeView(home(), [direct, archived]);
    expect(view.directConversations).toEqual([direct]);
    expect(view.focusConversations).toEqual([]);
  });
});
