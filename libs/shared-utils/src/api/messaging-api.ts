import { axiosInstance, getEventStream } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { MessagingAttachment } from './messaging-attachment-api';

export * from './messaging-privacy-api';
export * from './messaging-home-api';
export * from './messaging-continuity-api';
export * from './messaging-attachment-api';

export type MessagingConversationType =
  'DIRECT' | 'GROUP' | 'CHANNEL' | 'ANNOUNCEMENT' | 'INCIDENT' | 'MEETING';
export type MessagingVisibility = 'PRIVATE' | 'SPACE' | 'TENANT_DISCOVERABLE' | 'ANNOUNCEMENT';
export type MessagingClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type MessagingMemberRole = 'VIEWER' | 'MEMBER' | 'MODERATOR' | 'OWNER';
export type MessagingMembershipSource = 'DIRECT' | 'SPACE_MIRRORED' | 'SPACE_SCOPED' | 'SYSTEM';

export type MessagingPerson = {
  userId: number;
  personPublicId?: string | null;
  emailAddress: string;
  displayName: string;
  jobTitle?: string | null;
  organizationName?: string | null;
  presenceState: 'AVAILABLE' | 'BUSY' | 'AWAY' | 'FOCUS' | 'OFFLINE' | 'UNKNOWN';
};

export type MessagingPeoplePresenceFilter = 'ALL' | 'AVAILABLE' | 'OFFLINE' | 'UNKNOWN';

export type MessagingPeoplePage = {
  items: MessagingPerson[];
  /** Exact durable-directory matches before the ephemeral presence filter is applied. */
  total: number;
  hasMore: boolean;
  nextCursor?: string | null;
  /** Offset fallback for older clients; cursor-capable clients should use nextCursor. */
  nextOffset?: number | null;
  presence: {
    authority: 'LIVE' | 'UNAVAILABLE';
    evaluatedAt: string;
    leaseTtlSeconds: number;
    refreshAfterSeconds: number;
  };
};

export type MessagingReaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type MessagingMention = {
  userId: number;
  displayName: string;
  mentionKind: 'USER' | 'ALL';
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
  sequence?: number;
  version: number;
  reactions: MessagingReaction[];
  attachments: MessagingAttachment[];
  mentions?: MessagingMention[];
  replyCount?: number;
  rootPreview?: MessagingThreadRootPreview | null;
};

export type MessagingThreadRootPreview = {
  messageId: string;
  senderName: string;
  body: string;
  deletedAt?: string | null;
  createdAt: string;
};

