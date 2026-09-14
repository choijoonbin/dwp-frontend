import { verifyApprovalGeneratedDocument } from '@dwp-frontend/shared-utils/api/approval-document-api';

import type { ApprovalGeneratedDocument } from '@dwp-frontend/shared-utils/api/approval-document-contract';

export async function downloadApprovalDocumentArtifact(
  document: ApprovalGeneratedDocument,
  onVerify: () => Promise<void>,
  isCurrent: () => boolean
) {
  const verified = await verifyApprovalGeneratedDocument(
    document,
    document.policyVersion,
    'DOWNLOAD'
  );
  await onVerify();
  await verifyApprovalGeneratedDocument(verified, verified.policyVersion, 'DOWNLOAD');
  if (!isCurrent()) throw new Error('Approval download context changed');
  const url = URL.createObjectURL(new Blob([verified.content], { type: verified.mediaType }));
  const link = window.document.createElement('a');
  try {
    link.href = url;
    link.download = verified.fileName;
    link.rel = 'noopener noreferrer';
    link.hidden = true;
    window.document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function verifyApprovalPrintHtml(content: string) {
  const parsed = new DOMParser().parseFromString(content, 'text/html');
  const policy = parsed.head
    .querySelector('meta[http-equiv="Content-Security-Policy"]')
    ?.getAttribute('content');
  if (
    !policy ||
    policy !==
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" ||
    parsed.querySelector('script,iframe,object,embed,form,base,link') ||
    Array.from(parsed.querySelectorAll('*')).some((element) =>
      Array.from(element.attributes).some((attribute) => /^on/i.test(attribute.name))
    )
  )
    throw new Error('Invalid approval print document');
  return content;
}
