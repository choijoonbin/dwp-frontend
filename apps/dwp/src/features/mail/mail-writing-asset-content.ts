import type { MailSignature, MailTemplate } from '@dwp-frontend/shared-utils';

export type MailTemplateVariables = Partial<
  Record<'displayName' | 'department' | 'recipientName', string | null>
>;

export const MAIL_WRITING_ASSET_VARIABLES = ['displayName', 'department', 'recipientName'] as const;

export type MailWritingAssetVariable = (typeof MAIL_WRITING_ASSET_VARIABLES)[number];

const RECIPIENT_VARIABLE = /\{\{\s*recipientName\s*\}\}/u;
const ALLOWED_VARIABLE = /\{\{\s*(displayName|department|recipientName)\s*\}\}/gu;

export function mailWritingAssetVariableToken(variable: MailWritingAssetVariable) {
  return `{{${variable}}}`;
}

export function resolveMailTemplateVariables(value: string, variables: MailTemplateVariables) {
  return value.replace(
    ALLOWED_VARIABLE,
    (_match, key: keyof MailTemplateVariables) => variables[key] ?? ''
  );
}

export function mailWritingAssetBody(
  asset: Pick<MailTemplate | MailSignature, 'body' | 'bodyFormat' | 'mandatoryContent'>
) {
  const separator = asset.bodyFormat === 'HTML' ? '<br><br>' : '\n\n';
  return [asset.body, asset.mandatoryContent].filter(Boolean).join(separator);
}

export function materializeMailTemplate(
  template: MailTemplate,
  variables: MailTemplateVariables
): MailTemplate {
  return {
    ...template,
    subject: resolveMailTemplateVariables(template.subject ?? '', variables),
    body: resolveMailTemplateVariables(template.body, variables),
    mandatoryContent: template.mandatoryContent
      ? resolveMailTemplateVariables(template.mandatoryContent, variables)
      : template.mandatoryContent,
  };
}

export function mailTemplateRequiresRecipientReview(template: MailTemplate | null | undefined) {
  if (!template) return false;
  return [template.subject, template.body, template.mandatoryContent].some(
    (value) => typeof value === 'string' && RECIPIENT_VARIABLE.test(value)
  );
}

export function mailRecipientIdentityChanged(
  previous: { name?: string | null; email: string } | null | undefined,
  next: { name?: string | null; email: string } | null | undefined
) {
  return previous?.email !== next?.email || previous?.name !== next?.name;
}

export function mailWritingAssetAppliesToAccount(
  asset: Pick<MailTemplate | MailSignature, 'accountId'>,
  accountId: string | null | undefined
) {
  return !asset.accountId || asset.accountId === accountId;
}

export function resolveMailNewSignature(
  signatures: readonly MailSignature[],
  accountId: string | null | undefined,
  preferredSignatureId: string | null | undefined
): MailSignature | null {
  const available = signatures.filter(
    (signature) =>
      signature.active !== false && mailWritingAssetAppliesToAccount(signature, accountId)
  );
  const preferred = available.find((signature) => signature.signatureId === preferredSignatureId);
  if (preferred) return preferred;

  const priority: Record<MailSignature['scope'], number> = {
    ACCOUNT: 0,
    ORGANIZATION: 1,
    PERSONAL: 2,
  };
  return (
    available
      .filter((signature) => signature.defaultForNew)
      .sort((left, right) => priority[left.scope] - priority[right.scope])[0] ?? null
  );
}
