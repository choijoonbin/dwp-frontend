export type MessagingScope = 'ALL' | 'FAVORITES' | 'SPACES' | 'DIRECT' | 'CHANNELS' | 'MENTIONS';

export type MessagingReactionMutationInput = {
  messageId: string;
  emoji: string;
  remove: boolean;
};

export type MessagingSendMutationInput = {
  body: string;
  replyToMessageId?: string;
  idempotencyKey: string;
  attachmentIds: string[];
  mentionedUserIds: number[];
};
