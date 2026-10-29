import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MessagingLaterState = 'SAVED' | 'SNOOZED' | 'DUE' | 'COMPLETED';
export type MessagingLaterFilter = 'ALL' | MessagingLaterState;

export type MessagingLaterItem = {
  messageId: string;
  conversationId: string;
  conversationName: string;
  conversationType: string;
  senderName: string;
  preview: string | null;
  protectedContent: boolean;
  messageDeleted: boolean;
  savedAt: string;
  state: MessagingLaterState;
  reminderAt: string | null;
  snoozedUntil: string | null;
  completedAt: string | null;
  version: number;
};

export type MessagingLaterPage = {
  items: MessagingLaterItem[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
};

export async function getMessagingLaterItems(input: {
  state?: MessagingLaterFilter;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<MessagingLaterPage> {
  const search = new URLSearchParams({
    state: input.state ?? 'ALL',
    q: input.query ?? '',
    page: String(input.page ?? 0),
    pageSize: String(input.pageSize ?? 30),
  });
  const response = await axiosInstance.get<ApiResponse<MessagingLaterPage>>(
    `/api/messaging/v1/later?${search.toString()}`
  );
  return response.data.data;
}

export async function updateMessagingLaterItem(input: {
  messageId: string;
  state: Exclude<MessagingLaterState, 'DUE'>;
  reminderAt?: string | null;
  snoozedUntil?: string | null;
  version: number;
}): Promise<MessagingLaterItem> {
  const response = await axiosInstance.put<
    ApiResponse<MessagingLaterItem>,
    Omit<typeof input, 'messageId'>
  >(`/api/messaging/v1/later/${encodeURIComponent(input.messageId)}`, {
    state: input.state,
    reminderAt: input.reminderAt ?? null,
    snoozedUntil: input.snoozedUntil ?? null,
    version: input.version,
  });
  return response.data.data;
}
