import { axiosInstance } from '../axios-instance';
import { mailProposalMutationHeaders } from './mail-proposal-binding';

import type { ApiResponse } from '../types';
import type {
  MailAccount,
  MailDraftSaveInput,
  MailRecipient,
  MailThreadDetail,
  MailThreadPage,
  MailTriageLane,
  MailWorkflowState,
} from './mail-api';
import type { MailProposalMutationBinding } from './mail-proposal-binding';

// Mail user completion contracts

export type MailAttachment = {
  attachmentId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  scanState: 'UPLOADING' | 'SCANNING' | 'READY' | 'BLOCKED' | 'FAILED';
};

export type MailComposeOptions = {
  accountId?: string | null;
  recipients: MailRecipient[];
  bodyFormat: 'TEXT' | 'HTML';
  attachmentIds: string[];
  scheduledAt?: string | null;
  timeZone?: string | null;
  templateId?: string | null;
  signatureId?: string | null;
};

export type MailComposeCapabilities = {
  multipleRecipients: boolean;
  cc: boolean;
  bcc: boolean;
  html: boolean;
  attachments: boolean;
  scheduling: boolean;
  maximumAttachmentBytes: number;
};

export type MailWritingAssetScope = 'PERSONAL' | 'ACCOUNT' | 'ORGANIZATION';

export type MailTemplateInput = {
  name: string;
  subject?: string | null;
  body: string;
  bodyFormat: 'TEXT' | 'HTML';
  scope: MailWritingAssetScope;
  accountId?: string | null;
};

export type MailTemplate = MailTemplateInput & {
  templateId: string;
  version: number;
  updatedAt?: string | null;
  editable?: boolean;
  mandatoryContent?: string | null;
  publicationState?: 'PRIVATE' | 'PUBLISHED' | 'RETIRED';
  publicationVersion?: number;
  active?: boolean;
};

export type MailSignatureInput = {
  name: string;
  body: string;
  bodyFormat: 'TEXT' | 'HTML';
  scope: MailWritingAssetScope;
  accountId?: string | null;
  defaultForNew: boolean;
  defaultForReply: boolean;
};

export type MailSignature = MailSignatureInput & {
  signatureId: string;
  version: number;
  updatedAt?: string | null;
  editable?: boolean;
  mandatoryContent?: string | null;
  publicationState?: 'PRIVATE' | 'PUBLISHED' | 'RETIRED';
  publicationVersion?: number;
  active?: boolean;
};

export type MailWritingAssets = {
  templates: MailTemplate[];
  signatures: MailSignature[];
};

export type MailPreferencesInput = {
  density: 'COMFORTABLE' | 'COMPACT';
  remoteImages: 'BLOCK' | 'ASK' | 'ALLOW';
  sendDelaySeconds: number;
  keyboardShortcuts: boolean;
  notifyNewMail: boolean;
  notifySharedAssignment: boolean;
  notifyFollowUpDue: boolean;
  defaultAccountId?: string | null;
  defaultSignatureId?: string | null;
  version: number;
};

export type MailPreferenceKey = Exclude<keyof MailPreferencesInput, 'version'>;

export type MailPreferences = MailPreferencesInput & {
  orgLocks?: Partial<Record<MailPreferenceKey, string>>;
};

export type MailComposeContext = {
  accounts: MailAccount[];
  capabilities: MailComposeCapabilities;
  accountCapabilities: Record<string, MailComposeCapabilities>;
  templates: MailTemplate[];
  signatures: MailSignature[];
  preferences: MailPreferences;
  variables: {
    displayName?: string | null;
    department?: string | null;
  };
};

export type MailSearchCriteria = {
  query?: string;
  accountId?: string;
  scope?: 'ALL' | 'PERSONAL' | 'SHARED';
  from?: string;
  to?: string;
  dateFrom?: string;
  dateTo?: string;
  unread?: boolean;
  needsReply?: boolean;
  hasAttachment?: boolean;
  folderId?: string;
  state?: MailWorkflowState;
  lane?: MailTriageLane;
};

export type MailSavedViewInput = {
  name: string;
  criteria: MailSearchCriteria;
};

