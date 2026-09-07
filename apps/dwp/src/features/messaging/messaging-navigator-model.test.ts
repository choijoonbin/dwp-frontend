import { describe, expect, it } from 'vitest';

import {
  buildMessagingNavigatorSections,
  filterMessagingNavigator,
} from './messaging-navigator-model';

import type { MessagingConversation } from '@dwp-frontend/shared-utils';

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

describe('messaging navigator model', () => {
  it('keeps personal favorites distinct from administrator pins and filters unread work', () => {
    const items = [
      conversation('pin', { pinned: true }),
      conversation('favorite', { favorite: true }),
      conversation('unread', { unreadCount: 2 }),
    ];
    expect(filterMessagingNavigator(items, 'ALL')).toHaveLength(3);
    expect(filterMessagingNavigator(items, 'FAVORITES').map((item) => item.conversationId)).toEqual(
      ['favorite']
    );
    expect(filterMessagingNavigator(items, 'UNREAD').map((item) => item.conversationId)).toEqual([
      'unread',
    ]);
    expect(items).toHaveLength(3);
  });
  it('groups favorites once and keeps channels separate from direct messages', () => {
    const sections = buildMessagingNavigatorSections([
      conversation('favorite', { favorite: true, conversationType: 'DIRECT' }),
      conversation('channel', { unreadCount: 2 }),
      conversation('direct', { conversationType: 'DIRECT', unreadCount: 1 }),
    ]);

    expect(sections.map((section) => section.key)).toEqual(['PINNED', 'CHANNELS', 'DIRECT']);
    expect(sections.flatMap((section) => section.conversations)).toHaveLength(3);
    expect(sections[0]?.conversations[0]?.conversationId).toBe('favorite');
  });

  it('orders unread work before recent read work inside each section', () => {
    const sections = buildMessagingNavigatorSections([
      conversation('read', { lastMessageAt: '2026-09-03T08:30:00Z' }),
      conversation('unread', { unreadCount: 1, lastMessageAt: '2026-09-02T08:30:00Z' }),
    ]);

    expect(sections[0]?.conversations.map((item) => item.conversationId)).toEqual([
      'unread',
      'read',
    ]);
  });
});
