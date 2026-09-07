import type { MessagingConversation } from '@dwp-frontend/shared-utils';

export type MessagingNavigatorSectionKey = 'PINNED' | 'CHANNELS' | 'DIRECT';
export type MessagingNavigatorFilter = 'ALL' | 'FAVORITES' | 'UNREAD';

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