export type MailSavedView = MailSavedViewInput & {
  savedViewId: string;
  version: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MailFollowUpInput = {
  expectedReplyAt: string;
  timeZone: string;
  note?: string | null;
};

export type MailFollowUp = MailFollowUpInput & {
  followUpId: string;
  threadId: string;
  subject: string;
  participantName?: string | null;
  participantEmail?: string | null;
  status: 'WAITING' | 'OVERDUE' | 'REPLIED' | 'CANCELLED';
  lastCheckedAt?: string | null;
  version: number;
};

export type MailDeliveryBucket = 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'ATTENTION';
export type MailUserDeliveryState =
  | 'SCHEDULED'
  | 'QUEUED'
  | 'SENDING'
  | 'ACCEPTED'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type MailDeliverySummary = {
  deliveryId: string;
  accountName: string;
  subject: string;
  recipientSummary: string;
  kind: 'PERSONAL' | 'GROUP';
  state: MailUserDeliveryState;
  requestedAt: string;
  scheduledAt?: string | null;
  version: number;
};

export type MailDeliveryPage = {
  items: MailDeliverySummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type MailDeliveryReceipt = MailDeliverySummary & {
  recipients: MailRecipient[];
  timeline: Array<{
    state: MailUserDeliveryState;
    occurredAt: string;
    description?: string | null;
  }>;
  lastCheckedAt?: string | null;
  evidence?: Array<Record<string, unknown>>;
  retryEligibility?: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
  canReschedule: boolean;
  canCancel: boolean;
  canReconcile: boolean;
};

export type MailAdvancedThreadDetail = MailThreadDetail & {
  draftOptions?: MailComposeOptions;
  draftAttachments?: MailAttachment[];
};

export type MailAdvancedDraftSaveInput = MailDraftSaveInput & {
  composeOptions?: MailComposeOptions;
};

const MAIL_USER_BASE = '/api/platform/v1/mail';

function mailSearchParameters(criteria: MailSearchCriteria & { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(criteria)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  search.set('page', String(criteria.page ?? 0));
  search.set('pageSize', String(criteria.pageSize ?? 30));
  return search;
}

export async function getMailComposeContext(): Promise<MailComposeContext> {
  const response = await axiosInstance.get<ApiResponse<MailComposeContext>>(
    `${MAIL_USER_BASE}/compose-context`
  );
  return response.data.data;
}

export async function uploadMailAttachment(file: File): Promise<MailAttachment> {
  const form = new FormData();
  form.set('file', file);
  const response = await axiosInstance.post<ApiResponse<MailAttachment>, FormData>(
    `${MAIL_USER_BASE}/attachments`,
    form
  );
  return response.data.data;
}

export async function deleteMailAttachment(attachmentId: string): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    `${MAIL_USER_BASE}/attachments/${encodeURIComponent(attachmentId)}`
  );
}

export async function downloadMailMessageAttachment(
  threadId: string,
  messageId: string,
  attachmentId: string
): Promise<Blob> {
  const response = await axiosInstance.get<Blob>(
    `${MAIL_USER_BASE}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { responseType: 'blob' }
  );
  return response.data;
}

export async function searchMailThreads(
  input: MailSearchCriteria & { page?: number; pageSize?: number }
): Promise<MailThreadPage> {
  const search = mailSearchParameters(input);
  const response = await axiosInstance.get<ApiResponse<MailThreadPage>>(
    `${MAIL_USER_BASE}/threads?${search.toString()}`
  );
  return response.data.data;
}

export async function getMailSavedViews(): Promise<MailSavedView[]> {
  const response = await axiosInstance.get<ApiResponse<MailSavedView[]>>(
    `${MAIL_USER_BASE}/saved-views`
  );
  return response.data.data;
}

export async function createMailSavedView(input: MailSavedViewInput): Promise<MailSavedView> {
  const response = await axiosInstance.post<ApiResponse<MailSavedView>, MailSavedViewInput>(
    `${MAIL_USER_BASE}/saved-views`,
    input
  );
  return response.data.data;
}

export async function updateMailSavedView(
  savedViewId: string,
  input: MailSavedViewInput,
  version: number
): Promise<MailSavedView> {
  const payload = { ...input, version };
  const response = await axiosInstance.put<ApiResponse<MailSavedView>, typeof payload>(
    `${MAIL_USER_BASE}/saved-views/${encodeURIComponent(savedViewId)}`,
    payload
  );
  return response.data.data;
}

export async function deleteMailSavedView(savedViewId: string, version: number): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    `${MAIL_USER_BASE}/saved-views/${encodeURIComponent(savedViewId)}?version=${encodeURIComponent(String(version))}`
  );
}

export async function getMailFollowUps(input: {
  status?: MailFollowUp['status'];
}): Promise<MailFollowUp[]> {
  const search = new URLSearchParams();
  if (input.status) search.set('status', input.status);
  const suffix = search.size ? `?${search.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<MailFollowUp[]>>(
    `${MAIL_USER_BASE}/follow-ups${suffix}`
  );
  return response.data.data;
}

export async function createMailFollowUp(
  threadId: string,
  input: MailFollowUpInput
): Promise<MailFollowUp> {
  const response = await axiosInstance.post<ApiResponse<MailFollowUp>, MailFollowUpInput>(
    `${MAIL_USER_BASE}/threads/${encodeURIComponent(threadId)}/follow-up`,
    input
  );
  return response.data.data;
}

export async function updateMailFollowUp(
  followUpId: string,
  input: MailFollowUpInput,
  version: number
): Promise<MailFollowUp> {
  const payload = { ...input, version };
  const response = await axiosInstance.put<ApiResponse<MailFollowUp>, typeof payload>(
    `${MAIL_USER_BASE}/follow-ups/${encodeURIComponent(followUpId)}`,
    payload
  );
  return response.data.data;
}

export async function deleteMailFollowUp(followUpId: string, version: number): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    `${MAIL_USER_BASE}/follow-ups/${encodeURIComponent(followUpId)}?version=${encodeURIComponent(String(version))}`
  );
}

export async function getMailDeliveries(input: {
  bucket: MailDeliveryBucket;
  page?: number;
  pageSize?: number;
}): Promise<MailDeliveryPage> {
  const search = new URLSearchParams({
    bucket: input.bucket,
    page: String(input.page ?? 0),
    pageSize: String(input.pageSize ?? 30),
  });
  const response = await axiosInstance.get<ApiResponse<MailDeliveryPage>>(
    `${MAIL_USER_BASE}/deliveries?${search.toString()}`
  );
  return response.data.data;
}

export async function getMailDeliveryReceipt(deliveryId: string): Promise<MailDeliveryReceipt> {
  const response = await axiosInstance.get<ApiResponse<MailDeliveryReceipt>>(
    `${MAIL_USER_BASE}/deliveries/${encodeURIComponent(deliveryId)}`
  );
  return response.data.data;
}

export async function rescheduleMailDelivery(
  deliveryId: string,
  input: { scheduledAt: string; timeZone: string; version: number }
): Promise<MailDeliveryReceipt> {
  const response = await axiosInstance.post<ApiResponse<MailDeliveryReceipt>, typeof input>(
    `${MAIL_USER_BASE}/deliveries/${encodeURIComponent(deliveryId)}/reschedule`,
    input
  );
  return response.data.data;
}

export async function cancelMailDelivery(
  deliveryId: string,
  input: { version: number }
): Promise<MailDeliveryReceipt> {
  const response = await axiosInstance.post<ApiResponse<MailDeliveryReceipt>, typeof input>(
    `${MAIL_USER_BASE}/deliveries/${encodeURIComponent(deliveryId)}/cancel`,
    input
  );
  return response.data.data;
}

export async function reconcileMailDelivery(
  deliveryId: string,
  input: { version: number }
): Promise<MailDeliveryReceipt> {
  const response = await axiosInstance.post<ApiResponse<MailDeliveryReceipt>, typeof input>(
    `${MAIL_USER_BASE}/deliveries/${encodeURIComponent(deliveryId)}/reconcile`,
    input
  );
  return response.data.data;
}

export async function retryMailDeliveryReceipt(
  deliveryId: string,
  input: { version: number }
): Promise<MailDeliveryReceipt> {
  const response = await axiosInstance.post<ApiResponse<MailDeliveryReceipt>, typeof input>(
    `${MAIL_USER_BASE}/deliveries/${encodeURIComponent(deliveryId)}/retry`,
    input
  );
  return response.data.data;
}

export async function getMailWritingAssets(
  input: { includeArchived?: boolean } = {}
): Promise<MailWritingAssets> {
  const search = input.includeArchived ? '?includeArchived=true' : '';
  const response = await axiosInstance.get<ApiResponse<MailWritingAssets>>(
    `${MAIL_USER_BASE}/writing-assets${search}`
  );
  return response.data.data;
}

export async function createMailTemplate(input: MailTemplateInput): Promise<MailTemplate> {
  const response = await axiosInstance.post<ApiResponse<MailTemplate>, MailTemplateInput>(
    `${MAIL_USER_BASE}/templates`,
    input
  );
  return response.data.data;
}

export async function updateMailTemplate(
  templateId: string,
  input: MailTemplateInput,
  version: number
): Promise<MailTemplate> {
  const payload = { ...input, version };
  const response = await axiosInstance.put<ApiResponse<MailTemplate>, typeof payload>(
    `${MAIL_USER_BASE}/templates/${encodeURIComponent(templateId)}`,
    payload
  );
  return response.data.data;
}

export async function archiveMailTemplate(templateId: string, version: number): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    `${MAIL_USER_BASE}/templates/${encodeURIComponent(templateId)}?version=${encodeURIComponent(String(version))}`
  );
}

