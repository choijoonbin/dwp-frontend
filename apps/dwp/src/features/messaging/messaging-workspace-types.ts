export type MessagingScope = 'ALL' | 'FAVORITES' | 'SPACES' | 'DIRECT' | 'CHANNELS';

export type MessagingReactionMutationInput = {
  messageId: string;
  emoji: string;
  remove: boolean;
};

export type MessagingSendMutationInput = {
  body: string;
  replyToMessageId?: string;
  idempotencyKey: string;
};
