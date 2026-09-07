import { notificationMatchesView } from './notification-model';

import type {
  NotificationInboxPage,
  NotificationItem,
  NotificationPriority,
  NotificationReasonKind,
  NotificationSummary,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationStreamGroupKey = 'ACTION_REQUIRED' | 'CONVERSATIONS' | 'UPDATES';

export type NotificationStreamGroup = {
  key: NotificationStreamGroupKey;
  items: NotificationItem[];
};

export type NotificationKpiKey = 'ACTIONABLE' | 'UNREAD' | 'MENTIONS' | 'SNOOZED';

export type NotificationInboxFilterScope = {
  view?: NotificationView;
  query?: string;
  appKey?: string;
  priority?: NotificationPriority | 'ALL';
  readState?: 'ALL' | 'UNREAD' | 'READ';
  reason?: NotificationReasonKind | 'ALL';
};

export type MessagingReplyTarget = {
  conversationId: string;
  replyToMessageId?: string;
};

export function mergeNotificationInboxPages(
  pages: readonly (NotificationInboxPage | undefined)[],
  limit: number
): NotificationInboxPage | undefined {
  const base = pages.find((page): page is NotificationInboxPage => Boolean(page));
  if (!base) return undefined;

  const seen = new Set<string>();
  const items = pages
    .flatMap((page) => page?.items ?? [])
    .filter((item) => {
      if (seen.has(item.notificationId)) return false;
      seen.add(item.notificationId);
      return true;
    })
    .slice(0, Math.max(0, limit));
  const unavailableSources = [...new Set(pages.flatMap((page) => page?.unavailableSources ?? []))];

  return {
    ...base,
    items,
    partial: pages.some((page) => page?.partial),
    unavailableSources,
  };
}

const SAFE_TARGET_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;

export function groupNotificationStream(
  items: readonly NotificationItem[]
): NotificationStreamGroup[] {
  const groups: Record<NotificationStreamGroupKey, NotificationItem[]> = {
    ACTION_REQUIRED: [],
    CONVERSATIONS: [],
    UPDATES: [],
  };

  for (const item of items) {
    if (item.actionable) groups.ACTION_REQUIRED.push(item);
    else if (item.reason.kind === 'MENTION' || isConversationSource(item.source.appKey)) {
      groups.CONVERSATIONS.push(item);
    } else groups.UPDATES.push(item);
  }

  return (Object.entries(groups) as Array<[NotificationStreamGroupKey, NotificationItem[]]>)
    .filter(([, groupItems]) => groupItems.length > 0)
    .map(([key, groupItems]) => ({ key, items: groupItems }));
}

export function kpiView(key: NotificationKpiKey): {
  view: NotificationView;
  readState: 'ALL' | 'UNREAD';
} {
  if (key === 'UNREAD') return { view: 'ALL', readState: 'UNREAD' };
  if (key === 'MENTIONS') return { view: 'MENTIONS', readState: 'ALL' };
  if (key === 'SNOOZED') return { view: 'SNOOZED', readState: 'ALL' };
  return { view: 'PRIORITY', readState: 'ALL' };
}

export function notificationKpiCount(
  summary: NotificationSummary,
  key: NotificationKpiKey
): number {
  if (key === 'ACTIONABLE') return summary.viewCounts.PRIORITY;
  if (key === 'UNREAD') return summary.totalUnread;
  if (key === 'MENTIONS') return summary.viewCounts.MENTIONS;
  return summary.viewCounts.SNOOZED;
}

export function notificationMatchesInboxScope(
  item: NotificationItem,
  scope: NotificationInboxFilterScope
): boolean {
  if (!notificationMatchesView(item, scope.view ?? 'PRIORITY')) return false;
  if (scope.readState === 'UNREAD' && item.readAt) return false;
  if (scope.readState === 'READ' && !item.readAt) return false;
  if (scope.priority && scope.priority !== 'ALL' && item.priority !== scope.priority) return false;
  if (scope.reason && scope.reason !== 'ALL' && item.reason.kind !== scope.reason) return false;
  if (
    scope.appKey &&
    item.source.appKey.toLocaleLowerCase('en-US') !== scope.appKey.toLocaleLowerCase('en-US')
  ) {
    return false;
  }
  const query = scope.query?.trim().toLocaleLowerCase('en-US');
  if (!query) return true;
  return [
    item.title,
    item.preview,
    item.actorLabel,
    item.source.appKey,
    item.source.appName,
    item.typeKey,
  ].some((value) => value?.toLocaleLowerCase('en-US').includes(query));
}

export function isNotificationShortcutTarget(target: EventTarget | null): boolean {
  const element = target as (EventTarget & { closest?: (selectors: string) => unknown }) | null;
  if (!element || typeof element.closest !== 'function') return false;
  if (element.closest('button, a[href]') && !element.closest('[data-notification-focus-id]')) {
    return true;
  }
  return Boolean(
    element.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"], [role="menu"]'
    )
  );
}

export function resolveMessagingReplyTarget(item: NotificationItem): MessagingReplyTarget | null {
  if (
    !isConversationSource(item.source.appKey) ||
    !item.typeKey.toUpperCase().startsWith('MESSAGING.')
  ) {
    return null;
  }
  const href = item.actions.find((action) => action.enabled && action.href)?.href;
  if (!href) return null;

  try {
    const target = new URL(href, 'https://dwp.invalid');
    if (target.origin !== 'https://dwp.invalid') return null;
    if (target.pathname !== '/messages/inbox' && target.pathname !== '/messages/direct')
      return null;
    const conversationId = target.searchParams.get('conversation') ?? '';
    const messageId = target.searchParams.get('message') ?? undefined;
    if (!SAFE_TARGET_ID.test(conversationId)) return null;
    if (messageId && !SAFE_TARGET_ID.test(messageId)) return null;
    return {
      conversationId,
      ...(messageId ? { replyToMessageId: messageId } : {}),
    };
  } catch {
    return null;
  }
}

export function optimisticNotificationSummary(
  summary: NotificationSummary,
  before: NotificationItem,
  after: NotificationItem
): NotificationSummary {
  const viewCounts = { ...summary.viewCounts };
  for (const view of ['PRIORITY', 'ALL', 'MENTIONS', 'SAVED', 'SNOOZED', 'DONE'] as const) {
    const delta =
      Number(notificationMatchesView(after, view)) - Number(notificationMatchesView(before, view));
    viewCounts[view] = Math.max(0, viewCounts[view] + delta);
  }

  const beforeUnread = countsAsUnread(before);
  const afterUnread = countsAsUnread(after);
  const beforeActionableUnread = beforeUnread && before.actionable;
  const afterActionableUnread = afterUnread && after.actionable;
  return {
    ...summary,
    totalUnread: Math.max(0, summary.totalUnread + Number(afterUnread) - Number(beforeUnread)),
    actionableUnread: Math.max(
      0,
      summary.actionableUnread + Number(afterActionableUnread) - Number(beforeActionableUnread)
    ),
    viewCounts,
  };
}

function isConversationSource(appKey: string): boolean {
  return ['messaging', 'spaces', 'space'].includes(appKey.toLocaleLowerCase('en-US'));
}

function countsAsUnread(item: NotificationItem): boolean {
  return !item.readAt && !item.completedAt && !item.snoozedUntil;
}