export async function createMailSignature(input: MailSignatureInput): Promise<MailSignature> {
  const response = await axiosInstance.post<ApiResponse<MailSignature>, MailSignatureInput>(
    `${MAIL_USER_BASE}/signatures`,
    input
  );
  return response.data.data;
}

export async function updateMailSignature(
  signatureId: string,
  input: MailSignatureInput,
  version: number
): Promise<MailSignature> {
  const payload = { ...input, version };
  const response = await axiosInstance.put<ApiResponse<MailSignature>, typeof payload>(
    `${MAIL_USER_BASE}/signatures/${encodeURIComponent(signatureId)}`,
    payload
  );
  return response.data.data;
}

export async function archiveMailSignature(signatureId: string, version: number): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    `${MAIL_USER_BASE}/signatures/${encodeURIComponent(signatureId)}?version=${encodeURIComponent(String(version))}`
  );
}

export async function getMailPreferences(): Promise<MailPreferences> {
  const response = await axiosInstance.get<ApiResponse<MailPreferences>>(
    `${MAIL_USER_BASE}/preferences`
  );
  return response.data.data;
}

export async function updateMailPreferences(input: MailPreferencesInput): Promise<MailPreferences> {
  const response = await axiosInstance.put<ApiResponse<MailPreferences>, MailPreferencesInput>(
    `${MAIL_USER_BASE}/preferences`,
    input
  );
  return response.data.data;
}

