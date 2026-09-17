export const MAIL_GROUP_TO_RECIPIENT_LIMIT = 100;

export type MailGroupReviewState = {
  reviewRequired?: boolean;
  snapshotStale?: boolean;
};

export function mailGroupAttemptCanSubmit(attempt?: MailGroupReviewState | null) {
  return attempt?.snapshotStale !== true;
}

export function mailGroupDeliveryPolicy(
  memberCount: number,
  recipientMode: 'TO' | 'BCC',
  supportsBcc: boolean
) {
  const recipientLimitExceeded = memberCount > MAIL_GROUP_TO_RECIPIENT_LIMIT;
  const unsupportedPrivateMode = recipientMode === 'BCC' && !supportsBcc;
  return {
    recipientLimitExceeded,
    unsupportedPrivateMode,
    canSend: memberCount > 0 && !recipientLimitExceeded && !unsupportedPrivateMode,
  } as const;
}
