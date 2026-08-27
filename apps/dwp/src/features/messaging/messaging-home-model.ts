import type { MessagingConversation, MessagingHome } from '@dwp-frontend/shared-utils';

export type MessagingAttentionState = 'MENTIONS' | 'UNREAD' | 'SAVED' | 'CLEAR';
export type MessagingFocusReason = 'UNREAD' | 'PINNED' | 'FAVORITE' | 'RECENT';

function activityTime(conversation: MessagingConversation) {
  const value = conversation.lastMessageAt ? Date.parse(conversation.lastMessageAt) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function compareMessagingAttention(
  left: MessagingConversation,
  right: MessagingConversation
) {
  const leftBand = left.conversationType === 'DIRECT' ? 0 : left.visibility === 'SPACE' ? 1 : 2;
  const rightBand = right.conversationType === 'DIRECT' ? 0 : right.visibility === 'SPACE' ? 1 : 2;
  return (
    leftBand - rightBand ||
    right.unreadCount - left.unreadCount ||
    Number(right.pinned) - Number(left.pinned) ||
    Number(right.favorite) - Number(left.favorite) ||
    activityTime(right) - activityTime(left) ||
    left.conversationId.localeCompare(right.conversationId)
  );
}

export function messagingFocusReason(conversation: MessagingConversation): MessagingFocusReason {
  if (conversation.unreadCount > 0) return 'UNREAD';
  if (conversation.pinned) return 'PINNED';
  if (conversation.favorite) return 'FAVORITE';
  return 'RECENT';
}

export function messagingAttentionState(home: MessagingHome): MessagingAttentionState {
  if (home.metrics.mentions > 0) return 'MENTIONS';
  if (home.metrics.unreadConversations > 0) return 'UNREAD';
  if (home.metrics.savedItems > 0) return 'SAVED';
  return 'CLEAR';
}

export function buildMessagingHomeView(
  home: MessagingHome,
  conversationSource: MessagingConversation[] = home.priority
) {
  return {
    attentionState: messagingAttentionState(home),
    focusConversations: [...conversationSource]
      .filter((conversation) => conversation.unreadCount > 0)
      .sort(compareMessagingAttention)
      .slice(0, 6),
    spaceConversations: [...home.spaces].sort(compareMessagingAttention).slice(0, 4),
  };
}
