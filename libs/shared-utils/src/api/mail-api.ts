import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MailProviderType =
  'DWP_SANDBOX' | 'MICROSOFT_GRAPH' | 'GOOGLE_GMAIL' | 'NAVER_WORKS' | 'JMAP' | 'IMAP_SMTP';
export type MailConnectionState =
  'ACTIVE' | 'CONFIGURATION_REQUIRED' | 'SYNCING' | 'DEGRADED' | 'SUSPENDED';
export type MailTriageLane = 'PRIORITY' | 'NEEDS_REPLY' | 'ASSIGNED' | 'UPDATES' | 'NEWSLETTERS';
export type MailWorkflowState = 'OPEN' | 'DONE' | 'SNOOZED' | 'ARCHIVED' | 'DRAFT';
export type MailImportance = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type MailClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type MailThreadAction =
  'MARK_READ' | 'MARK_UNREAD' | 'STAR' | 'UNSTAR' | 'ARCHIVE' | 'RESTORE' | 'COMPLETE' | 'REOPEN';
export type MailProposalType =
  | 'DRAFT_REPLY'
  | 'CREATE_CALENDAR_EVENT'
  | 'CREATE_LEAVE_REQUEST'
  | 'CREATE_TASK'
  | 'ESCALATE_NOTIFICATION';
export type MailProposalStatus = 'PROPOSED' | 'ACCEPTED' | 'DISMISSED' | 'EXPIRED' | 'EXECUTED';
export type MailDeliveryState =
  'RECEIVED' | 'DRAFT' | 'QUEUED' | 'SENDING' | 'RETRYING' | 'SENT' | 'FAILED';

export type MailAccount = {
  accountId: string;
  emailAddress: string;
  displayName: string;
  accountKind: 'PERSONAL' | 'SHARED';
  providerType: MailProviderType;
  connectionState: string;
  synchronizationState: string;
  defaultAccount: boolean;
};

export type MailParticipant = { name: string; email: string };

export type MailThread = {
  threadId: string;
  accountId: string;
  accountName: string;
  folderType: 'INBOX' | 'SENT' | 'DRAFTS' | 'ARCHIVE' | 'SPAM' | 'TRASH' | 'CUSTOM';
  sharedInboxId?: string | null;
  sharedInboxName?: string | null;
  subject: string;
  preview: string;
  participants: MailParticipant[];
  latestMessageAt: string;
  unread: boolean;
  starred: boolean;
  importance: MailImportance;
  triageLane: MailTriageLane;
  workflowState: MailWorkflowState;
  snoozedUntil?: string | null;
  assignedUserId?: number | null;
  assignedName?: string | null;
  attachments: boolean;
  externalSender: boolean;
  classification: MailClassification;
  messageCount: number;
  version: number;
};

export type MailMessage = {
  messageId: string;
  senderEmail: string;
  senderName: string;
  recipients: Array<Record<string, unknown>>;
  direction: 'INBOUND' | 'OUTBOUND' | 'DRAFT';
  bodyFormat: 'TEXT' | 'HTML';
  body: string;
  attachments: Array<Record<string, unknown>>;
  sentAt: string;
  deliveryState: MailDeliveryState;
  acceptedAt?: string | null;
  lastDeliveryError?: string | null;
};

export type MailInternalComment = {
  commentId: string;
  authorUserId: number;
  authorName: string;
  body: string;
  mentionedUserIds: number[];
  createdAt: string;
};

export type MailActionProposal = {
  proposalId: string;
  threadId: string;
  type: MailProposalType;
  actionContractVersion: number;
  status: MailProposalStatus;
  title: string;
  summary: string;
  evidence: Array<Record<string, unknown>>;
  proposedPayload: Record<string, unknown>;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredResourceKey?: string | null;
  requiredPermissionCode?: string | null;
  targetRoute?: string | null;
  expiresAt?: string | null;
  version: number;
};

export type MailThreadDetail = {
  thread: MailThread;
  messages: MailMessage[];
  internalComments: MailInternalComment[];
  proposals: MailActionProposal[];
  sharedInboxMembers: MailSharedInboxMember[];
};

export type MailSharedInboxMember = {
  userId: number;
  displayName: string;
  emailAddress: string;
  memberRole: 'MEMBER' | 'MANAGER';
};