export type MessagingMember = MessagingPerson & {
  memberRole: MessagingMemberRole;
  membershipSource: MessagingMembershipSource;
  notificationLevel: 'DEFAULT' | 'ALL' | 'MENTIONS' | 'MUTE';
  favorite: boolean;
  pinned: boolean;
  lastReadMessageId?: string | null;
  lastReadSequence?: number;
  lastReadAt?: string | null;
  readReceiptVisibility?: 'SHARED' | 'PRIVATE';
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

export type MessagingRealtimeSignal = {
  kind: string;
  conversationId?: string;
  messageId?: string;
  userId?: number;
  started?: boolean;
  occurredAt?: string;
  changedAt?: string;
  expiresAt?: string;
  version?: number;
};

export const MESSAGING_API_CAPABILITIES = {
  threadReplies: true,
  reactions: true,
  readCursor: true,
  messageSave: true,
  messageEdit: true,
  messageDelete: true,
  conversationPreferences: true,
  remoteTyping: true,
  attachments: true,
  displayPreferences: true,
  serverDrafts: true,
  scheduledMessages: true,
} as const;

export type MessagingConversationDetail = {
  conversation: MessagingConversation;
  members: MessagingMember[];
  messages: MessagingMessage[];
  realtime: MessagingRealtimeStatus;
};

export type MessagingHome = {
  generatedAt: string;
  presence?: {
    authority: 'LIVE' | 'UNAVAILABLE';
    evaluatedAt: string;
    leaseTtlSeconds: number;
    refreshAfterSeconds: number;
  };
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
  hasMore?: boolean;
  nextCursor?: string | null;
  nextPage?: number | null;
};

export type MessagingMessagePage = {
  items: MessagingMessage[];
  hasMore: boolean;
  nextBeforeSequence?: number | null;
};

export type MessagingConversationCreation = {
  conversation: {
    conversationId: string;
    type: 'GROUP' | 'CHANNEL';
    name: string;
    topic?: string | null;
    visibility: MessagingVisibility;
    lifecycleState: 'ACTIVE' | 'ARCHIVED';
    createdAt: string;
    members: Array<{
      userId: number;
      personPublicId?: string | null;
      displayName: string;
      emailAddress: string;
      role: 'MEMBER' | 'MODERATOR' | 'OWNER';
    }>;
  };
  idempotentReplay: boolean;
};

export type MessagingManagedMember = {
  userId: number;
  personPublicId?: string | null;
  displayName: string;
  emailAddress: string;
  jobTitle?: string | null;
  organizationName?: string | null;
  role: MessagingMemberRole;
  membershipSource: MessagingMembershipSource;
  historyStartSequence: number;
  membershipStartedAt: string;
  version: number;
};

export type MessagingConversationMembers = {
  conversationId: string;
  conversationType: MessagingConversationType;
  conversationVersion: number;
  members: MessagingManagedMember[];
};

export type MessagingMembershipMutation = {
  membership: MessagingConversationMembers;
  idempotentReplay: boolean;
};

export type MessagingSearchResponse = {
  backend: 'SQL_FALLBACK' | 'OPENSEARCH';
  query: string;
  limit: number;
  total: number;
  results: {
    conversations: Array<{
      resultType: 'CONVERSATION';
      conversationId: string;
      conversationType: MessagingConversationType;
      name: string;
      snippet?: string | null;
    }>;
    messages: Array<{
      resultType: 'MESSAGE';
      messageId: string;
      conversationId: string;
      conversationName?: string | null;
      senderName: string;
      snippet: string;
      createdAt: string;
    }>;
    people: Array<{
      resultType: 'PERSON';
      userId: number;
      personPublicId?: string | null;
      displayName: string;
      emailAddress: string;
      jobTitle?: string | null;
      organizationName?: string | null;
      presenceState: MessagingPerson['presenceState'];
    }>;
  };
};

export type MessagingThreadResponse = {
  root: MessagingMessage;
  replies: MessagingMessage[];
  total: number;
};

export type MessagingReadCursor = {
  conversationId: string;
  lastReadMessageId: string;
  lastReadSequence: number;
  lastReadAt: string;
  version: number;
};

export type MessagingSavedItem = {
  message: MessagingMessage;
  conversationName?: string | null;
  conversationType: MessagingConversationType;
  savedAt: string;
  /** Added by the protected-preview contract; absent only on a rolling-deploy legacy response. */
  protectedContent?: boolean;
};

export type MessagingSavedItemPage = {
  items: MessagingSavedItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type MessagingConversationSettings = {
  conversationId: string;
  notificationLevel: 'DEFAULT' | 'ALL' | 'MENTIONS' | 'MUTE';
  favorite: boolean;
  pinned: boolean;
  version: number;
};

export type MessagingDisplayLayout = 'AUTO' | 'CONVERSATIONAL' | 'COLLABORATIVE';
export type MessagingDisplayDensity = 'COMFORTABLE' | 'COMPACT';
export type MessagingDisplayTheme = 'DEFAULT' | 'MIST' | 'SAGE' | 'ROSE';
export type MessagingTimestampMode = 'SMART' | 'ALWAYS';
export type MessagingConversationDisplayLayout = 'INHERIT' | MessagingDisplayLayout;
export type MessagingConversationDisplayDensity = 'INHERIT' | MessagingDisplayDensity;
export type MessagingConversationDisplayTheme = 'INHERIT' | MessagingDisplayTheme;

export type MessagingAppearancePolicy = {
  allowedThemes: MessagingDisplayTheme[];
  allowPersonalBackgrounds: boolean;
  allowThemeSharing: boolean;
  version: number;
};

export type MessagingDisplayPreference = {
  layoutMode: MessagingDisplayLayout;
  density: MessagingDisplayDensity;
  theme: MessagingDisplayTheme;
  showAvatars: boolean;
  timestampMode: MessagingTimestampMode;
  messagePreview: boolean;
  version: number;
  policy: MessagingAppearancePolicy;
};

export type MessagingConversationDisplayPreference = {
  conversationId: string;
  layoutMode: MessagingConversationDisplayLayout;
  density: MessagingConversationDisplayDensity;
  theme: MessagingConversationDisplayTheme;
  effectiveLayoutMode: Exclude<MessagingDisplayLayout, 'AUTO'>;
  effectiveDensity: MessagingDisplayDensity;
  effectiveTheme: MessagingDisplayTheme;
  showAvatars: boolean;
  timestampMode: MessagingTimestampMode;
  messagePreview: boolean;
  policyLocked: boolean;
  policyReason?: 'RESTRICTED_CONVERSATION' | 'STRUCTURED_CONVERSATION' | null;
  version: number;
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
  runtimeReadiness?: {
    evaluatedAt: string;
    overallState: 'READY' | 'DEGRADED' | 'BLOCKED' | 'UNAVAILABLE' | 'DISABLED';
    capabilities: Array<{
      capability: string;
      provider: string;
      required: boolean;
      configured: boolean;
      effective: boolean;
      state: 'READY' | 'DEGRADED' | 'BLOCKED' | 'UNAVAILABLE' | 'DISABLED';
      reasonCode: string | null;
      lastVerifiedAt: string | null;
      freshness: 'CURRENT' | 'STALE' | 'NEVER';
      pendingWorkCount: number | null;
    }>;
  };
};

export async function getMessagingHome(): Promise<MessagingHome> {
  const response = await axiosInstance.get<ApiResponse<MessagingHome>>('/api/messaging/v1/home');
  return response.data.data;
}

export async function getMessagingConversations(input: {
  scope?: 'ALL' | 'FAVORITES' | 'SPACES' | 'DIRECT' | 'CHANNELS' | 'MENTIONS';
  query?: string;
  page?: number;
  pageSize?: number;
  cursor?: string;
}): Promise<MessagingConversationPage> {
  const search = new URLSearchParams();
  search.set('scope', input.scope ?? 'ALL');
  if (input.query) search.set('q', input.query);
  search.set('page', String(input.page ?? 0));
  search.set('pageSize', String(input.pageSize ?? 30));
  if (input.cursor) search.set('cursor', input.cursor);
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

export async function getMessagingMessages(input: {
  conversationId: string;
  beforeSequence?: number;
  limit?: number;
}): Promise<MessagingMessagePage> {
  const search = new URLSearchParams({ limit: String(input.limit ?? 50) });
  if (input.beforeSequence !== undefined) {
    search.set('beforeSequence', String(input.beforeSequence));
  }
  const response = await axiosInstance.get<ApiResponse<MessagingMessagePage>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/messages?${search.toString()}`
  );
  return response.data.data;
}

export async function getMessagingMessage(
  conversationId: string,
  messageId: string
): Promise<MessagingMessage> {
  const response = await axiosInstance.get<ApiResponse<MessagingMessage>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`
  );
  return response.data.data;
}

export async function createDirectMessagingConversation(
  targetUserId: number
): Promise<MessagingConversation> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingConversation>,
    { targetUserId: number }
  >('/api/messaging/v1/direct-conversations', { targetUserId });
  return response.data.data;
}

export async function createMessagingConversation(input: {
  name: string;
  topic?: string | null;
  type: 'GROUP' | 'CHANNEL';
  memberUserIds: number[];
  idempotencyKey: string;
}): Promise<MessagingConversationCreation> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingConversationCreation>,
    typeof input
  >('/api/messaging/v1/conversations', input);
  return response.data.data;
}

