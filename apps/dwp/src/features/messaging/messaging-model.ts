import type { MessagingMessage } from '@dwp-frontend/shared-utils';

export type MessagingComposerKey = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  defaultPrevented?: boolean;
};

export type MessagingThread = {
  root: MessagingMessage;
  replies: MessagingMessage[];
};

export function shouldSendMessagingMessage(input: MessagingComposerKey): boolean {
  return input.key === 'Enter' && !input.shiftKey && !input.isComposing && !input.defaultPrevented;
}

export function messagingRootMessages(messages: MessagingMessage[]): MessagingMessage[] {
  return messages.filter((message) => !message.replyToMessageId);
}

export function messagingThread(
  messages: MessagingMessage[],
  rootMessageId: string | null
): MessagingThread | null {
  if (!rootMessageId) return null;
  const root = messages.find((message) => message.messageId === rootMessageId);
  if (!root) return null;
  const resolvedRoot = root.replyToMessageId
    ? messages.find((message) => message.messageId === root.replyToMessageId)
    : root;
  if (!resolvedRoot) return null;

  return {
    root: resolvedRoot,
    replies: messages.filter((message) => message.replyToMessageId === resolvedRoot.messageId),
  };
}

export function messagingReplyCounts(messages: MessagingMessage[]): Map<string, number> {
  const counts = new Map<string, number>();
  messages.forEach((message) => {
    if (!message.replyToMessageId) return;
    counts.set(message.replyToMessageId, (counts.get(message.replyToMessageId) ?? 0) + 1);
  });
  return counts;
}

export function upsertMessagingMessage(
  messages: MessagingMessage[],
  nextMessage: MessagingMessage
): MessagingMessage[] {
  const existingIndex = messages.findIndex(
    (message) => message.messageId === nextMessage.messageId
  );
  const next =
    existingIndex >= 0
      ? messages.map((message, index) => (index === existingIndex ? nextMessage : message))
      : [...messages, nextMessage];

  return next.sort((left, right) => {
    if (left.sequence != null && right.sequence != null) return left.sequence - right.sequence;
    return (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() ||
      left.messageId.localeCompare(right.messageId)
    );
  });
}

export function mergeMessagingMessages(...collections: MessagingMessage[][]): MessagingMessage[] {
  return collections.reduce(
    (messages, collection) =>
      collection.reduce((merged, message) => upsertMessagingMessage(merged, message), messages),
    [] as MessagingMessage[]
  );
}
