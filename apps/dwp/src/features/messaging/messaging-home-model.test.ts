import { describe, expect, it } from 'vitest';

import {
  buildMessagingHomeView,
  compareMessagingAttention,
  filterMessagingHomeConversations,
  messagingAttentionState,
  messagingFocusReason,
  messagingHomePresenceLeaseExpiresAt,
  messagingHomeFilter,
  messagingPresenceRefreshIntervalMs,
  resolveMessagingHomePresence,
  selectAvailableMessagingPeople,
} from './messaging-home-model';

import type {
  MessagingConversation,
  MessagingHome,
  MessagingPerson,
} from '@dwp-frontend/shared-utils';

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
    presence: {
      authority: 'LIVE',
      evaluatedAt: '2026-08-27T00:30:00Z',
      leaseTtlSeconds: 75,
      refreshAfterSeconds: 15,
    },
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

function person(userId: number, presenceState: MessagingPerson['presenceState']): MessagingPerson {
  return {
    userId,
    emailAddress: `person-${userId}@example.com`,
    displayName: `Person ${userId}`,
    presenceState,
  };
}

describe('messaging home model', () => {
  it('clamps server-recommended presence refresh intervals to safe UI bounds', () => {
    expect(messagingPresenceRefreshIntervalMs()).toBe(15_000);
    expect(messagingPresenceRefreshIntervalMs(Number.NaN)).toBe(15_000);
    expect(messagingPresenceRefreshIntervalMs(1)).toBe(5_000);
    expect(messagingPresenceRefreshIntervalMs(15)).toBe(15_000);
    expect(messagingPresenceRefreshIntervalMs(90)).toBe(20_000);
  });

  it('fails closed when a rolling-deploy home response has no presence metadata', () => {
    const legacy = home();
    delete legacy.presence;

    expect(resolveMessagingHomePresence(legacy)).toEqual({
      authority: 'UNAVAILABLE',
      evaluatedAt: legacy.generatedAt,
      leaseTtlSeconds: 75,
      refreshAfterSeconds: 15,
    });
  });

  it('fails closed when a background refresh fails with cached live presence', () => {
    const cached = home({ people: [person(200, 'AVAILABLE')] });
    const dataUpdatedAt = 1_000_000;
    const observedAt = dataUpdatedAt + 1_000;

    expect(resolveMessagingHomePresence(cached, { dataUpdatedAt, observedAt }).authority).toBe(
      'LIVE'
    );
    expect(
      resolveMessagingHomePresence(cached, { queryFailed: true, dataUpdatedAt, observedAt })
    ).toEqual({
      authority: 'UNAVAILABLE',
      evaluatedAt: cached.presence?.evaluatedAt,
      leaseTtlSeconds: 75,
      refreshAfterSeconds: 15,
    });
  });

  it('anchors the remaining server-relative lease to the local query update time', () => {
    const evaluatedAt = Date.parse(home().presence!.evaluatedAt);
    const snapshot = home({ generatedAt: new Date(evaluatedAt + 10_000).toISOString() });
    const dataUpdatedAt = 1_000_000;

    expect(messagingHomePresenceLeaseExpiresAt(snapshot, dataUpdatedAt)).toBe(
      dataUpdatedAt + 65_000
    );
    expect(
      resolveMessagingHomePresence(snapshot, { observedAt: dataUpdatedAt + 1_000 }).authority
    ).toBe('UNAVAILABLE');
    expect(
      resolveMessagingHomePresence(snapshot, {
        online: false,
        dataUpdatedAt,
        observedAt: dataUpdatedAt + 1_000,
      }).authority
    ).toBe('UNAVAILABLE');
    expect(
      resolveMessagingHomePresence(snapshot, {
        online: true,
        dataUpdatedAt,
        observedAt: dataUpdatedAt + 64_999,
      }).authority
    ).toBe('LIVE');
    expect(
      resolveMessagingHomePresence(snapshot, {
        online: true,
        dataUpdatedAt,
        observedAt: dataUpdatedAt + 65_000,
      }).authority
    ).toBe('UNAVAILABLE');
  });

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

  it('shows only the first five people who are actually available', () => {
    const people = [
      person(1, 'BUSY'),
      person(2, 'AVAILABLE'),
      person(3, 'OFFLINE'),
      person(4, 'AVAILABLE'),
      person(5, 'AVAILABLE'),
      person(6, 'AWAY'),
      person(7, 'AVAILABLE'),
      person(8, 'AVAILABLE'),
      person(9, 'AVAILABLE'),
    ];

    expect(selectAvailableMessagingPeople(people).map(({ userId }) => userId)).toEqual([
      2, 4, 5, 7, 8,
    ]);
    expect(selectAvailableMessagingPeople([person(10, 'BUSY'), person(11, 'OFFLINE')])).toEqual([]);
  });
});
