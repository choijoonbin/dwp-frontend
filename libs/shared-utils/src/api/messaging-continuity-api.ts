import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MessagingDraft = {
  conversationId: string;
  threadRootMessageId?: string | null;
  body: string;
  mentionedPersonPublicIds: string[];
  /** Zero means that no durable draft exists yet. */
  version: number;
  updatedAt?: string | null;
};

export type MessagingScheduledMessageStatus =
  'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export type MessagingScheduledMessage = {
  scheduledMessageId: string;
  conversationId: string;
  body: string;
  replyToMessageId?: string | null;
  mentionedPersonPublicIds: string[];
  scheduledFor: string;
  displayTimeZone: string;
  status: MessagingScheduledMessageStatus;
  attemptCount: number;
  failureCode?: string | null;
  failureDetail?: string | null;
  deliveredMessageId?: string | null;
  deliveredAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Present only while the actor still has current access to the conversation. */
  conversationName?: string | null;
  payloadPurgedAt?: string | null;
};

export type MessagingScheduledMessagePage = {
  items: MessagingScheduledMessage[];
  limit: number;
  hasMore: boolean;
  nextCursor?: string | null;
};

function messagingDraftPath(conversationId: string, threadRootMessageId?: string | null) {
  const search = new URLSearchParams();
  if (threadRootMessageId) search.set('threadRootMessageId', threadRootMessageId);
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  return `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/draft${suffix}`;
}

export async function getMessagingDraft(input: {
  conversationId: string;
  threadRootMessageId?: string | null;
  signal?: AbortSignal;
}): Promise<MessagingDraft> {
  const response = await axiosInstance.get<ApiResponse<MessagingDraft>>(
    messagingDraftPath(input.conversationId, input.threadRootMessageId),
    { signal: input.signal }
  );
  return response.data.data;
}

export async function saveMessagingDraft(input: {
  conversationId: string;
  threadRootMessageId?: string | null;
  body: string;
  mentionedPersonPublicIds?: string[];
  expectedVersion: number;
}): Promise<MessagingDraft> {
  const response = await axiosInstance.put<
    ApiResponse<MessagingDraft>,
    { body: string; mentionedPersonPublicIds: string[]; expectedVersion: number }
  >(messagingDraftPath(input.conversationId, input.threadRootMessageId), {
    body: input.body,
    mentionedPersonPublicIds: input.mentionedPersonPublicIds ?? [],
    expectedVersion: input.expectedVersion,
  });
  return response.data.data;
}

export async function deleteMessagingDraft(input: {
  conversationId: string;
  threadRootMessageId?: string | null;
  version: number;
}): Promise<void> {
  const search = new URLSearchParams({ version: String(input.version) });
  if (input.threadRootMessageId) search.set('threadRootMessageId', input.threadRootMessageId);
  await axiosInstance.delete(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/draft?${search.toString()}`
  );
}

export async function scheduleMessagingMessage(input: {
  conversationId: string;
  body: string;
  replyToMessageId?: string | null;
  idempotencyKey: string;
  attachmentIds?: string[];
  mentionedPersonPublicIds?: string[];
  scheduledFor: string;
  displayTimeZone: string;
}): Promise<MessagingScheduledMessage> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingScheduledMessage>,
    Omit<typeof input, 'conversationId'>
  >(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/scheduled-messages`,
    {
      body: input.body,
      replyToMessageId: input.replyToMessageId,
      idempotencyKey: input.idempotencyKey,
      attachmentIds: input.attachmentIds ?? [],
      mentionedPersonPublicIds: input.mentionedPersonPublicIds ?? [],
      scheduledFor: input.scheduledFor,
      displayTimeZone: input.displayTimeZone,
    }
  );
  return response.data.data;
}

export async function getMessagingScheduledMessages(
  input: {
    status?: MessagingScheduledMessageStatus;
    cursor?: string;
    limit?: number;
  } = {}
): Promise<MessagingScheduledMessagePage> {
  const search = new URLSearchParams({ limit: String(input.limit ?? 50) });
  if (input.status) search.set('status', input.status);
  if (input.cursor) search.set('cursor', input.cursor);
  const response = await axiosInstance.get<ApiResponse<MessagingScheduledMessagePage>>(
    `/api/messaging/v1/scheduled-messages?${search.toString()}`
  );
  return response.data.data;
}

export async function cancelMessagingScheduledMessage(input: {
  scheduledMessageId: string;
  version: number;
}): Promise<MessagingScheduledMessage> {
  const response = await axiosInstance.delete<ApiResponse<MessagingScheduledMessage>>(
    `/api/messaging/v1/scheduled-messages/${encodeURIComponent(input.scheduledMessageId)}?version=${input.version}`
  );
  return response.data.data;
}
