import { useQuery } from '@tanstack/react-query';
import { getMessagingReadReceipts } from '@dwp-frontend/shared-utils';

import { messagingReceiptMessageIds } from './messaging-read-receipt-model';

import type { MessagingMessage } from '@dwp-frontend/shared-utils';

export function useMessagingReadReceipts(
  conversationId: string | undefined,
  messages: MessagingMessage[],
  currentUserId?: number,
  enabled = true
) {
  const messageIds = messagingReceiptMessageIds(messages, currentUserId);
  const query = useQuery({
    queryKey: ['messaging', 'read-receipts', conversationId, messageIds],
    queryFn: () => getMessagingReadReceipts(conversationId!, messageIds),
    enabled: enabled && Boolean(conversationId) && messageIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15_000,
    retry: 1,
  });
  // On a failed refresh, discard old personal read data rather than imply it is still shared.
  return new Map(
    (query.isError ? [] : (query.data ?? [])).map((receipt) => [receipt.messageId, receipt])
  );
}
