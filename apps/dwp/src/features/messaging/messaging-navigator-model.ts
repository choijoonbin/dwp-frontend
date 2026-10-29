import type { MessagingConversation } from '@dwp-frontend/shared-utils';

export type MessagingNavigatorSectionKey = 'PINNED' | 'CHANNELS' | 'DIRECT';
export type MessagingNavigatorFilter = 'ALL' | 'FAVORITES' | 'UNREAD';

export type MessagingNavigatorUrlState = Readonly<{
  query: string;
  filter: MessagingNavigatorFilter;
}>;

const NAVIGATOR_FILTERS = new Set<MessagingNavigatorFilter>(['ALL', 'FAVORITES', 'UNREAD']);

export function readMessagingNavigatorUrlState(
  params: URLSearchParams
): MessagingNavigatorUrlState {
  const rawFilter = params.get('filter')?.toUpperCase() ?? 'ALL';
  return {
    query: params.get('q') ?? '',
    filter: NAVIGATOR_FILTERS.has(rawFilter as MessagingNavigatorFilter)
      ? (rawFilter as MessagingNavigatorFilter)
      : 'ALL',
  };
}

export function mergeMessagingNavigatorUrlState(
  params: URLSearchParams,
  patch: Partial<MessagingNavigatorUrlState>
): URLSearchParams {
  const next = new URLSearchParams(params);
  if ('query' in patch) {
    const query = patch.query ?? '';
    if (query) next.set('q', query);
    else next.delete('q');
  }
  if ('filter' in patch) {
    const filter = patch.filter ?? 'ALL';
    if (filter === 'ALL') next.delete('filter');
    else next.set('filter', filter);
  }
  return next;
}

export function filterMessagingNavigator(
  conversations: MessagingConversation[],
  filter: MessagingNavigatorFilter
) {
  return conversations.filter((conversation) =>
    filter === 'FAVORITES'
      ? conversation.favorite
      : filter === 'UNREAD'
        ? conversation.unreadCount > 0
        : true
  );
}

export type MessagingNavigatorSection = {
  key: MessagingNavigatorSectionKey;
  conversations: MessagingConversation[];
};

function activityTime(conversation: MessagingConversation) {
  const value = conversation.lastMessageAt ? Date.parse(conversation.lastMessageAt) : 0;
  return Number.isFinite(value) ? value : 0;
}

function compareNavigatorItems(left: MessagingConversation, right: MessagingConversation) {
  return (
    right.unreadCount - left.unreadCount ||
    activityTime(right) - activityTime(left) ||
    (left.name ?? left.conversationId).localeCompare(right.name ?? right.conversationId)
  );
}

export function buildMessagingNavigatorSections(
  conversations: MessagingConversation[]
): MessagingNavigatorSection[] {
  const pinned = conversations.filter(
    (conversation) => conversation.pinned || conversation.favorite
  );
  const pinnedIds = new Set(pinned.map((conversation) => conversation.conversationId));
  const remaining = conversations.filter(
    (conversation) => !pinnedIds.has(conversation.conversationId)
  );

  return [
    { key: 'PINNED', conversations: pinned.sort(compareNavigatorItems) },
    {
      key: 'CHANNELS',
      conversations: remaining
        .filter((conversation) => conversation.conversationType !== 'DIRECT')
        .sort(compareNavigatorItems),
    },
    {
      key: 'DIRECT',
      conversations: remaining
        .filter((conversation) => conversation.conversationType === 'DIRECT')
        .sort(compareNavigatorItems),
    },
  ].filter((section) => section.conversations.length > 0) as MessagingNavigatorSection[];
}
