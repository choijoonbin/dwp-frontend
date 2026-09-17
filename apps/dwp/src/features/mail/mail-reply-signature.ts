import type { MailSignature } from '@dwp-frontend/shared-utils';

export function resolveMailReplySignature(signatures: readonly MailSignature[], accountId: string) {
  const eligible = signatures.filter(
    (signature) =>
      signature.defaultForReply && (!signature.accountId || signature.accountId === accountId)
  );
  return eligible.find((signature) => signature.accountId === accountId) ?? eligible[0] ?? null;
}

function htmlSignatureText(value: string) {
  const withLineBreaks = value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(?:address|blockquote|div|h[1-6]|li|p|pre|tr)>/giu, '\n');
  if (typeof DOMParser === 'undefined') {
    return withLineBreaks.replace(/<[^>]+>/gu, ' ');
  }
  return new DOMParser().parseFromString(withLineBreaks, 'text/html').body.textContent ?? '';
}

export function mailReplySignatureText(signature: MailSignature) {
  return [signature.body, signature.mandatoryContent]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => (signature.bodyFormat === 'HTML' ? htmlSignatureText(value) : value))
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n\n');
}
