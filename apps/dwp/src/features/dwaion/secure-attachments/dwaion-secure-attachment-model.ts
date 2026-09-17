import type { DwaionSecureAttachment } from '@dwp-frontend/shared-utils';

export const DWAION_ATTACHMENT_MAX_COUNT = 6;
export const DWAION_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;
export const DWAION_ATTACHMENT_ACCEPT = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type DwaionAttachmentSelectionError =
  'COUNT_EXCEEDED' | 'EMPTY_FILE' | 'SIZE_EXCEEDED' | 'TYPE_BLOCKED';

export function validateDwaionAttachmentSelection(
  existingCount: number,
  files: readonly File[]
): DwaionAttachmentSelectionError | null {
  if (existingCount + files.length > DWAION_ATTACHMENT_MAX_COUNT) return 'COUNT_EXCEEDED';
  if (files.some((file) => file.size <= 0)) return 'EMPTY_FILE';
  if (files.some((file) => file.size > DWAION_ATTACHMENT_MAX_BYTES)) return 'SIZE_EXCEEDED';
  if (files.some((file) => !(DWAION_ATTACHMENT_ACCEPT as readonly string[]).includes(file.type)))
    return 'TYPE_BLOCKED';
  return null;
}

export function dwaionAttachmentNeedsPolling(attachment: DwaionSecureAttachment): boolean {
  return ['UPLOADING', 'SCANNING', 'PARTIAL', 'DELETION_PENDING'].includes(attachment.state);
}

export function dwaionAttachmentCanUse(attachment: DwaionSecureAttachment): boolean {
  return attachment.state === 'READY';
}

export function dwaionAttachmentSelectionCanSubmit(
  attachments: readonly DwaionSecureAttachment[],
  uploadPending: boolean
): boolean {
  return !uploadPending && attachments.every(dwaionAttachmentCanUse);
}

export function formatDwaionAttachmentBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
