import { useQuery } from '@tanstack/react-query';
import {
  getMessagingConversationDisplayPreference,
  MESSAGING_API_CAPABILITIES,
} from '@dwp-frontend/shared-utils';

import {
  defaultMessagingConversationDisplayPreference,
  messagingConversationDisplayQueryKey,
} from './messaging-display-model';

import type { MessagingConversation } from '@dwp-frontend/shared-utils';

const FALLBACK_CONVERSATION: MessagingConversation = {
  conversationId: 'unselected',
  conversationKey: 'unselected',
  conversationType: 'CHANNEL',
  visibility: 'PRIVATE',
  dataClassification: 'INTERNAL',
  lifecycleState: 'ACTIVE',
  memberCount: 0,
  unreadCount: 0,
  favorite: false,
  pinned: false,
  version: 0,
};

export function useMessagingDisplayPreference(conversation?: MessagingConversation) {
  const resolvedConversation = conversation ?? FALLBACK_CONVERSATION;
  const fallback = defaultMessagingConversationDisplayPreference(resolvedConversation);
  const query = useQuery({
    queryKey: messagingConversationDisplayQueryKey(resolvedConversation.conversationId),
    queryFn: () => getMessagingConversationDisplayPreference(resolvedConversation.conversationId),
    enabled: Boolean(conversation) && MESSAGING_API_CAPABILITIES.displayPreferences,
    staleTime: 60_000,
    retry: 1,
  });
  return {
    ...query,
    preference: query.data ?? fallback,
  };
}
