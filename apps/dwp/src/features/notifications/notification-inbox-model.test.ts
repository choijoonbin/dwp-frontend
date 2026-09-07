import { describe, expect, it } from 'vitest';

import {
  groupNotificationStream,
  isNotificationShortcutTarget,
  kpiView,
  mergeNotificationInboxPages,
  notificationKpiCount,
  notificationMatchesInboxScope,
  optimisticNotificationSummary,
  resolveMessagingReplyTarget,
} from './notification-inbox-model';
import { optimisticTriageItem } from './notification-model';

import type {
  NotificationItem,
  NotificationSummary,
} from '@dwp-frontend/shared-utils/api/notification-api';

const item = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  notificationId: '20000000-0000-0000-0000-000000000001',
  threadCount: 1,
  source: { appKey: 'approvals', appName: '전자결재' },
  typeKey: 'APPROVAL.ACTION_REQUIRED',
  title: '검토가 필요합니다',
  preview: '오늘 안으로 확인해 주세요.',
  priority: 'HIGH',
  reason: { kind: 'DIRECT', label: '직접 지정' },
  receivedAt: '2026-09-03T01:00:00Z',
  lastActivityAt: '2026-09-03T01:00:00Z',
  actionable: true,
  sensitive: false,
  actions: [],
  version: '1',
  ...overrides,
});

const summary: NotificationSummary = {
  partial: false,
  unavailableSources: [],
  actionableUnread: 1,
  totalUnread: 3,
  viewCounts: { PRIORITY: 1, ALL: 3, MENTIONS: 1, SAVED: 0, SNOOZED: 0, DONE: 0 },
  changeVersion: '1',
  counterVersion: '1',
  generatedAt: '2026-09-03T01:00:00Z',
};

describe('notification inbox model', () => {
  it('groups actionable work before conversations and passive updates', () => {
    const groups = groupNotificationStream([
      item(),
      item({
        notificationId: '2',
        actionable: false,
        source: { appKey: 'messaging', appName: '메신저' },
        typeKey: 'MESSAGING.MENTION',
        reason: { kind: 'MENTION', label: '멘션' },
      }),
      item({ notificationId: '3', actionable: false, typeKey: 'HCM.LEAVE_APPROVED' }),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      'ACTION_REQUIRED',
      'CONVERSATIONS',
      'UPDATES',
    ]);
  });

  it('maps KPI selections to server-backed views', () => {
    expect(kpiView('ACTIONABLE')).toEqual({ view: 'PRIORITY', readState: 'ALL' });
    expect(kpiView('UNREAD')).toEqual({ view: 'ALL', readState: 'UNREAD' });
    expect(kpiView('MENTIONS')).toEqual({ view: 'MENTIONS', readState: 'ALL' });
    expect(kpiView('SNOOZED')).toEqual({ view: 'SNOOZED', readState: 'ALL' });
  });

  it('merges focused inbox pages in caller priority order without duplicates', () => {
    const actionable = item({ notificationId: 'actionable' });
    const mention = item({ notificationId: 'mention', actionable: false });
    const update = item({ notificationId: 'update', actionable: false });
    const page = (items: NotificationItem[], unavailableSources: string[] = []) => ({
      items,
      nextCursor: null,
      hasMore: false,
      approximateTotal: items.length,
      partial: unavailableSources.length > 0,
      unavailableSources,
      changeVersion: '1',
    });

    expect(
      mergeNotificationInboxPages(
        [page([actionable]), page([mention, actionable], ['mail']), page([update])],
        3
      )
    ).toMatchObject({
      items: [actionable, mention, update],
      partial: true,
      unavailableSources: ['mail'],
    });
  });

  it('uses the exact count represented by each KPI target', () => {
    const mixedReadStateSummary: NotificationSummary = {
      ...summary,
      actionableUnread: 1,
      totalUnread: 3,
      viewCounts: {
        ...summary.viewCounts,
        PRIORITY: 2,
        MENTIONS: 1,
        SNOOZED: 4,
      },
    };

    expect(notificationKpiCount(mixedReadStateSummary, 'ACTIONABLE')).toBe(2);
    expect(notificationKpiCount(mixedReadStateSummary, 'UNREAD')).toBe(3);
    expect(notificationKpiCount(mixedReadStateSummary, 'MENTIONS')).toBe(1);
    expect(notificationKpiCount(mixedReadStateSummary, 'SNOOZED')).toBe(4);
  });

  it('reconciles optimistic items against the active server filter scope', () => {
    const unread = item({
      source: { appKey: 'messaging', appName: '메신저' },
      priority: 'URGENT',
      readAt: null,
    });
    expect(
      notificationMatchesInboxScope(unread, {
        view: 'ALL',
        readState: 'UNREAD',
        appKey: 'MESSAGING',
        priority: 'URGENT',
        query: '검토',
      })
    ).toBe(true);
    expect(
      notificationMatchesInboxScope(
        { ...unread, readAt: '2026-09-03T01:05:00Z' },
        {
          view: 'ALL',
          readState: 'UNREAD',
        }
      )
    ).toBe(false);
    expect(
      notificationMatchesInboxScope(unread, {
        view: 'ALL',
        appKey: 'approvals',
      })
    ).toBe(false);
  });

  it('accepts only same-origin messaging reply targets', () => {
    const notification = item({
      source: { appKey: 'messaging', appName: '메신저' },
      typeKey: 'MESSAGING.DIRECT_MESSAGE',
      actions: [
        {
          actionKey: 'OPEN',
          label: '대화 열기',
          href: '/messages/direct?conversation=room-42&message=message-7',
          enabled: true,
        },
      ],
    });
    expect(resolveMessagingReplyTarget(notification)).toEqual({
      conversationId: 'room-42',
      replyToMessageId: 'message-7',
    });
    expect(
      resolveMessagingReplyTarget({
        ...notification,
        actions: [{ ...notification.actions[0]!, href: 'https://evil.example/messages/inbox' }],
      })
    ).toBeNull();
  });

  it('updates summary counts immediately when an unread item is completed', () => {
    const before = item();
    const after = optimisticTriageItem(before, 'COMPLETE', '2026-09-03T01:01:00Z');
    expect(optimisticNotificationSummary(summary, before, after)).toMatchObject({
      actionableUnread: 0,
      totalUnread: 2,
      viewCounts: { PRIORITY: 0, ALL: 2, DONE: 1 },
    });
  });

  it('does not trigger triage shortcuts while a user operates another control', () => {
    const button = Object.assign(new EventTarget(), {
      closest: (selector: string) => (selector === 'button, a[href]' ? {} : null),
    });
    const notificationTitle = Object.assign(new EventTarget(), {
      closest: (selector: string) =>
        selector === 'button, a[href]' || selector === '[data-notification-focus-id]' ? {} : null,
    });

    expect(isNotificationShortcutTarget(button)).toBe(true);
    expect(isNotificationShortcutTarget(notificationTitle)).toBe(false);
  });
});