export type MailSharedInboxPulse = {
  sharedInboxId: string;
  name: string;
  address: string;
  openCount: number;
  unassignedCount: number;
  overdueCount: number;
  serviceTargetMinutes: number;
};

export type MailHome = {
  accounts: MailAccount[];
  metrics: {
    unread: number;
    urgent: number;
    needsReply: number;
    assigned: number;
    snoozed: number;
    activeProposals: number;
  };
  focusQueue: MailThread[];
  proposals: MailActionProposal[];
  sharedInboxes: MailSharedInboxPulse[];
  generatedAt: string;
};

export type MailThreadPage = {
  items: MailThread[];
  total: number;
  page: number;
  pageSize: number;
};

export type MailTenantPolicy = {
  externalSenderBanner: boolean;
  blockRemoteImages: boolean;
  allowSharedInboxes: boolean;
  aiAssistanceEnabled: boolean;
  aiCrossAppActionsEnabled: boolean;
  aiAutoExecuteEnabled: boolean;
  retentionDays: number;
  maximumAttachmentMb: number;
  version: number;
};

export type MailConnection = {
  connectionId: string;
  connectionKey: string;
  displayName: string;
  providerType: MailProviderType;
  authenticationMode: string;
  mailDomain?: string | null;
  state: MailConnectionState;
  capabilities: string[];
  credentialConfigured: boolean;
  lastSynchronizedAt?: string | null;
  lastErrorCode?: string | null;
  version: number;
};

export type MailSharedInbox = {
  sharedInboxId: string;
  inboxKey: string;
  displayName: string;
  address: string;
  purpose?: string | null;
  serviceTargetMinutes: number;
  lifecycleState: 'ACTIVE' | 'ARCHIVED';
  openCount: number;
  overdueCount: number;
  version: number;
};

export type MailProviderDescriptor = {
  providerType: MailProviderType;
  name: string;
  protocol: string;
  authenticationMode: string;
  capabilities: string[];
  pushSupported: boolean;
  tenantWideSupported: boolean;
  runtimeState: 'AVAILABLE' | 'DEPLOYMENT_REQUIRED';
  adapterVersion?: string | null;
};

export type MailAdminOverview = {
  personalAccounts: number;
  sharedAccounts: number;
  activeConnections: number;
  degradedConnections: number;
  openSharedThreads: number;
  pendingAiProposals: number;
  queuedDeliveries: number;
  failedDeliveries: number;
  policy: MailTenantPolicy;
  connections: MailConnection[];
  sharedInboxes: MailSharedInbox[];
  providerCatalog: MailProviderDescriptor[];
  generatedAt: string;
};

export async function getMailHome(): Promise<MailHome> {
  const response = await axiosInstance.get<ApiResponse<MailHome>>('/api/platform/v1/mail/home');
  return response.data.data;
}

export async function getMailThreads(input: {
  lane?: MailTriageLane;
  state?: MailWorkflowState;
  folder?: MailThread['folderType'];
  sharedOnly?: boolean;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<MailThreadPage> {
  const search = new URLSearchParams();
  if (input.lane) search.set('lane', input.lane);
  if (input.state) search.set('state', input.state);
  if (input.folder) search.set('folder', input.folder);
  if (input.sharedOnly) search.set('sharedOnly', 'true');
  if (input.query) search.set('query', input.query);
  search.set('page', String(input.page ?? 0));
  search.set('pageSize', String(input.pageSize ?? 30));
  const response = await axiosInstance.get<ApiResponse<MailThreadPage>>(
    `/api/platform/v1/mail/threads?${search.toString()}`
  );
  return response.data.data;
}

export async function getMailThread(threadId: string): Promise<MailThreadDetail> {
  const response = await axiosInstance.get<ApiResponse<MailThreadDetail>>(
    `/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}`
  );
  return response.data.data;
}

export async function applyMailThreadAction(
  threadId: string,
  action: MailThreadAction,
  version: number
): Promise<MailThreadDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MailThreadDetail>,
    { action: MailThreadAction; version: number }
  >(`/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}/actions`, {
    action,
    version,
  });
  return response.data.data;
}

export async function snoozeMailThread(
  threadId: string,
  until: string,
  version: number
): Promise<MailThreadDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MailThreadDetail>,
    { until: string; version: number }
  >(`/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}/snooze`, {
    until,
    version,
  });
  return response.data.data;
}