export async function searchMessaging(input: {
  query: string;
  types?: Array<'CONVERSATION' | 'MESSAGE' | 'PERSON'>;
  limit?: number;
}): Promise<MessagingSearchResponse> {
  const search = new URLSearchParams({
    q: input.query,
    limit: String(input.limit ?? 20),
  });
  if (input.types?.length) search.set('types', input.types.join(','));
  const response = await axiosInstance.get<ApiResponse<MessagingSearchResponse>>(
    `/api/messaging/v1/search?${search.toString()}`
  );
  return response.data.data;
}

export async function getMessagingConversationMembers(
  conversationId: string
): Promise<MessagingConversationMembers> {
  const response = await axiosInstance.get<ApiResponse<MessagingConversationMembers>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/members`
  );
  return response.data.data;
}

export async function addMessagingConversationMember(input: {
  conversationId: string;
  userId: number;
  role: MessagingMemberRole;
  conversationVersion: number;
}): Promise<MessagingMembershipMutation> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingMembershipMutation>,
    Omit<typeof input, 'conversationId'>
  >(`/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/members`, {
    userId: input.userId,
    role: input.role,
    conversationVersion: input.conversationVersion,
  });
  return response.data.data;
}

export async function updateMessagingConversationMemberRole(input: {
  conversationId: string;
  userId: number;
  role: MessagingMemberRole;
  version: number;
}): Promise<MessagingMembershipMutation> {
  const response = await axiosInstance.put<
    ApiResponse<MessagingMembershipMutation>,
    Pick<typeof input, 'role' | 'version'>
  >(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/members/${input.userId}/role`,
    { role: input.role, version: input.version }
  );
  return response.data.data;
}

