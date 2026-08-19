import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MessagingConversationType =
  'DIRECT' | 'GROUP' | 'CHANNEL' | 'ANNOUNCEMENT' | 'INCIDENT' | 'MEETING';
export type MessagingVisibility = 'PRIVATE' | 'SPACE' | 'TENANT_DISCOVERABLE' | 'ANNOUNCEMENT';
export type MessagingClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type MessagingPerson = {
  userId: number;
  personPublicId?: string | null;
  emailAddress: string;
  displayName: string;
  jobTitle?: string | null;
  organizationName?: string | null;
  presenceState: 'AVAILABLE' | 'BUSY' | 'AWAY' | 'FOCUS' | 'OFFLINE' | 'UNKNOWN';
};

export type MessagingReaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type MessagingMessage = {
  messageId: string;
  conversationId: string;
  senderUserId: number;
  senderPersonPublicId?: string | null;
  senderName: string;
  body: string;
  contentType: 'TEXT' | 'MARKDOWN';
  messageKind: 'USER' | 'SYSTEM' | 'AI_PROPOSAL';
  replyToMessageId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  version: number;
  reactions: MessagingReaction[];
};

export type MessagingMember = MessagingPerson & {
  memberRole: 'VIEWER' | 'MEMBER' | 'MODERATOR' | 'OWNER';
  membershipSource: 'DIRECT' | 'SPACE_MIRRORED' | 'SPACE_SCOPED' | 'SYSTEM';
  notificationLevel: 'DEFAULT' | 'MENTIONS' | 'MUTE';
  favorite: boolean;
  pinned: boolean;
  lastReadAt?: string | null;
};

export type MessagingConversation = {
  conversationId: string;
  conversationKey: string;
  conversationType: MessagingConversationType;
  name?: string | null;
  topic?: string | null;
  visibility: MessagingVisibility;
  dataClassification: MessagingClassification;
  linkedSpaceKey?: string | null;
  linkedSpaceName?: string | null;
  lifecycleState: 'ACTIVE' | 'ARCHIVED';
  memberCount: number;
  unreadCount: number;
  favorite: boolean;
  pinned: boolean;
  lastMessage?: MessagingMessage | null;
  lastMessageAt?: string | null;
  version: number;
};

export type MessagingRealtimeStatus = {
  mode: string;
  endpoint: string;
  state: string;
  detail: string;
};

export type MessagingConversationDetail = {
  conversation: MessagingConversation;
  members: MessagingMember[];
  messages: MessagingMessage[];
  realtime: MessagingRealtimeStatus;
};

export type MessagingHome = {
  generatedAt: string;
  metrics: {
    unreadConversations: number;
    mentions: number;
    spaceChannels: number;
    directMessages: number;
    savedItems: number;
  };
  priority: MessagingConversation[];
  spaces: MessagingConversation[];
  people: MessagingPerson[];
};

export type MessagingConversationPage = {
  items: MessagingConversation[];
  total: number;
  page: number;
  pageSize: number;
};

export type MessagingPolicy = {
  directMessagesEnabled: boolean;
  spaceMessagingEnabled: boolean;
  allowMessageEdit: boolean;
  allowMessageDelete: boolean;
  aiAssistanceEnabled: boolean;
  aiAutoExecuteEnabled: boolean;
  retentionDays: number;
  maximumAttachmentMb: number;
  version: number;
};

export type MessagingAdminOverview = {
  generatedAt: string;
  metrics: {
    activeConversations: number;
    spaceLinkedConversations: number;
    activeMembers: number;
    retainedMessages: number;
    restrictedConversations: number;
  };
  policy: MessagingPolicy;
  governedConversations: MessagingConversation[];
};

export async function getMessagingHome(): Promise<MessagingHome> {
  const response = await axiosInstance.get<ApiResponse<MessagingHome>>('/api/messaging/v1/home');
  return response.data.data;
}

export async function getMessagingConversations(input: {
  scope?: 'ALL' | 'FAVORITES' | 'SPACES' | 'DIRECT' | 'CHANNELS';
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<MessagingConversationPage> {
  const search = new URLSearchParams();
  search.set('scope', input.scope ?? 'ALL');
  if (input.query) search.set('q', input.query);
  search.set('page', String(input.page ?? 0));
  search.set('pageSize', String(input.pageSize ?? 30));
  const response = await axiosInstance.get<ApiResponse<MessagingConversationPage>>(
    `/api/messaging/v1/conversations?${search.toString()}`
  );
  return response.data.data;
}

export async function getMessagingConversation(
  conversationId: string
): Promise<MessagingConversationDetail> {
  const response = await axiosInstance.get<ApiResponse<MessagingConversationDetail>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}`
  );
  return response.data.data;
}

export async function createDirectMessagingConversation(
  targetUserId: number
): Promise<MessagingConversationDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingConversationDetail>,
    { targetUserId: number }
  >('/api/messaging/v1/direct-conversations', { targetUserId });
  return response.data.data;
}

export async function sendMessagingMessage(input: {
  conversationId: string;
  body: string;
  replyToMessageId?: string | null;
  idempotencyKey: string;
}): Promise<MessagingConversationDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingConversationDetail>,
    { body: string; replyToMessageId?: string | null; idempotencyKey: string }
  >(`/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/messages`, {
    body: input.body,
    replyToMessageId: input.replyToMessageId,
    idempotencyKey: input.idempotencyKey,
  });
  return response.data.data;
}

export async function markMessagingConversationRead(
  conversationId: string,
  messageId: string
): Promise<MessagingConversationDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingConversationDetail>,
    { messageId: string }
  >(`/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/read-cursor`, {
    messageId,
  });
  return response.data.data;
}

export async function addMessagingReaction(
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<MessagingConversationDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingConversationDetail>,
    { emoji: string }
  >(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions`,
    { emoji }
  );
  return response.data.data;
}

export async function searchMessagingPeople(query: string): Promise<MessagingPerson[]> {
  const search = new URLSearchParams();
  if (query) search.set('q', query);
  search.set('limit', '20');
  const response = await axiosInstance.get<ApiResponse<MessagingPerson[]>>(
    `/api/messaging/v1/people?${search.toString()}`
  );
  return response.data.data;
}

export async function getMessagingAdminOverview(): Promise<MessagingAdminOverview> {
  const response = await axiosInstance.get<ApiResponse<MessagingAdminOverview>>(
    '/api/messaging/v1/admin/overview'
  );
  return response.data.data;
}

export async function updateMessagingPolicy(
  input: Omit<MessagingPolicy, 'aiAutoExecuteEnabled'>
): Promise<MessagingPolicy> {
  const response = await axiosInstance.put<
    ApiResponse<MessagingPolicy>,
    Omit<MessagingPolicy, 'aiAutoExecuteEnabled'>
  >('/api/messaging/v1/admin/policy', input);
  return response.data.data;
}