export async function assignMailThread(
  threadId: string,
  assignedUserId: number,
  assignedName: string,
  version: number
): Promise<MailThreadDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MailThreadDetail>,
    { assignedUserId: number; assignedName: string; version: number }
  >(`/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}/assignment`, {
    assignedUserId,
    assignedName,
    version,
  });
  return response.data.data;
}

export async function addMailComment(
  threadId: string,
  body: string,
  mentionedUserIds: number[] = []
): Promise<MailThreadDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MailThreadDetail>,
    { body: string; mentionedUserIds: number[] }
  >(`/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}/comments`, {
    body,
    mentionedUserIds,
  });
  return response.data.data;
}

export async function replyToMailThread(
  threadId: string,
  body: string,
  idempotencyKey: string
): Promise<MailThreadDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MailThreadDetail>,
    { body: string; idempotencyKey: string }
  >(`/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}/replies`, {
    body,
    idempotencyKey,
  });
  return response.data.data;
}

export async function retryMailDelivery(
  threadId: string,
  messageId: string
): Promise<MailThreadDetail> {
  const response = await axiosInstance.post<ApiResponse<MailThreadDetail>>(
    `/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/retry`,
    {}
  );
  return response.data.data;
}

export async function composeMail(input: {
  toEmail: string;
  toName?: string | null;
  subject: string;
  body: string;
  deliveryMode: 'SEND' | 'DRAFT';
  idempotencyKey: string;
}): Promise<MailThreadDetail> {
  const response = await axiosInstance.post<ApiResponse<MailThreadDetail>, typeof input>(
    '/api/platform/v1/mail/messages',
    input
  );
  return response.data.data;
}

export async function updateMailDraft(
  threadId: string,
  input: {
    toEmail: string;
    toName?: string | null;
    subject: string;
    body: string;
    deliveryMode: 'SEND' | 'DRAFT';
    idempotencyKey: string;
    version: number;
  }
): Promise<MailThreadDetail> {
  const response = await axiosInstance.put<ApiResponse<MailThreadDetail>, typeof input>(
    `/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}/draft`,
    input
  );
  return response.data.data;
}

export async function decideMailProposal(
  proposalId: string,
  decision: 'ACCEPT' | 'DISMISS',
  version: number
): Promise<MailActionProposal> {
  const response = await axiosInstance.post<
    ApiResponse<MailActionProposal>,
    { decision: 'ACCEPT' | 'DISMISS'; version: number }
  >(`/api/platform/v1/mail/proposals/${encodeURIComponent(proposalId)}/decision`, {
    decision,
    version,
  });
  return response.data.data;
}

export async function getMailAdminOverview(): Promise<MailAdminOverview> {
  const response = await axiosInstance.get<ApiResponse<MailAdminOverview>>(
    '/api/platform/v1/admin/mail/overview'
  );
  return response.data.data;
}

export async function updateMailPolicy(
  input: Omit<MailTenantPolicy, 'aiAutoExecuteEnabled'>
): Promise<MailTenantPolicy> {
  const response = await axiosInstance.put<
    ApiResponse<MailTenantPolicy>,
    Omit<MailTenantPolicy, 'aiAutoExecuteEnabled'>
  >('/api/platform/v1/admin/mail/policy', input);
  return response.data.data;
}

export async function updateMailConnection(
  connectionId: string,
  input: {
    displayName: string;
    mailDomain?: string | null;
    credentialRef?: string | null;
    state: MailConnectionState;
    version: number;
  }
): Promise<MailConnection> {
  const response = await axiosInstance.put<ApiResponse<MailConnection>, typeof input>(
    `/api/platform/v1/admin/mail/connections/${encodeURIComponent(connectionId)}`,
    input
  );
  return response.data.data;
}

export async function updateMailSharedInbox(
  sharedInboxId: string,
  input: {
    displayName: string;
    purpose?: string | null;
    serviceTargetMinutes: number;
    lifecycleState: MailSharedInbox['lifecycleState'];
    version: number;
  }
): Promise<MailSharedInbox> {
  const response = await axiosInstance.put<ApiResponse<MailSharedInbox>, typeof input>(
    `/api/platform/v1/admin/mail/shared-inboxes/${encodeURIComponent(sharedInboxId)}`,
    input
  );
  return response.data.data;
}
