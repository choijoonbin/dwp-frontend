export type MessagingConversationView = 'inbox' | 'direct' | 'spaces';

export function messagingConversationHref({
  conversationId,
  messageId,
  view = 'inbox',
}: {
  conversationId: string;
  messageId?: string | null;
  view?: MessagingConversationView;
}) {
  const search = new URLSearchParams({ conversation: conversationId });
  if (messageId) search.set('message', messageId);
  return `/messages/${view}?${search.toString()}`;
}
