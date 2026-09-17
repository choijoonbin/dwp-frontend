import { describe, expect, it } from 'vitest';

import {
  MAIL_GROUP_TO_RECIPIENT_LIMIT,
  mailGroupDeliveryPolicy,
} from './mail-group-delivery-policy';

describe('mail group delivery policy', () => {
  it('allows To delivery through the supported 100-recipient boundary', () => {
    expect(mailGroupDeliveryPolicy(MAIL_GROUP_TO_RECIPIENT_LIMIT, 'TO')).toEqual({
      recipientLimitExceeded: false,
      unsupportedPrivateMode: false,
      canSend: true,
    });
    expect(mailGroupDeliveryPolicy(MAIL_GROUP_TO_RECIPIENT_LIMIT + 1, 'TO').canSend).toBe(false);
  });

  it('does not allow Bcc group delivery, including saved retry attempts', () => {
    expect(mailGroupDeliveryPolicy(1, 'BCC')).toEqual({
      recipientLimitExceeded: false,
      unsupportedPrivateMode: true,
      canSend: false,
    });
  });
});
