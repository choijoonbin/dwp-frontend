import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MessagingSharedAsset = {
  id: string;
  kind: 'FILE' | 'LINK';
  conversationId: string;
  conversationName: string;
  messageId: string;
  sharedAt: string;
  senderName: string;
  title: string;
  attachmentId: string | null;
  url: string | null;
  contentType: string | null;
  sizeBytes: number | null;
};

export type MessagingSharedAssetsResponse = {
  generatedAt: string;
  items: MessagingSharedAsset[];
};

export async function getMessagingSharedAssets(limit = 6): Promise<MessagingSharedAssetsResponse> {
  const response = await axiosInstance.get<ApiResponse<MessagingSharedAssetsResponse>>(
    `/api/messaging/v1/home/shared-assets?${new URLSearchParams({ limit: String(limit) })}`
  );
  return response.data.data;
}
