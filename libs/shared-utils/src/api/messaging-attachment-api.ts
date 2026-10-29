import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MessagingAttachmentStatus =
  'QUARANTINED' | 'SCANNING' | 'CLEAN' | 'REJECTED' | 'EXPIRED';

export type MessagingAttachment = {
  attachmentId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: MessagingAttachmentStatus;
  rejectionReason?: string | null;
  createdAt: string;
  version: number;
};

export type MessagingAttachmentUploadSession = {
  attachment: MessagingAttachment;
  uploadUrl?: string | null;
  expiresAt: string;
};

export type MessagingAttachmentDownload = {
  attachmentId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  expiresAt: string;
};

export async function createMessagingAttachmentUpload(input: {
  conversationId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  idempotencyKey: string;
}): Promise<MessagingAttachmentUploadSession> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingAttachmentUploadSession>,
    Omit<typeof input, 'conversationId'>
  >(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/attachments/uploads`,
    {
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      idempotencyKey: input.idempotencyKey,
    }
  );
  return response.data.data;
}

export async function uploadMessagingAttachmentContent(
  uploadUrl: string,
  content: Blob
): Promise<MessagingAttachment> {
  if (!uploadUrl.startsWith('/api/messaging/')) {
    throw new Error('Messaging attachment uploads must use the governed messaging API path.');
  }
  const response = await axiosInstance.put<ApiResponse<MessagingAttachment>, Blob>(
    uploadUrl,
    content,
    { headers: { 'Content-Type': 'application/octet-stream' } }
  );
  return response.data.data;
}

export async function createMessagingAttachmentDownload(
  conversationId: string,
  attachmentId: string
): Promise<MessagingAttachmentDownload> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingAttachmentDownload>,
    Record<string, never>
  >(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachmentId)}/download-grants`,
    {}
  );
  return response.data.data;
}

export async function discardMessagingAttachment(
  conversationId: string,
  attachmentId: string
): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachmentId)}`
  );
}

export async function downloadMessagingAttachmentContent(downloadUrl: string): Promise<Blob> {
  if (!downloadUrl.startsWith('/api/messaging/')) {
    throw new Error('Messaging attachment downloads must use the governed messaging API path.');
  }
  const response = await axiosInstance.get<Blob>(downloadUrl, { responseType: 'blob' });
  return response.data;
}
