export const MAIL_GROUP_TO_RECIPIENT_LIMIT = 100;

export function mailGroupDeliveryPolicy(memberCount: number, recipientMode: 'TO' | 'BCC') {
  const recipientLimitExceeded = memberCount > MAIL_GROUP_TO_RECIPIENT_LIMIT;
  const unsupportedPrivateMode = recipientMode === 'BCC';
  return {
    recipientLimitExceeded,
    unsupportedPrivateMode,
    canSend: memberCount > 0 && !recipientLimitExceeded && !unsupportedPrivateMode,
  } as const;
}
