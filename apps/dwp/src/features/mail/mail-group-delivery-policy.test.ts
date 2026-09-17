import { describe, expect, it } from 'vitest';

import {
  MAIL_GROUP_TO_RECIPIENT_LIMIT,
  mailGroupAttemptCanSubmit,
  mailGroupDeliveryPolicy,
} from './mail-group-delivery-policy';

describe('mail group delivery policy', () => {
  it('allows To delivery through the supported 100-recipient boundary', () => {
    expect(mailGroupDeliveryPolicy(MAIL_GROUP_TO_RECIPIENT_LIMIT, 'TO', false)).toEqual({
      recipientLimitExceeded: false,
      unsupportedPrivateMode: false,
      canSend: true,
    });
    expect(mailGroupDeliveryPolicy(MAIL_GROUP_TO_RECIPIENT_LIMIT + 1, 'TO', false).canSend).toBe(
      false
    );
  });

  it('allows Bcc only when the selected account capability supports it', () => {
    expect(mailGroupDeliveryPolicy(1, 'BCC', false)).toEqual({
      recipientLimitExceeded: false,
      unsupportedPrivateMode: true,
      canSend: false,
    });
    expect(mailGroupDeliveryPolicy(1, 'BCC', true)).toEqual({
      recipientLimitExceeded: false,
      unsupportedPrivateMode: false,
      canSend: true,
    });
  });

  it('requires a fresh recipient snapshot after a group-version conflict', () => {
    expect(mailGroupAttemptCanSubmit({ reviewRequired: true, snapshotStale: true })).toBe(false);
    expect(mailGroupAttemptCanSubmit({ reviewRequired: true, snapshotStale: false })).toBe(true);
    expect(mailGroupAttemptCanSubmit(null)).toBe(true);
  });
});
