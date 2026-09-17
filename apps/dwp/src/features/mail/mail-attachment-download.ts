import { formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { MailMessageAttachment } from '@dwp-frontend/shared-utils';

export function mailMessageAttachments(values: readonly unknown[]): MailMessageAttachment[] {
  return values.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    const attachmentId = typeof record.attachmentId === 'string' ? record.attachmentId.trim() : '';
    const fileNameValue = record.fileName ?? record.name;
    const fileName = typeof fileNameValue === 'string' ? fileNameValue.trim() : '';
    if (!attachmentId || !fileName) return [];
    return [
      {
        attachmentId,
        fileName,
        contentType:
          typeof record.contentType === 'string' && record.contentType.trim()
            ? record.contentType
            : 'application/octet-stream',
        sizeBytes:
          typeof record.sizeBytes === 'number' && Number.isSafeInteger(record.sizeBytes)
            ? Math.max(0, record.sizeBytes)
            : 0,
        checksumSha256:
          typeof record.checksumSha256 === 'string' ? record.checksumSha256 : undefined,
      },
    ];
  });
}

export function formatMailAttachmentSize(sizeBytes: number, locale: string) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const units = ['KB', 'MB', 'GB'] as const;
  let size = sizeBytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${formatNumber(
    size,
    { maximumFractionDigits: 1 },
    resolveSupportedLocale(locale)
  )} ${units[unitIndex]}`;
}

export function saveMailAttachmentBlob(blob: Blob, fileName: string) {
  const safeName = fileName.trim().replaceAll('/', '_').replaceAll('\\', '_') || 'attachment';
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = safeName;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function mailAdminEvidenceExportFileName(
  kind: 'RETENTION' | 'DELIVERY_AUDIT',
  exportId: string
) {
  const safeId = exportId.trim().replaceAll(/[^a-zA-Z0-9_-]/gu, '_') || 'export';
  return kind === 'RETENTION'
    ? `mail-retention-evidence-${safeId}.json`
    : `mail-delivery-audit-${safeId}.json`;
}
