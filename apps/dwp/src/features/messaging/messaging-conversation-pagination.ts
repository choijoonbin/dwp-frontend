import type { MessagingConversationPage } from '@dwp-frontend/shared-utils';

export type MessagingConversationPageParam = number | string;

export function messagingConversationPageRequest(pageParam: MessagingConversationPageParam): {
  page: number;
  cursor?: string;
} {
  return typeof pageParam === 'string' ? { page: 0, cursor: pageParam } : { page: pageParam };
}

export function nextMessagingConversationPageParam(
  page: MessagingConversationPage
): MessagingConversationPageParam | undefined {
  if (page.hasMore === false) return undefined;
  if (page.nextCursor) return page.nextCursor;
  const hasMore = page.hasMore ?? (page.page + 1) * page.pageSize < page.total;
  if (!hasMore) return undefined;
  return page.nextPage ?? page.page + 1;
}
