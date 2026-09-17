import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listNotificationAttentionContexts,
  type NotificationAttentionContextOption,
  type NotificationItem,
} from '@dwp-frontend/shared-utils';

import {
  notificationContextOptions,
  type NotificationContextFilter,
  type NotificationContextOption,
} from './notification-filter-model';

const CONTEXT_CATALOG_LIMIT = 50;
const CONTEXT_CATALOG_STALE_TIME = 60_000;

export function useNotificationContextCatalog(
  items: readonly NotificationItem[],
  selected: readonly NotificationContextFilter[]
): NotificationContextOption[] {
  const resourceQuery = useQuery({
    queryKey: ['notifications', 'context-catalog', 'RESOURCE'],
    queryFn: ({ signal }) =>
      listNotificationAttentionContexts({ kind: 'RESOURCE', limit: CONTEXT_CATALOG_LIMIT }, signal),
    staleTime: CONTEXT_CATALOG_STALE_TIME,
    retry: 1,
  });
  const topicQuery = useQuery({
    queryKey: ['notifications', 'context-catalog', 'TOPIC_TOKEN'],
    queryFn: ({ signal }) =>
      listNotificationAttentionContexts(
        { kind: 'TOPIC_TOKEN', limit: CONTEXT_CATALOG_LIMIT },
        signal
      ),
    staleTime: CONTEXT_CATALOG_STALE_TIME,
    retry: 1,
  });

  return useMemo(
    () =>
      mergeNotificationContextCatalog(
        notificationContextOptions(items),
        selected,
        resourceQuery.data?.items ?? [],
        topicQuery.data?.items ?? []
      ),
    [items, resourceQuery.data?.items, selected, topicQuery.data?.items]
  );
}

export function mergeNotificationContextCatalog(
  loaded: readonly NotificationContextOption[],
  selected: readonly NotificationContextFilter[],
  resources: readonly NotificationAttentionContextOption[],
  topics: readonly NotificationAttentionContextOption[]
): NotificationContextOption[] {
  const catalog = new Map<string, NotificationContextOption>();
  for (const option of [...loaded, ...selected]) addContext(catalog, option);
  for (const option of [...resources, ...topics]) {
    addContext(catalog, {
      kind: option.scopeKind,
      key: option.scopeKey,
      label: option.displayLabel,
    });
  }
  return [...catalog.values()].sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label)
  );
}

function addContext(
  catalog: Map<string, NotificationContextOption>,
  option: NotificationContextOption
): void {
  const identity = `${option.kind}\u0000${option.key}`;
  const current = catalog.get(identity);
  if (!current || !current.label || current.label === current.key) catalog.set(identity, option);
}
