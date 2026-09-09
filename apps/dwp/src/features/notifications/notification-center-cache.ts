import type { InfiniteData } from '@tanstack/react-query';
import type {
  NotificationInboxPage,
  NotificationItem,
} from '@dwp-frontend/shared-utils/api/notification-api';

import {
  notificationMatchesInboxScope,
  type NotificationInboxFilterScope,
} from './notification-inbox-model';

export type NotificationInboxCache = InfiniteData<NotificationInboxPage> | NotificationInboxPage;

function updatePageItems(
  page: NotificationInboxPage,
  item: NotificationItem,
  scope: NotificationInboxFilterScope
): NotificationInboxPage {
  return {
    ...page,
    items: page.items
      .map((candidate) => (candidate.notificationId === item.notificationId ? item : candidate))
      .filter((candidate) => notificationMatchesInboxScope(candidate, scope)),
  };
}

export function updateInboxCache(
  data: NotificationInboxCache | undefined,
  item: NotificationItem,
  scope: NotificationInboxFilterScope
): NotificationInboxCache | undefined {
  if (!data) return data;
  if (!('pages' in data)) return updatePageItems(data, item, scope);
  return {
    ...data,
    pages: data.pages.map((page) => updatePageItems(page, item, scope)),
  };
}

export function inboxScopeFromQueryKey(queryKey: readonly unknown[]): NotificationInboxFilterScope {
  const scope = queryKey[2];
  if (!scope || typeof scope !== 'object') return { view: 'PRIORITY' };
  return scope as NotificationInboxFilterScope;
}
