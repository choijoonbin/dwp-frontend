import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MessagingPrivacyPreference = {
  readReceiptsEnabled: boolean;
  version: number;
};

export type MessagingReceiptRecipient = {
  userId: number;
  personPublicId?: string | null;
  displayName: string;
  status: 'READ' | 'UNREAD' | 'UNAVAILABLE';
};

export type MessagingReadReceipt = {
  messageId: string;
  recipients: MessagingReceiptRecipient[];
  readCount: number;
  unreadCount: number;
  unavailableCount: number;
};

export async function getMessagingPrivacyPreference(): Promise<MessagingPrivacyPreference> {
  const response = await axiosInstance.get<ApiResponse<MessagingPrivacyPreference>>(
    '/api/messaging/v1/privacy-preferences'
  );
  return response.data.data;
}

export async function updateMessagingPrivacyPreference(
  input: MessagingPrivacyPreference
): Promise<MessagingPrivacyPreference> {
  const response = await axiosInstance.put<ApiResponse<MessagingPrivacyPreference>>(
    '/api/messaging/v1/privacy-preferences',
    input
  );
  return response.data.data;
}

export async function getMessagingReadReceipts(
  conversationId: string,
  messageIds: string[]
): Promise<MessagingReadReceipt[]> {
  const response = await axiosInstance.get<ApiResponse<MessagingReadReceipt[]>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/read-receipts?${new URLSearchParams({ messageIds: messageIds.join(',') })}`
  );
  return response.data.data;
}

export async function getMessagingMessageReadReceipt(
  conversationId: string,
  messageId: string
): Promise<MessagingReadReceipt> {
  const response = await axiosInstance.get<ApiResponse<MessagingReadReceipt>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/receipts`
  );
  return response.data.data;
}

export async function recordMessagingReadReceipts(conversationId: string, messageIds: string[]) {
  await axiosInstance.post(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/read-receipts`,
    { messageIds }
  );
}
