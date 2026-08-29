import type { MessagingSendMutationInput } from './messaging-workspace-types';

export type MessagingSendAttempt = {
  conversationId: string;
  threadRootId: string | null;
  payload: MessagingSendMutationInput;
};

export function messagingSendAttemptMatches(
  attempt: MessagingSendAttempt | null,
  conversationId: string | null,
  threadRootId: string | null
) {
  return Boolean(
    attempt &&
    conversationId &&
    attempt.conversationId === conversationId &&
    attempt.threadRootId === threadRootId
  );
}
