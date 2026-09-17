import { describe, expect, it } from 'vitest';

import { inboxScopeFromQueryKey, updateInboxCache } from './notification-center-cache';

import type {
  NotificationInboxPage,
  NotificationItem,
} from '@dwp-frontend/shared-utils/api/notification-api';

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    notificationId: '20000000-0000-0000-0000-000000000001',
    threadCount: 1,
    source: { appKey: 'messaging', appName: '메신저' },
    typeKey: 'MESSAGING.MENTION',
    title: '새 멘션',
    preview: '확인해 주세요.',
    priority: 'HIGH',
    reason: { kind: 'MENTION', label: '멘션' },
    receivedAt: '2026-09-09T01:00:00Z',
    lastActivityAt: '2026-09-09T01:00:00Z',
    actionable: false,
    sensitive: false,
    actions: [],
    version: '1',
    readAt: null,
    ...overrides,
  };
}

function page(items: NotificationItem[]): NotificationInboxPage {
  return {
    items,
    nextCursor: null,
    hasMore: false,
    approximateTotal: items.length,
    partial: false,
    unavailableSources: [],
    changeVersion: '1',
  };
}

describe('notification center cache', () => {
  it('removes an optimistic read item from every unread infinite-query page', () => {
    const unread = item();
    const result = updateInboxCache(
      { pages: [page([unread])], pageParams: [null] },
      { ...unread, readAt: '2026-09-09T01:01:00Z', version: '2' },
      { view: 'ALL', readState: 'UNREAD' }
    );

    expect(result && 'pages' in result ? result.pages[0].items : null).toEqual([]);
  });

  it('retains and updates an item when the active scope still matches', () => {
    const unread = item();
    const result = updateInboxCache(
      page([unread]),
      { ...unread, readAt: '2026-09-09T01:01:00Z', version: '2' },
      { view: 'ALL', readState: 'ALL' }
    );

    expect(result && !('pages' in result) ? result.items[0].version : null).toBe('2');
  });

  it('keeps only materialized prioritized decisions in an attention-filtered cache', () => {
    const prioritized = item({ attentionEffect: 'PRIORITIZE' });
    const ordinary = item({ notificationId: '20000000-0000-0000-0000-000000000002' });

    const kept = updateInboxCache(page([prioritized]), prioritized, {
      view: 'ALL',
      attentionEffect: 'PRIORITIZE',
    });
    const removed = updateInboxCache(page([ordinary]), ordinary, {
      view: 'ALL',
      attentionEffect: 'PRIORITIZE',
    });

    expect(kept && !('pages' in kept) ? kept.items : []).toHaveLength(1);
    expect(removed && !('pages' in removed) ? removed.items : []).toHaveLength(0);
  });

  it('derives the filter scope from the query key and fails to priority by default', () => {
    expect(inboxScopeFromQueryKey(['notifications', 'inbox', { view: 'MENTIONS' }])).toEqual({
      view: 'MENTIONS',
    });
    expect(inboxScopeFromQueryKey(['notifications', 'inbox'])).toEqual({ view: 'PRIORITY' });
  });
});