export async function removeMessagingConversationMember(input: {
  conversationId: string;
  userId: number;
  version: number;
}): Promise<MessagingMembershipMutation> {
  const search = new URLSearchParams({ version: String(input.version) });
  const response = await axiosInstance.delete<ApiResponse<MessagingMembershipMutation>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/members/${input.userId}?${search.toString()}`
  );
  return response.data.data;
}

export async function leaveMessagingConversation(input: {
  conversationId: string;
  version: number;
}): Promise<MessagingMembershipMutation> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingMembershipMutation>,
    Pick<typeof input, 'version'>
  >(`/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/leave`, {
    version: input.version,
  });
  return response.data.data;
}

export async function sendMessagingMessage(input: {
  conversationId: string;
  body: string;
  replyToMessageId?: string | null;
  idempotencyKey: string;
  attachmentIds?: string[];
  mentionedUserIds?: number[];
}): Promise<MessagingMessage> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingMessage>,
    {
      body: string;
      replyToMessageId?: string | null;
      idempotencyKey: string;
      attachmentIds: string[];
      mentionedUserIds: number[];
    }
  >(`/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/messages`, {
    body: input.body,
    replyToMessageId: input.replyToMessageId,
    idempotencyKey: input.idempotencyKey,
    attachmentIds: input.attachmentIds ?? [],
    mentionedUserIds: input.mentionedUserIds ?? [],
  });
  return response.data.data;
}

export async function getMessagingThread(
  conversationId: string,
  rootMessageId: string,
  limit = 100
): Promise<MessagingThreadResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  const response = await axiosInstance.get<ApiResponse<MessagingThreadResponse>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(rootMessageId)}/replies?${search.toString()}`
  );
  return response.data.data;
}

