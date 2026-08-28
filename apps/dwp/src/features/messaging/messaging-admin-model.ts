import type { MessagingPolicy } from '@dwp-frontend/shared-utils';

export const MESSAGING_RETENTION_DAYS = { min: 30, max: 3650 } as const;
export const MESSAGING_ATTACHMENT_MB = { min: 1, max: 1024 } as const;

export type MessagingPolicyForm = Omit<MessagingPolicy, 'aiAutoExecuteEnabled'>;

export const DEFAULT_MESSAGING_POLICY_FORM: MessagingPolicyForm = {
  directMessagesEnabled: true,
  spaceMessagingEnabled: true,
  allowMessageEdit: true,
  allowMessageDelete: true,
  aiAssistanceEnabled: true,
  retentionDays: 1095,
  maximumAttachmentMb: 100,
  version: 0,
};

export function messagingPolicyForm(policy: MessagingPolicy): MessagingPolicyForm {
  const { aiAutoExecuteEnabled: _discarded, ...form } = policy;
  return form;
}

export function validateMessagingPolicyForm(form: MessagingPolicyForm) {
  const retentionDays =
    Number.isInteger(form.retentionDays) &&
    form.retentionDays >= MESSAGING_RETENTION_DAYS.min &&
    form.retentionDays <= MESSAGING_RETENTION_DAYS.max;
  const maximumAttachmentMb =
    Number.isInteger(form.maximumAttachmentMb) &&
    form.maximumAttachmentMb >= MESSAGING_ATTACHMENT_MB.min &&
    form.maximumAttachmentMb <= MESSAGING_ATTACHMENT_MB.max;
  return { retentionDays, maximumAttachmentMb, valid: retentionDays && maximumAttachmentMb };
}

export function messagingPolicyFormChanged(
  form: MessagingPolicyForm,
  policy?: MessagingPolicy
): boolean {
  if (!policy) return false;
  const baseline = messagingPolicyForm(policy);
  return (Object.keys(baseline) as Array<keyof MessagingPolicyForm>)
    .filter((key) => key !== 'version')
    .some((key) => form[key] !== baseline[key]);
}
