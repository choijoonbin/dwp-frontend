import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MailProviderType =
  'DWP_SANDBOX' | 'MICROSOFT_GRAPH' | 'GOOGLE_GMAIL' | 'NAVER_WORKS' | 'JMAP' | 'IMAP_SMTP';
export type MailConnectionState =
  'ACTIVE' | 'CONFIGURATION_REQUIRED' | 'SYNCING' | 'DEGRADED' | 'SUSPENDED';
export type MailTriageLane = 'PRIORITY' | 'NEEDS_REPLY' | 'ASSIGNED' | 'UPDATES' | 'NEWSLETTERS';
export type MailWorkflowState =
  'OPEN' | 'DONE' | 'SNOOZED' | 'ARCHIVED' | 'DRAFT' | 'TRASHED' | 'SPAM';
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

export type MailFolderColor = 'NEUTRAL' | 'BLUE' | 'TEAL' | 'GREEN' | 'AMBER' | 'CORAL' | 'VIOLET';
export type MailProviderSyncState = 'LOCAL_ONLY' | 'PENDING' | 'SYNCED' | 'ERROR';
export type MailRuleMatchMode = 'ALL' | 'ANY';
export type MailRuleField =
  'SENDER' | 'RECIPIENT' | 'SUBJECT' | 'BODY' | 'HAS_ATTACHMENT' | 'IMPORTANCE';
export type MailRuleOperator = 'CONTAINS' | 'EQUALS' | 'STARTS_WITH' | 'ENDS_WITH' | 'IS';
export type MailRuleActionType = 'MOVE_TO_FOLDER' | 'MARK_READ' | 'STAR' | 'SET_IMPORTANCE';
export type MailLifecycleAction =
  'MOVE' | 'ARCHIVE' | 'TRASH' | 'SPAM' | 'RESTORE' | 'DELETE_FOREVER';

export type MailFolder = {
  folderId: string;
  accountId: string;
  parentFolderId?: string | null;
  folderKey: string;
  displayName: string;
  folderType: MailThread['folderType'];
  color: MailFolderColor;
  synchronizationState: MailProviderSyncState;
  sortOrder: number;
  totalCount: number;
  unreadCount: number;
  version: number;
};

export type MailRuleCondition = {
  field: MailRuleField;
  operator: MailRuleOperator;
  value: string;
};

export type MailRuleAction = {
  type: MailRuleActionType;
  folderId?: string | null;
  importance?: MailImportance | null;
};

export type MailRule = {
  ruleId: string;
  accountId: string;
  displayName: string;
  priority: number;
  matchMode: MailRuleMatchMode;
  conditions: MailRuleCondition[];
  actions: MailRuleAction[];
  stopProcessing: boolean;
  enabled: boolean;
  synchronizationState: MailProviderSyncState;
  lastRunAt?: string | null;
  lastMatchCount: number;
  version: number;
};

export type MailRuleRun = {
  runId: string;
  ruleId: string;
  triggerKind: 'MANUAL' | 'INCOMING' | 'BACKFILL';
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  scannedCount: number;
  matchedCount: number;
  changedCount: number;
  startedAt: string;
  completedAt?: string | null;
};

export type MailRuleBackfillPreview = {
  accountId: string;
  previewFingerprint: string;
  enabledRuleCount: number;
  scannedCount: number;
  matchedThreadCount: number;
  plannedApplicationCount: number;
  truncated: boolean;
  generatedAt: string;
};

export type MailRuleBackfillResult = {
  executionId: string;
  requestId: string;
  accountId: string;
  status: 'SUCCEEDED';
  replayed: boolean;
  scannedCount: number;
  matchedThreadCount: number;
  applicationCount: number;
  changedCount: number;
  startedAt: string;
  completedAt: string;
};

export type MailOrganization = {
  accounts: MailAccount[];
  folders: MailFolder[];
  rules: MailRule[];
  recentRuns: MailRuleRun[];
  generatedAt: string;
};

export type MailFolderInput = {
  accountId: string;
  parentFolderId?: string | null;
  displayName: string;
  color: MailFolderColor;
};

export type MailRuleInput = {
  accountId: string;
  displayName: string;
  priority: number;
  matchMode: MailRuleMatchMode;
  conditions: MailRuleCondition[];
  actions: MailRuleAction[];
  stopProcessing: boolean;
  enabled: boolean;
};

