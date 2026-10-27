import type {
  MessagingConversation,
  MessagingHome,
  MessagingPerson,
} from '@dwp-frontend/shared-utils';

export type MessagingAttentionState = 'MENTIONS' | 'UNREAD' | 'SAVED' | 'CLEAR';
export type MessagingFocusReason = 'UNREAD' | 'PINNED' | 'FAVORITE' | 'RECENT';

export function messagingPresenceRefreshIntervalMs(refreshAfterSeconds?: number): number {
  if (typeof refreshAfterSeconds !== 'number' || !Number.isFinite(refreshAfterSeconds)) {
    return 15_000;
  }
  return Math.min(20_000, Math.max(5_000, Math.round(refreshAfterSeconds * 1_000)));
}

export function resolveMessagingHomePresence(
  home: Pick<MessagingHome, 'generatedAt' | 'presence'>,
  {
    queryFailed = false,
    online = true,
    observedAt = Date.now(),
    dataUpdatedAt,
  }: {
    queryFailed?: boolean;
    online?: boolean;
    observedAt?: number;
    dataUpdatedAt?: number;
  } = {}
): NonNullable<MessagingHome['presence']> {
  const presence = home.presence;
  const evaluatedAt =
    presence?.evaluatedAt && Number.isFinite(Date.parse(presence.evaluatedAt))
      ? presence.evaluatedAt
      : home.generatedAt;
  const leaseTtlSeconds =
    typeof presence?.leaseTtlSeconds === 'number' &&
    Number.isFinite(presence.leaseTtlSeconds) &&
    presence.leaseTtlSeconds > 0
      ? presence.leaseTtlSeconds
      : 75;
  const refreshAfterSeconds =
    typeof presence?.refreshAfterSeconds === 'number' &&
    Number.isFinite(presence.refreshAfterSeconds) &&
    presence.refreshAfterSeconds > 0
      ? presence.refreshAfterSeconds
      : 15;
  const leaseExpiresAt =
    typeof dataUpdatedAt === 'number'
      ? messagingHomePresenceLeaseExpiresAt(home, dataUpdatedAt)
      : undefined;
  const authority =
    !queryFailed &&
    online &&
    presence?.authority === 'LIVE' &&
    leaseExpiresAt !== undefined &&
    Number.isFinite(observedAt) &&
    observedAt < leaseExpiresAt
      ? 'LIVE'
      : 'UNAVAILABLE';
  return { authority, evaluatedAt, leaseTtlSeconds, refreshAfterSeconds };
}

export function messagingHomePresenceLeaseExpiresAt(
  home: Pick<MessagingHome, 'generatedAt' | 'presence'>,
  dataUpdatedAt: number
): number | undefined {
  const presence = home.presence;
  if (
    presence?.authority !== 'LIVE' ||
    !presence.evaluatedAt ||
    typeof presence.leaseTtlSeconds !== 'number' ||
    !Number.isFinite(presence.leaseTtlSeconds) ||
    presence.leaseTtlSeconds <= 0 ||
    !Number.isFinite(dataUpdatedAt) ||
    dataUpdatedAt <= 0
  ) {
    return undefined;
  }
  const evaluatedAt = Date.parse(presence.evaluatedAt);
  const generatedAt = Date.parse(home.generatedAt);
  if (!Number.isFinite(evaluatedAt) || !Number.isFinite(generatedAt)) return undefined;
  const leaseTtlMs = presence.leaseTtlSeconds * 1_000;
  const serverObservedAge = Math.max(0, generatedAt - evaluatedAt);
  const remainingTtl = Math.max(0, leaseTtlMs - serverObservedAge);
  const expiresAt = dataUpdatedAt + remainingTtl;
  return Number.isFinite(expiresAt) ? expiresAt : undefined;
}
export type MessagingHomeFilter = 'ALL' | 'MENTIONS' | 'SPACE' | 'DIRECT';

export function messagingHomeFilter(value: string | null): MessagingHomeFilter {
  return value === 'MENTIONS' || value === 'SPACE' || value === 'DIRECT' ? value : 'ALL';
}

export function filterMessagingHomeConversations(
  conversations: MessagingConversation[],
  filter: MessagingHomeFilter,
  mentions: MessagingConversation[] = []
) {
  const source = filter === 'MENTIONS' ? mentions : conversations;
  return [...new Map(source.map((item) => [item.conversationId, item])).values()]
    .filter(
      (item) =>
        item.lifecycleState === 'ACTIVE' &&
        item.unreadCount > 0 &&
        (filter !== 'SPACE' || item.visibility === 'SPACE') &&
        (filter !== 'DIRECT' || item.conversationType === 'DIRECT')
    )
    .sort(compareMessagingAttention);
}

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

export function selectAvailableMessagingPeople(
  people: MessagingPerson[],
  limit = 5
): MessagingPerson[] {
  return people.filter((person) => person.presenceState === 'AVAILABLE').slice(0, limit);
}

export function buildMessagingHomeView(
  home: MessagingHome,
  conversationSource: MessagingConversation[] = home.priority
) {
  return {
    attentionState: messagingAttentionState(home),
    focusConversations: filterMessagingHomeConversations(conversationSource, 'ALL').slice(0, 6),
    spaceConversations: [...home.spaces]
      .filter((conversation) => conversation.lifecycleState === 'ACTIVE')
      .sort(compareMessagingAttention)
      .slice(0, 4),
    directConversations: [...conversationSource]
      .filter(
        (conversation) =>
          conversation.lifecycleState === 'ACTIVE' && conversation.conversationType === 'DIRECT'
      )
      .sort(compareMessagingAttention)
      .slice(0, 4),
  };
}
