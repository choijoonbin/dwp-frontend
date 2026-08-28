import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MESSAGING_POLICY_FORM,
  messagingPolicyFormChanged,
  validateMessagingPolicyForm,
} from './messaging-admin-model';

import type { MessagingPolicy } from '@dwp-frontend/shared-utils';

const policy: MessagingPolicy = {
  ...DEFAULT_MESSAGING_POLICY_FORM,
  aiAutoExecuteEnabled: false,
  version: 4,
};

describe('messaging admin policy model', () => {
  it('matches the tenant policy numeric contract', () => {
    expect(
      validateMessagingPolicyForm({ ...DEFAULT_MESSAGING_POLICY_FORM, retentionDays: 29 })
    ).toMatchObject({ retentionDays: false, valid: false });
    expect(
      validateMessagingPolicyForm({ ...DEFAULT_MESSAGING_POLICY_FORM, maximumAttachmentMb: 1025 })
    ).toMatchObject({ maximumAttachmentMb: false, valid: false });
    expect(validateMessagingPolicyForm(DEFAULT_MESSAGING_POLICY_FORM).valid).toBe(true);
  });

  it('enables persistence only after an effective policy change', () => {
    expect(
      messagingPolicyFormChanged({ ...DEFAULT_MESSAGING_POLICY_FORM, version: 4 }, policy)
    ).toBe(false);
    expect(
      messagingPolicyFormChanged(
        { ...DEFAULT_MESSAGING_POLICY_FORM, directMessagesEnabled: false, version: 4 },
        policy
      )
    ).toBe(true);
  });

  it('does not treat a concurrency token refresh as a user policy change', () => {
    expect(
      messagingPolicyFormChanged({ ...DEFAULT_MESSAGING_POLICY_FORM, version: 3 }, policy)
    ).toBe(false);
  });
});