export async function getMailHome(): Promise<MailHome> {
  const response = await axiosInstance.get<ApiResponse<MailHome>>('/api/platform/v1/mail/home');
  return response.data.data;
}

export async function getMailThreads(input: {
  lane?: MailTriageLane;
  state?: MailWorkflowState;
  folder?: MailThread['folderType'];
  folderId?: string;
  sharedOnly?: boolean;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<MailThreadPage> {
  const search = new URLSearchParams();
  if (input.lane) search.set('lane', input.lane);
  if (input.state) search.set('state', input.state);
  if (input.folder) search.set('folder', input.folder);
  if (input.folderId) search.set('folderId', input.folderId);
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

export async function getMailOrganization(): Promise<MailOrganization> {
  const response = await axiosInstance.get<ApiResponse<MailOrganization>>(
    '/api/platform/v1/mail/organization'
  );
  return response.data.data;
}

export async function createMailFolder(input: MailFolderInput): Promise<MailFolder> {
  const response = await axiosInstance.post<ApiResponse<MailFolder>, MailFolderInput>(
    '/api/platform/v1/mail/organization/folders',
    input
  );
  return response.data.data;
}

export async function updateMailFolder(
  folderId: string,
  input: Omit<MailFolderInput, 'accountId'> & { version: number }
): Promise<MailFolder> {
  const response = await axiosInstance.put<ApiResponse<MailFolder>, typeof input>(
    `/api/platform/v1/mail/organization/folders/${encodeURIComponent(folderId)}`,
    input
  );
  return response.data.data;
}

export async function archiveMailFolder(folderId: string, version: number): Promise<void> {
  await axiosInstance.post<ApiResponse<null>, { version: number }>(
    `/api/platform/v1/mail/organization/folders/${encodeURIComponent(folderId)}/archive`,
    { version }
  );
}

export async function createMailRule(input: MailRuleInput): Promise<MailRule> {
  const response = await axiosInstance.post<ApiResponse<MailRule>, MailRuleInput>(
    '/api/platform/v1/mail/organization/rules',
    input
  );
  return response.data.data;
}

export async function updateMailRule(
  ruleId: string,
  input: Omit<MailRuleInput, 'accountId'> & { version: number }
): Promise<MailRule> {
  const response = await axiosInstance.put<ApiResponse<MailRule>, typeof input>(
    `/api/platform/v1/mail/organization/rules/${encodeURIComponent(ruleId)}`,
    input
  );
  return response.data.data;
}

export async function archiveMailRule(ruleId: string, version: number): Promise<void> {
  await axiosInstance.post<ApiResponse<null>, { version: number }>(
    `/api/platform/v1/mail/organization/rules/${encodeURIComponent(ruleId)}/archive`,
    { version }
  );
}

export async function runMailRule(ruleId: string): Promise<MailRuleRun> {
  const response = await axiosInstance.post<ApiResponse<MailRuleRun>>(
    `/api/platform/v1/mail/organization/rules/${encodeURIComponent(ruleId)}/run`,
    {}
  );
  return response.data.data;
}

export async function getMailRuleBackfillPreview(
  accountId: string
): Promise<MailRuleBackfillPreview> {
  const response = await axiosInstance.get<ApiResponse<MailRuleBackfillPreview>>(
    `/api/platform/v1/mail/organization/accounts/${encodeURIComponent(accountId)}/rules/backfill-preview`
  );
  return response.data.data;
}

export async function runMailRuleBackfill(
  accountId: string,
  input: { requestId: string; previewFingerprint: string }
): Promise<MailRuleBackfillResult> {
  const response = await axiosInstance.post<ApiResponse<MailRuleBackfillResult>, typeof input>(
    `/api/platform/v1/mail/organization/accounts/${encodeURIComponent(accountId)}/rules/backfill`,
    input
  );
  return response.data.data;
}

export async function applyMailLifecycle(
  threadId: string,
  action: MailLifecycleAction,
  version: number,
  targetFolderId?: string | null
): Promise<{ thread?: MailThread | null; deleted: boolean }> {
  const response = await axiosInstance.post<
    ApiResponse<{ thread?: MailThread | null; deleted: boolean }>,
    { action: MailLifecycleAction; version: number; targetFolderId?: string | null }
  >(`/api/platform/v1/mail/threads/${encodeURIComponent(threadId)}/lifecycle`, {
    action,
    version,
    targetFolderId,
  });
  return response.data.data;
}