export async function createAdvancedMailDraft(
  input: MailAdvancedDraftSaveInput
): Promise<MailAdvancedThreadDetail> {
  const response = await axiosInstance.post<
    ApiResponse<MailAdvancedThreadDetail>,
    MailAdvancedDraftSaveInput
  >(`${MAIL_USER_BASE}/drafts`, input);
  return response.data.data;
}

export async function saveAdvancedMailDraft(
  threadId: string,
  input: MailAdvancedDraftSaveInput & { version: number }
): Promise<MailAdvancedThreadDetail> {
  const response = await axiosInstance.put<
    ApiResponse<MailAdvancedThreadDetail>,
    MailAdvancedDraftSaveInput & { version: number }
  >(`${MAIL_USER_BASE}/drafts/${encodeURIComponent(threadId)}`, input);
  return response.data.data;
}

export async function updateAdvancedMailDraft(
  threadId: string,
  input: {
    toEmail: string;
    toName?: string | null;
    subject: string;
    body: string;
    deliveryMode: 'SEND' | 'DRAFT';
    idempotencyKey: string;
    version: number;
    composeOptions?: MailComposeOptions;
  },
  proposalBinding?: MailProposalMutationBinding
): Promise<MailAdvancedThreadDetail> {
  const response = await axiosInstance.put<ApiResponse<MailAdvancedThreadDetail>, typeof input>(
    `${MAIL_USER_BASE}/threads/${encodeURIComponent(threadId)}/draft`,
    input,
    { headers: mailProposalMutationHeaders(proposalBinding) }
  );
  return response.data.data;
}
