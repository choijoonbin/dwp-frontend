import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MessagingActivityKind =
  'MENTION' | 'THREAD_REPLY' | 'REACTION' | 'SYSTEM' | 'SCHEDULE_FAILED';

export type MessagingActivityItem = {
  id: string;
  kind: MessagingActivityKind;
  conversationId: string;
  conversationName: string;
  conversationType: string;
  messageId: string | null;
  rootMessageId: string | null;
  actorName: string;
  preview: string | null;
  protectedContent: boolean;
  occurredAt: string;
};

export type MessagingActivityResponse = {
  generatedAt: string;
  items: MessagingActivityItem[];
};

export type MessagingThreadItem = {
  rootMessageId: string;
  conversationId: string;
  conversationName: string;
  conversationType: string;
  rootSenderName: string;
  rootPreview: string | null;
  rootDeleted: boolean;
  protectedContent: boolean;
  replyCount: number;
  latestReplyMessageId: string;
  latestReplySenderName: string;
  latestReplyAt: string;
};

export type MessagingThreadListResponse = {
  generatedAt: string;
  items: MessagingThreadItem[];
};

export async function getMessagingActivity(limit = 50): Promise<MessagingActivityResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  const response = await axiosInstance.get<ApiResponse<MessagingActivityResponse>>(
    `/api/messaging/v1/activity?${search.toString()}`
  );
  return response.data.data;
}

export async function getMessagingThreads(limit = 50): Promise<MessagingThreadListResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  const response = await axiosInstance.get<ApiResponse<MessagingThreadListResponse>>(
    `/api/messaging/v1/threads?${search.toString()}`
  );
  return response.data.data;
}