export async function updateMessagingMessage(input: {
  conversationId: string;
  messageId: string;
  body: string;
  version: number;
}): Promise<MessagingMessage> {
  const response = await axiosInstance.put<
    ApiResponse<MessagingMessage>,
    { body: string; version: number }
  >(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/messages/${encodeURIComponent(input.messageId)}`,
    { body: input.body, version: input.version }
  );
  return response.data.data;
}

export async function deleteMessagingMessage(input: {
  conversationId: string;
  messageId: string;
  version: number;
}): Promise<MessagingMessage> {
  const search = new URLSearchParams({ version: String(input.version) });
  const response = await axiosInstance.delete<ApiResponse<MessagingMessage>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/messages/${encodeURIComponent(input.messageId)}?${search.toString()}`
  );
  return response.data.data;
}

export async function getMessagingSavedItems(
  input: {
    page?: number;
    pageSize?: number;
  } = {}
): Promise<MessagingSavedItemPage> {
  const search = new URLSearchParams({
    page: String(input.page ?? 0),
    pageSize: String(input.pageSize ?? 30),
  });
  const response = await axiosInstance.get<ApiResponse<MessagingSavedItemPage>>(
    `/api/messaging/v1/saved-items?${search.toString()}`
  );
  return response.data.data;
}

export async function saveMessagingMessage(
  conversationId: string,
  messageId: string
): Promise<MessagingSavedItem> {
  const response = await axiosInstance.post<ApiResponse<MessagingSavedItem>, Record<string, never>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/saved`,
    {}
  );
  return response.data.data;
}

export async function unsaveMessagingMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/saved`
  );
}

export async function getMessagingConversationSettings(
  conversationId: string
): Promise<MessagingConversationSettings> {
  const response = await axiosInstance.get<ApiResponse<MessagingConversationSettings>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/settings`
  );
  return response.data.data;
}

export async function updateMessagingConversationSettings(
  input: MessagingConversationSettings
): Promise<MessagingConversationSettings> {
  const response = await axiosInstance.put<
    ApiResponse<MessagingConversationSettings>,
    Omit<MessagingConversationSettings, 'conversationId'>
  >(`/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/settings`, {
    notificationLevel: input.notificationLevel,
    favorite: input.favorite,
    pinned: input.pinned,
    version: input.version,
  });
  return response.data.data;
}

export async function getMessagingDisplayPreference(): Promise<MessagingDisplayPreference> {
  const response = await axiosInstance.get<ApiResponse<MessagingDisplayPreference>>(
    '/api/messaging/v1/display-preferences'
  );
  return response.data.data;
}

export async function updateMessagingDisplayPreference(
  input: Omit<MessagingDisplayPreference, 'policy'>
): Promise<MessagingDisplayPreference> {
  const response = await axiosInstance.put<
    ApiResponse<MessagingDisplayPreference>,
    Omit<MessagingDisplayPreference, 'policy'>
  >('/api/messaging/v1/display-preferences', {
    layoutMode: input.layoutMode,
    density: input.density,
    theme: input.theme,
    showAvatars: input.showAvatars,
    timestampMode: input.timestampMode,
    messagePreview: input.messagePreview,
    version: input.version,
  });
  return response.data.data;
}

export async function getMessagingConversationDisplayPreference(
  conversationId: string
): Promise<MessagingConversationDisplayPreference> {
  const response = await axiosInstance.get<ApiResponse<MessagingConversationDisplayPreference>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/display-preference`
  );
  return response.data.data;
}

export async function updateMessagingConversationDisplayPreference(
  input: Pick<
    MessagingConversationDisplayPreference,
    'conversationId' | 'layoutMode' | 'density' | 'theme' | 'version'
  >
): Promise<MessagingConversationDisplayPreference> {
  const response = await axiosInstance.put<
    ApiResponse<MessagingConversationDisplayPreference>,
    Omit<typeof input, 'conversationId'>
  >(
    `/api/messaging/v1/conversations/${encodeURIComponent(input.conversationId)}/display-preference`,
    {
      layoutMode: input.layoutMode,
      density: input.density,
      theme: input.theme,
      version: input.version,
    }
  );
  return response.data.data;
}

