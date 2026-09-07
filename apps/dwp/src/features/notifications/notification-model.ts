import type {
  NotificationInboxPage,
  NotificationItem,
  NotificationTriageAction,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

export const USER_CHANNELS = [
  'IN_APP',
  'EMAIL',
  'WEB_PUSH',
  'MOBILE_PUSH',
  'TEAMS',
  'SLACK',
] as const;

export function flattenNotificationPages(
  pages: readonly NotificationInboxPage[] | undefined
): NotificationItem[] {
  const seen = new Set<string>();
  const items: NotificationItem[] = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.notificationId)) continue;
      seen.add(item.notificationId);
      items.push(item);
    }
  }
  return items;
}

export type GlanceReconciliation = {
  visible: NotificationItem[];
  buffered: NotificationItem[];
  bufferedCount: number;
};

export function reconcileGlanceItems(
  visible: readonly NotificationItem[],
  incoming: readonly NotificationItem[],
  open: boolean,
  limit = 6
): GlanceReconciliation {
  const boundedIncoming = incoming.slice(0, limit);
  if (!open || visible.length === 0) {
    return { visible: boundedIncoming, buffered: [], bufferedCount: 0 };
  }

  const incomingById = new Map(boundedIncoming.map((item) => [item.notificationId, item]));
  const visibleIds = new Set(visible.map((item) => item.notificationId));
  const added = boundedIncoming.filter((item) => !visibleIds.has(item.notificationId));
  const patchedVisible = visible
    .map((item) => incomingById.get(item.notificationId) ?? item)
    .slice(0, limit);

  return {
    visible: patchedVisible,
    buffered: added.length > 0 ? boundedIncoming : [],
    bufferedCount: added.length,
  };
}

export function moveNotificationSelection(
  currentIndex: number,
  key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
  itemCount: number
): number {
  if (itemCount <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  if (key === 'ArrowDown') return Math.min(itemCount - 1, Math.max(0, currentIndex + 1));
  return Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1);
}

export function optimisticTriageItem(
  item: NotificationItem,
  action: NotificationTriageAction,
  at = new Date().toISOString(),
  snoozedUntil?: string
): NotificationItem {
  const base = { ...item, version: (BigInt(item.version) + BigInt(1)).toString() };
  if (action === 'READ') return { ...base, readAt: at };
  if (action === 'UNREAD') return { ...base, readAt: null };
  if (action === 'SAVE') return { ...base, savedAt: at };
  if (action === 'UNSAVE') return { ...base, savedAt: null };
  if (action === 'COMPLETE') return { ...base, completedAt: at, snoozedUntil: null };
  if (action === 'RESTORE') return { ...base, completedAt: null };
  if (action === 'SNOOZE') return { ...base, snoozedUntil: snoozedUntil ?? at };
  return base;
}

export function notificationMatchesView(item: NotificationItem, view: NotificationView): boolean {
  if (view === 'DONE') return Boolean(item.completedAt);
  if (view === 'SAVED') return Boolean(item.savedAt);
  if (view === 'SNOOZED') return Boolean(item.snoozedUntil) && !item.completedAt;
  if (item.completedAt || item.snoozedUntil) return false;
  if (view === 'MENTIONS') return item.reason.kind === 'MENTION';
  if (view === 'PRIORITY') return item.actionable;
  return true;
}

export function defaultSnoozeTime(hours = 4): string {
  return new Date(Date.now() + hours * 60 * 60 * 1_000).toISOString();
}
