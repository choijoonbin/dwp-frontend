import type {
  MessagingActivityItem,
  MessagingActivityKind,
  MessagingThreadItem,
} from '@dwp-frontend/shared-utils';

export type MessagingActivityFilter = 'ALL' | MessagingActivityKind;

export function messagingActivityFilter(value: string | null): MessagingActivityFilter {
  return value === 'MENTION' ||
    value === 'THREAD_REPLY' ||
    value === 'REACTION' ||
    value === 'SYSTEM' ||
    value === 'SCHEDULE_FAILED'
    ? value
    : 'ALL';
}

export function filterMessagingActivity(
  items: readonly MessagingActivityItem[],
  filter: MessagingActivityFilter,
  query: string
) {
  const normalized = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (filter !== 'ALL' && item.kind !== filter) return false;
    if (!normalized) return true;
    return [item.actorName, item.conversationName, item.preview]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalized));
  });
}

export function filterMessagingThreads(items: readonly MessagingThreadItem[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...items];
  return items.filter((item) =>
    [item.conversationName, item.rootSenderName, item.rootPreview, item.latestReplySenderName]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalized))
  );
}