export async function resetMessagingConversationDisplayPreference(
  conversationId: string,
  version: number
): Promise<MessagingConversationDisplayPreference> {
  const search = new URLSearchParams({ version: String(version) });
  const response = await axiosInstance.delete<ApiResponse<MessagingConversationDisplayPreference>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/display-preference?${search.toString()}`
  );
  return response.data.data;
}

export async function markMessagingConversationRead(
  conversationId: string,
  messageId: string
): Promise<MessagingReadCursor> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingReadCursor>,
    { messageId: string }
  >(`/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/read-cursor`, {
    messageId,
  });
  return response.data.data;
}

export async function setMessagingTyping(conversationId: string, started: boolean): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, { started: boolean }>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/typing`,
    { started }
  );
}

export const MESSAGING_PRESENCE_REQUEST_TIMEOUT_MS = 5_000;
export const MESSAGING_PRESENCE_RENEWAL_SAFETY_MARGIN_MS = 5_000;
export const MESSAGING_PRESENCE_DEFAULT_LEASE_TIMING = Object.freeze({
  leaseTtlSeconds: 75,
  refreshAfterSeconds: 20,
});
export const MESSAGING_PRESENCE_COMPATIBILITY_LEASE_TIMING = Object.freeze({
  leaseTtlSeconds: 30,
  refreshAfterSeconds: 5,
});

export type MessagingPresenceLeaseTiming = Readonly<{
  leaseTtlSeconds: number;
  refreshAfterSeconds: number;
}>;

const PRESENCE_LEASE_TTL_HEADER = 'X-DWP-Presence-Lease-TTL-Seconds';
const PRESENCE_REFRESH_AFTER_HEADER = 'X-DWP-Presence-Refresh-After-Seconds';
const PRESENCE_MINIMUM_TTL_SECONDS = 30;
const PRESENCE_MAXIMUM_TTL_SECONDS = 300;
const PRESENCE_MINIMUM_REFRESH_AFTER_SECONDS = 5;
const PRESENCE_RENEWAL_RESERVE_SECONDS =
  (MESSAGING_PRESENCE_REQUEST_TIMEOUT_MS * 2 + MESSAGING_PRESENCE_RENEWAL_SAFETY_MARGIN_MS) / 1_000;

function positiveWholeSeconds(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function messagingPresenceLeaseTiming(headers?: Headers): MessagingPresenceLeaseTiming {
  const leaseTtlSeconds = positiveWholeSeconds(headers?.get(PRESENCE_LEASE_TTL_HEADER) ?? null);
  const refreshAfterSeconds = positiveWholeSeconds(
    headers?.get(PRESENCE_REFRESH_AFTER_HEADER) ?? null
  );
  if (
    leaseTtlSeconds === null ||
    refreshAfterSeconds === null ||
    leaseTtlSeconds < PRESENCE_MINIMUM_TTL_SECONDS ||
    leaseTtlSeconds > PRESENCE_MAXIMUM_TTL_SECONDS ||
    refreshAfterSeconds < PRESENCE_MINIMUM_REFRESH_AFTER_SECONDS ||
    refreshAfterSeconds + PRESENCE_RENEWAL_RESERVE_SECONDS > leaseTtlSeconds
  ) {
    return MESSAGING_PRESENCE_COMPATIBILITY_LEASE_TIMING;
  }
  return { leaseTtlSeconds, refreshAfterSeconds };
}

export async function refreshMessagingPresence(): Promise<MessagingPresenceLeaseTiming> {
  const response = await axiosInstance.put<ApiResponse<void>, undefined>(
    '/api/messaging/v1/presence/heartbeat',
    undefined,
    { timeoutMs: MESSAGING_PRESENCE_REQUEST_TIMEOUT_MS }
  );
  return messagingPresenceLeaseTiming(response.headers);
}

export async function addMessagingReaction(
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<MessagingMessage> {
  const response = await axiosInstance.post<ApiResponse<MessagingMessage>, { emoji: string }>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions`,
    { emoji }
  );
  return response.data.data;
}

export async function removeMessagingReaction(
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<MessagingMessage> {
  const response = await axiosInstance.delete<ApiResponse<MessagingMessage>>(
    `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`
  );
  return response.data.data;
}

export function parseMessagingRealtimeSignal(
  event: string,
  data: unknown
): MessagingRealtimeSignal | null {
  const record =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;
  const kind =
    (typeof record?.type === 'string' && record.type) ||
    (typeof record?.kind === 'string' && record.kind) ||
    event;
  if (!kind || kind === 'message') return null;

  const conversationId =
    typeof record?.conversationId === 'string' ? record.conversationId : undefined;
  const messageId = typeof record?.messageId === 'string' ? record.messageId : undefined;
  const userId = typeof record?.userId === 'number' ? record.userId : undefined;
  const started = typeof record?.started === 'boolean' ? record.started : undefined;
  const occurredAt = typeof record?.occurredAt === 'string' ? record.occurredAt : undefined;
  const changedAt = typeof record?.changedAt === 'string' ? record.changedAt : undefined;
  const expiresAt = typeof record?.expiresAt === 'string' ? record.expiresAt : undefined;
  const version = typeof record?.version === 'number' ? record.version : undefined;

  return {
    kind,
    conversationId,
    messageId,
    userId,
    started,
    occurredAt,
    changedAt,
    expiresAt,
    version,
  };
}

export async function subscribeMessagingRealtime(input: {
  endpoint: string;
  signal: AbortSignal;
  after?: string | null;
  onSignal: (signal: MessagingRealtimeSignal) => void;
  onCursor?: (cursor: string) => void;
}): Promise<void> {
  if (!input.endpoint.startsWith('/api/messaging/')) {
    throw new Error('Messaging realtime endpoint must use the governed messaging API path.');
  }
  await getEventStream(messagingRealtimeResumeEndpoint(input.endpoint, input.after), {
    signal: input.signal,
    onMessage: ({ event, data, id }) => {
      const signal = parseMessagingRealtimeSignal(event, data);
      if (!signal) return;
      input.onSignal(signal);
      const cursor = normalizeMessagingRealtimeCursor(id);
      if (cursor) input.onCursor?.(cursor);
    },
  });
}

export function messagingRealtimeResumeEndpoint(endpoint: string, after?: string | null): string {
  if (!endpoint.startsWith('/api/messaging/')) {
    throw new Error('Messaging realtime endpoint must use the governed messaging API path.');
  }
  if (!after) return endpoint;
  const cursor = normalizeMessagingRealtimeCursor(after);
  if (!cursor) throw new Error('Messaging realtime cursor must be a non-negative 64-bit integer.');
  const url = new URL(endpoint, 'https://messaging.invalid');
  url.searchParams.set('after', cursor);
  return `${url.pathname}${url.search}`;
}

function normalizeMessagingRealtimeCursor(value?: string): string | null {
  if (!value || !/^(?:0|[1-9]\d{0,18})$/u.test(value)) return null;
  return value.length < 19 || value <= '9223372036854775807' ? value : null;
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

export async function getMessagingPeoplePage(input: {
  query?: string;
  organization?: string;
  jobTitle?: string;
  presence?: MessagingPeoplePresenceFilter;
  cursor?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<MessagingPeoplePage> {
  const search = new URLSearchParams();
  if (input.query) search.set('q', input.query);
  if (input.organization) search.set('organization', input.organization);
  if (input.jobTitle) search.set('jobTitle', input.jobTitle);
  if (input.presence && input.presence !== 'ALL') search.set('presence', input.presence);
  if (input.cursor) {
    search.set('cursor', input.cursor);
  } else if (input.offset !== undefined) {
    search.set('offset', String(Math.max(0, input.offset)));
  }
  search.set('limit', String(Math.min(50, Math.max(1, input.limit ?? 30))));
  const response = await axiosInstance.get<ApiResponse<MessagingPeoplePage>>(
    `/api/messaging/v1/people/page?${search.toString()}`,
    { signal: input.signal }
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
