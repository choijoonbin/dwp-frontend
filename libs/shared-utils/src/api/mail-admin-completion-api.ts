import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// Mail administration completion contracts

function mailAdminElevatedHeaders() {
  return { 'X-DWP-Active-Access-Mode': 'ELEVATED' };
}

export type MailAdminSourceEvidence = {
  sourceId: 'OVERVIEW' | 'COMMAND' | 'OUTBOX' | 'PROVIDER' | 'AUDIT' | 'EVENT';
  state: 'CURRENT' | 'STALE' | 'UNAVAILABLE' | 'PARTIAL';
  observedAt?: string | null;
  errorCode?: string | null;
};

export type MailAdminOperationalException = {
  exceptionId: string;
  kind: 'CONNECTION' | 'DELIVERY' | 'SYNC' | 'OBSERVABILITY';
  severity: 'CRITICAL' | 'WARNING';
  safeResourceRef: string;
  impactCount?: number | null;
  lastObservedAt: string;
  correlationId?: string | null;
  nextAction: 'OPEN_CONNECTION' | 'OPEN_DELIVERY' | 'REFRESH_SOURCE' | 'ESCALATE';
};

export type MailAdminCommandAudit = {
  auditId: string;
  commandType: string;
  safeResourceRef: string;
  actorName: string;
  result: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'BLOCKED';
  occurredAt: string;
  correlationId: string;
};

export type MailAdminOperationsSnapshot = {
  generatedAt: string;
  sources: MailAdminSourceEvidence[];
  exceptions: MailAdminOperationalException[];
  commands: MailAdminCommandAudit[];
};

export type MailConnectionOperation = {
  operationId: string;
  connectionId: string;
  kind: 'DIAGNOSTIC' | 'SYNCHRONIZE' | 'TEST_SEND';
  state: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  acceptedAt: string;
  completedAt?: string | null;
  correlationId: string;
  evidenceGeneratedAt?: string | null;
  errorCode?: string | null;
  replayed: boolean;
};

export type MailConnectionOperationInput = {
  capability?: 'AUTHENTICATION' | 'SYNC' | 'SEND';
  scope?: 'INCREMENTAL' | 'FULL';
  recipient?: string;
  confirmedExternalImpact?: boolean;
  idempotencyKey: string;
  version: number;
};

export type MailSharedInboxAccessPermissions = {
  read: boolean;
  sendAs: boolean;
  sendOnBehalf: boolean;
  assign: boolean;
  manage: boolean;
};

export type MailSharedInboxAccessMember = {
  memberId: string;
  userId: number;
  displayName: string;
  department?: string | null;
  state: 'ACTIVE' | 'PENDING' | 'REVOKED';
  expiresAt?: string | null;
  permissions: MailSharedInboxAccessPermissions;
  providerState: 'APPLIED' | 'PARTIAL' | 'PENDING' | 'UNAVAILABLE';
  version: number;
};

export type MailSharedInboxAccessImpact = {
  activeAssignments: number;
  openDrafts: number;
  pendingCommands: number;
  providerRevocationRequired: boolean;
};

export type MailSharedInboxAccess = {
  sharedInboxId: string;
  version: number;
  providerState: 'APPLIED' | 'PARTIAL' | 'PENDING' | 'UNAVAILABLE';
  members: MailSharedInboxAccessMember[];
  impact?: MailSharedInboxAccessImpact | null;
};

export type MailSharedInboxMemberCandidate = {
  userId: number;
  displayName: string;
  department?: string | null;
  email?: string | null;
};

export type MailSharedInboxMemberRevokePreview = MailSharedInboxAccessImpact & {
  previewId: string;
  fingerprint: string;
  memberVersion: number;
  generatedAt: string;
  expiresAt: string;
};

export type MailSharedInboxMemberMutationInput = {
  userId: number;
  displayName?: string;
  department?: string | null;
  permissions: MailSharedInboxAccessPermissions;
  expiresAt?: string | null;
  impactAcknowledged: boolean;
  idempotencyKey: string;
  version: number;
};

export type MailPolicyGovernance = {
  generatedAt: string;
  policyVersion: number;
  rows: Array<{
    policyKey: string;
    configuredValue: string;
    effectiveValue?: string | null;
    effectiveState: 'ENFORCED' | 'PARTIAL' | 'PENDING' | 'UNVERIFIED';
    scope: string;
    evidenceSource?: string | null;
    evidenceAt?: string | null;
    errorCode?: string | null;
  }>;
  history: Array<{
    historyId: string;
    version: number;
    changedBy: string;
    changedAt: string;
    diffSummary: string;
    result: 'APPLIED' | 'PARTIAL' | 'FAILED' | 'PENDING';
    correlationId: string;
  }>;
};

export type MailLegalHold = {
  holdId: string;
  name: string;
  safeCaseRef: string;
  scope: Record<string, unknown>;
  status: 'ACTIVE' | 'RELEASED' | 'EXPIRED';
  startsAt: string;
  expiresAt?: string | null;
  version: number;
};

export type MailLegalHoldMutationInput = {
  name: string;
  safeCaseRef: string;
  scope: Record<string, unknown>;
  startsAt: string;
  expiresAt?: string | null;
  idempotencyKey: string;
  version?: number;
};

export type MailPurgeJob = {
  jobId: string;
  candidateSnapshotId: string;
  state: 'ACCEPTED' | 'RUNNING' | 'PARTIAL' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  deletedThreads: number;
  deletedMessages: number;
  stepResults: Array<Record<string, unknown>>;
  verificationState: 'PENDING' | 'VERIFIED' | 'FAILED' | 'UNKNOWN';
  errorCode?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type MailRetentionSnapshot = {
  generatedAt: string;
  policyVersion: number;
  resourcePolicies: Array<{
    resourceType: string;
    configuredDays: number;
    effectiveDays?: number | null;
    source: string;
    evidenceState: 'VERIFIED' | 'REPORTED' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE';
  }>;
  holds: MailLegalHold[];
  purgeJobs: MailPurgeJob[];
};

export type MailPurgePreview = {
  candidateSnapshotId: string;
  fingerprint: string;
  totalCandidates: number;
  heldCount: number;
  eligibleCount: number;
  partialSources: string[];
  generatedAt: string;
  before: string;
  expiresAt: string;
  policyVersion: number;
  distinctApproverCount: number;
  resourceCounts: Record<'THREADS' | 'MESSAGES' | 'ATTACHMENTS' | 'DRAFTS', number>;
  heldResourceCounts: Record<'THREADS' | 'MESSAGES' | 'ATTACHMENTS' | 'DRAFTS', number>;
  exclusionReasonCounts: Record<'LEGAL_HOLD' | 'IMMUTABLE_EVIDENCE', number>;
  resourceTypes: Array<'THREADS' | 'MESSAGES' | 'ATTACHMENTS' | 'DRAFTS'>;
  scope: Record<string, unknown>;
};

export type MailPurgeApproval = {
  approvalId: string;
  candidateSnapshotId: string;
  distinctApproverCount: number;
  policyVersion: number;
  approvedAt: string;
};

export type MailLegalHoldReleaseImpactCounts = Record<
  'THREADS' | 'MESSAGES' | 'ATTACHMENTS' | 'DRAFTS',
  number
>;

export type MailLegalHoldReleasePreview = {
  releasePreviewId: string;
  holdId: string;
  requesterUserId: number;
  holdVersion: number;
  policyVersion: number;
  holdScope: Record<string, unknown>;
  retentionBoundary: string;
  fingerprint: string;
  impact: {
    affectedResourceCounts: MailLegalHoldReleaseImpactCounts;
    currentlyHeldResourceCounts: MailLegalHoldReleaseImpactCounts;
    purgeSafeAfterReleaseResourceCounts: MailLegalHoldReleaseImpactCounts;
    stillProtectedAfterReleaseResourceCounts: MailLegalHoldReleaseImpactCounts;
    providerCapabilityRequiredResourceCounts: MailLegalHoldReleaseImpactCounts;
  };
  state: 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'RELEASED';
  distinctApproverCount: number;
  approvals: MailLegalHoldReleaseApproval[];
  generatedAt: string;
  expiresAt: string;
};

export type MailLegalHoldReleaseApproval = {
  approvalId: string;
  releasePreviewId: string;
  approverUserId: number;
  decision: 'APPROVE' | 'REJECT';
  holdVersion: number;
  policyVersion: number;
  decidedAt: string;
};

export type MailLegalHoldReleaseExecution = {
  executionId: string;
  releasePreviewId: string;
  holdId: string;
  requesterUserId: number;
  approvedByUserId: number;
  executedByUserId: number;
  policyVersion: number;
  fingerprint: string;
  hold: MailLegalHold;
  executedAt: string;
  replayed: boolean;
};

export type MailDeliveryAuditItem = {
  deliveryId: string;
  safeResourceRef: string;
  commandType: string;
  actorName: string;
  accountName: string;
  providerType: string;
  stage:
    | 'RECEIVED'
    | 'OUTBOX'
    | 'PROVIDER_SUBMITTED'
    | 'ACCEPTED_BY_PROVIDER'
    | 'DELIVERED_CONFIRMED'
    | 'BOUNCED'
    | 'FAILED'
    | 'UNKNOWN'
    | 'CANCELLED'
    | 'BLOCKED_BY_ACCESS';
  state:
    'QUEUED' | 'ACCEPTED_BY_PROVIDER' | 'DELIVERED_CONFIRMED' | 'BOUNCED' | 'FAILED' | 'UNKNOWN';
  retryEligibility: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
  providerDisposition: 'NOT_ACCEPTED' | 'ACCEPTED' | 'UNKNOWN';
  idempotencyState: 'REPLAY_SAFE' | 'NOT_REPLAY_SAFE' | 'UNKNOWN';
  reconcileCapability: boolean;
  cancelCapability: boolean;
  lastEvidenceAt?: string | null;
  correlationId: string;
  timeline: Array<{
    stage: string;
    state: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'BLOCKED';
    at?: string | null;
    source: string;
    evidenceState: 'VERIFIED' | 'REPORTED' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE';
    code?: string | null;
  }>;
  version: number;
};

export type MailDeliveryAuditPage = {
  items: MailDeliveryAuditItem[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
};

export type MailEvidenceExportApproval = {
  approvalId: string;
  approverUserId: number;
  decision: 'APPROVED';
  decidedAt: string;
};

export type MailEvidenceExportApprovalState = 'PENDING_APPROVAL' | 'APPROVED';

export type MailEvidenceExportBase = {
  exportId: string;
  state: 'PENDING_APPROVAL' | 'ACCEPTED' | 'RUNNING' | 'READY' | 'FAILED';
  approvalState: MailEvidenceExportApprovalState;
  requiredApprovals: number;
  distinctApproverCount: number;
  approvals: MailEvidenceExportApproval[];
  expiresAt: string;
  watermark: string;
  payloadSha256: string;
  snapshotCutoff: string;
  downloadUrl: string | null;
};

export type MailDeliveryAuditExport = MailEvidenceExportBase & {
  filters: Record<string, unknown>;
  itemCount: number;
  truncated: boolean;
};

export type MailRetentionEvidenceExport = MailEvidenceExportBase & {
  policyVersion: number;
  scope: Record<string, unknown>;
};

export type MailOrganizationWritingAssetKind = 'TEMPLATE' | 'SIGNATURE';
export type MailOrganizationWritingAssetState =
  'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'RETIRED';

export type MailOrganizationWritingAsset = {
  assetId: string;
  kind: MailOrganizationWritingAssetKind;
  publicationKey: string;
  publicationVersion: number;
  publicationState: MailOrganizationWritingAssetState;
  supersedesId?: string | null;
  name: string;
  subject?: string | null;
  body: string;
  bodyFormat: 'TEXT' | 'HTML';
  mandatoryContent: string;
  defaultForNew: boolean;
  defaultForReply: boolean;
  createdBy: number;
  approvedBy?: number | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  retiredAt?: string | null;
  version: number;
  updatedAt: string;
};

export type MailOrganizationWritingAssetDraftInput = {
  name: string;
  subject?: string | null;
  body: string;
  bodyFormat: 'TEXT' | 'HTML';
  mandatoryContent: string;
  defaultForNew: boolean;
  defaultForReply: boolean;
  supersedesId?: string | null;
  version?: number | null;
};

export type MailOrganizationWritingAssetMutationOptions = {
  activeAccessMode: 'ELEVATED';
  idempotencyKey: string;
  correlationId?: string;
};

const MAIL_ORGANIZATION_ASSET_BASE = '/api/platform/v1/admin/mail/writing-assets';

function mailOrganizationAssetHeaders(options: MailOrganizationWritingAssetMutationOptions) {
  return {
    'X-DWP-Active-Access-Mode': options.activeAccessMode,
    'Idempotency-Key': options.idempotencyKey,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
  };
}

export async function getMailOrganizationWritingAssets(
  input: {
    kind?: MailOrganizationWritingAssetKind;
    state?: MailOrganizationWritingAssetState | '';
  } = {}
): Promise<MailOrganizationWritingAsset[]> {
  const search = new URLSearchParams();
  if (input.kind) search.set('kind', input.kind);
  if (input.state) search.set('state', input.state);
  const query = search.size ? `?${search.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<MailOrganizationWritingAsset[]>>(
    `${MAIL_ORGANIZATION_ASSET_BASE}${query}`
  );
  return response.data.data;
}

export async function createMailOrganizationWritingAssetDraft(
  kind: MailOrganizationWritingAssetKind,
  input: MailOrganizationWritingAssetDraftInput,
  options: MailOrganizationWritingAssetMutationOptions
): Promise<MailOrganizationWritingAsset> {
  const response = await axiosInstance.post<
    ApiResponse<MailOrganizationWritingAsset>,
    MailOrganizationWritingAssetDraftInput
  >(`${MAIL_ORGANIZATION_ASSET_BASE}/${kind}/drafts`, input, {
    headers: mailOrganizationAssetHeaders(options),
  });
  return response.data.data;
}

export async function updateMailOrganizationWritingAssetDraft(
  asset: Pick<MailOrganizationWritingAsset, 'assetId' | 'kind'>,
  input: MailOrganizationWritingAssetDraftInput,
  options: MailOrganizationWritingAssetMutationOptions
): Promise<MailOrganizationWritingAsset> {
  const response = await axiosInstance.put<
    ApiResponse<MailOrganizationWritingAsset>,
    MailOrganizationWritingAssetDraftInput
  >(
    `${MAIL_ORGANIZATION_ASSET_BASE}/${asset.kind}/drafts/${encodeURIComponent(asset.assetId)}`,
    input,
    { headers: mailOrganizationAssetHeaders(options) }
  );
  return response.data.data;
}

export async function transitionMailOrganizationWritingAsset(
  asset: Pick<MailOrganizationWritingAsset, 'assetId' | 'kind' | 'version'>,
  action: 'submit' | 'approve' | 'publish' | 'retire',
  options: MailOrganizationWritingAssetMutationOptions
): Promise<MailOrganizationWritingAsset> {
  const response = await axiosInstance.post<
    ApiResponse<MailOrganizationWritingAsset>,
    { version: number }
  >(
    `${MAIL_ORGANIZATION_ASSET_BASE}/${asset.kind}/${encodeURIComponent(asset.assetId)}/${action}`,
    { version: asset.version },
    { headers: mailOrganizationAssetHeaders(options) }
  );
  return response.data.data;
}

export async function getMailAdminOperations(): Promise<MailAdminOperationsSnapshot> {
  const response = await axiosInstance.get<ApiResponse<MailAdminOperationsSnapshot>>(
    '/api/platform/v1/admin/mail/operations'
  );
  return response.data.data;
}

async function runMailConnectionOperation(
  connectionId: string,
  operation: 'diagnostics' | 'sync' | 'test-send',
  input: MailConnectionOperationInput
): Promise<MailConnectionOperation> {
  const response = await axiosInstance.post<
    ApiResponse<MailConnectionOperation>,
    MailConnectionOperationInput
  >(
    `/api/platform/v1/admin/mail/connections/${encodeURIComponent(connectionId)}/${operation}`,
    input,
    operation === 'test-send' ? { headers: mailAdminElevatedHeaders() } : undefined
  );
  return response.data.data;
}

export function runMailConnectionDiagnostic(
  connectionId: string,
  input: MailConnectionOperationInput
) {
  return runMailConnectionOperation(connectionId, 'diagnostics', input);
}

export function startMailConnectionSync(connectionId: string, input: MailConnectionOperationInput) {
  return runMailConnectionOperation(connectionId, 'sync', input);
}

export function sendMailConnectionTest(connectionId: string, input: MailConnectionOperationInput) {
  return runMailConnectionOperation(connectionId, 'test-send', input);
}

export async function getMailSharedInboxAccess(
  sharedInboxId: string
): Promise<MailSharedInboxAccess> {
  const response = await axiosInstance.get<ApiResponse<MailSharedInboxAccess>>(
    `/api/platform/v1/admin/mail/shared-inboxes/${encodeURIComponent(sharedInboxId)}/members`
  );
  return response.data.data;
}

export async function getMailSharedInboxMemberCandidates(
  query: string,
  limit = 20,
  signal?: AbortSignal
): Promise<MailSharedInboxMemberCandidate[]> {
  const search = new URLSearchParams({ query: query.trim(), limit: String(limit) });
  const response = await axiosInstance.get<ApiResponse<MailSharedInboxMemberCandidate[]>>(
    `/api/platform/v1/admin/mail/shared-inboxes/member-candidates?${search.toString()}`,
    { signal }
  );
  return response.data.data;
}

export async function addMailSharedInboxMember(
  sharedInboxId: string,
  input: MailSharedInboxMemberMutationInput
): Promise<MailSharedInboxAccess> {
  const response = await axiosInstance.post<
    ApiResponse<MailSharedInboxAccess>,
    MailSharedInboxMemberMutationInput
  >(
    `/api/platform/v1/admin/mail/shared-inboxes/${encodeURIComponent(sharedInboxId)}/members`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function updateMailSharedInboxMember(
  sharedInboxId: string,
  memberId: string,
  input: MailSharedInboxMemberMutationInput
): Promise<MailSharedInboxAccess> {
  const response = await axiosInstance.put<
    ApiResponse<MailSharedInboxAccess>,
    MailSharedInboxMemberMutationInput
  >(
    `/api/platform/v1/admin/mail/shared-inboxes/${encodeURIComponent(sharedInboxId)}/members/${encodeURIComponent(memberId)}`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function removeMailSharedInboxMember(
  sharedInboxId: string,
  memberId: string,
  input: {
    previewId: string;
    fingerprint: string;
    impactAcknowledged: boolean;
    idempotencyKey: string;
    version: number;
  }
): Promise<MailSharedInboxAccess> {
  const response = await axiosInstance.post<ApiResponse<MailSharedInboxAccess>, typeof input>(
    `/api/platform/v1/admin/mail/shared-inboxes/${encodeURIComponent(sharedInboxId)}/members/${encodeURIComponent(memberId)}/revoke`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function previewMailSharedInboxMemberRevoke(
  sharedInboxId: string,
  memberId: string,
  memberVersion: number
): Promise<MailSharedInboxMemberRevokePreview> {
  const input = { memberVersion };
  const response = await axiosInstance.post<
    ApiResponse<MailSharedInboxMemberRevokePreview>,
    typeof input
  >(
    `/api/platform/v1/admin/mail/shared-inboxes/${encodeURIComponent(sharedInboxId)}/members/${encodeURIComponent(memberId)}/revoke-preview`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function getMailPolicyGovernance(): Promise<MailPolicyGovernance> {
  const response = await axiosInstance.get<ApiResponse<MailPolicyGovernance>>(
    '/api/platform/v1/admin/mail/policy/evidence'
  );
  return response.data.data;
}

export async function getMailRetention(): Promise<MailRetentionSnapshot> {
  const response = await axiosInstance.get<ApiResponse<MailRetentionSnapshot>>(
    '/api/platform/v1/admin/mail/retention'
  );
  return response.data.data;
}

export async function createMailLegalHold(
  input: MailLegalHoldMutationInput
): Promise<MailLegalHold> {
  const response = await axiosInstance.post<ApiResponse<MailLegalHold>, MailLegalHoldMutationInput>(
    '/api/platform/v1/admin/mail/retention/holds',
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function updateMailLegalHold(
  holdId: string,
  input: MailLegalHoldMutationInput
): Promise<MailLegalHold> {
  const response = await axiosInstance.put<ApiResponse<MailLegalHold>, MailLegalHoldMutationInput>(
    `/api/platform/v1/admin/mail/retention/holds/${encodeURIComponent(holdId)}`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function previewMailLegalHoldRelease(
  holdId: string,
  input: { idempotencyKey: string; holdVersion: number; policyVersion: number }
): Promise<MailLegalHoldReleasePreview> {
  const response = await axiosInstance.post<ApiResponse<MailLegalHoldReleasePreview>, typeof input>(
    `/api/platform/v1/admin/mail/retention/holds/${encodeURIComponent(holdId)}/release-previews`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function getMailLegalHoldReleasePreview(
  releasePreviewId: string
): Promise<MailLegalHoldReleasePreview> {
  const response = await axiosInstance.get<ApiResponse<MailLegalHoldReleasePreview>>(
    `/api/platform/v1/admin/mail/retention/hold-release-previews/${encodeURIComponent(releasePreviewId)}`
  );
  return response.data.data;
}

export async function approveMailLegalHoldRelease(
  releasePreviewId: string,
  input: {
    decision: 'APPROVE' | 'REJECT';
    idempotencyKey: string;
    fingerprint: string;
    holdVersion: number;
    policyVersion: number;
  }
): Promise<MailLegalHoldReleaseApproval> {
  const response = await axiosInstance.post<
    ApiResponse<MailLegalHoldReleaseApproval>,
    typeof input
  >(
    `/api/platform/v1/admin/mail/retention/hold-release-previews/${encodeURIComponent(releasePreviewId)}/approvals`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function executeMailLegalHoldRelease(
  releasePreviewId: string,
  input: {
    idempotencyKey: string;
    fingerprint: string;
    holdVersion: number;
    policyVersion: number;
  }
): Promise<MailLegalHoldReleaseExecution> {
  const response = await axiosInstance.post<
    ApiResponse<MailLegalHoldReleaseExecution>,
    typeof input
  >(
    `/api/platform/v1/admin/mail/retention/hold-release-previews/${encodeURIComponent(releasePreviewId)}/execute`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function previewMailPurge(input: {
  scope: Record<string, unknown>;
  resourceTypes: string[];
  before: string;
  idempotencyKey: string;
  policyVersion: number;
}): Promise<MailPurgePreview> {
  const response = await axiosInstance.post<ApiResponse<MailPurgePreview>, typeof input>(
    '/api/platform/v1/admin/mail/retention/purge-previews',
    input
  );
  return response.data.data;
}

export async function getMailActivePurgePreviews(): Promise<MailPurgePreview[]> {
  const response = await axiosInstance.get<ApiResponse<MailPurgePreview[]>>(
    '/api/platform/v1/admin/mail/retention/purge-previews'
  );
  return response.data.data;
}

export async function getMailPurgePreview(candidateSnapshotId: string): Promise<MailPurgePreview> {
  const response = await axiosInstance.get<ApiResponse<MailPurgePreview>>(
    `/api/platform/v1/admin/mail/retention/purge-previews/${encodeURIComponent(candidateSnapshotId)}`
  );
  return response.data.data;
}

export async function approveMailPurge(
  candidateSnapshotId: string,
  input: { decision: 'APPROVE'; idempotencyKey: string; policyVersion: number }
): Promise<MailPurgeApproval> {
  const response = await axiosInstance.post<ApiResponse<MailPurgeApproval>, typeof input>(
    `/api/platform/v1/admin/mail/retention/purges/${encodeURIComponent(candidateSnapshotId)}/approvals`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function executeMailPurge(
  candidateSnapshotId: string,
  input: { idempotencyKey: string; policyVersion: number; fingerprint: string }
): Promise<MailPurgeJob> {
  const response = await axiosInstance.post<ApiResponse<MailPurgeJob>, typeof input>(
    `/api/platform/v1/admin/mail/retention/purges/${encodeURIComponent(candidateSnapshotId)}/execute`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function getMailPurgeJob(jobId: string): Promise<MailPurgeJob> {
  const response = await axiosInstance.get<ApiResponse<MailPurgeJob>>(
    `/api/platform/v1/admin/mail/retention/purge-jobs/${encodeURIComponent(jobId)}`
  );
  return response.data.data;
}

export async function getMailDeliveryAudit(input: {
  page?: number;
  pageSize?: number;
  query?: string;
  correlationId?: string;
  accountId?: string;
  provider?: string;
  command?: 'SEND';
  dateFrom?: string;
  dateTo?: string;
  state?: string;
}): Promise<MailDeliveryAuditPage> {
  const search = new URLSearchParams();
  search.set('page', String(input.page ?? 0));
  search.set('pageSize', String(input.pageSize ?? 50));
  if (input.query || input.correlationId)
    search.set('correlationId', input.query ?? input.correlationId!);
  if (input.accountId) search.set('accountId', input.accountId);
  if (input.provider) search.set('provider', input.provider);
  if (input.command) search.set('command', input.command);
  if (input.dateFrom) search.set('dateFrom', input.dateFrom);
  if (input.dateTo) search.set('dateTo', input.dateTo);
  if (input.state) search.set('state', input.state);
  const response = await axiosInstance.get<ApiResponse<MailDeliveryAuditPage>>(
    `/api/platform/v1/admin/mail/delivery-audit?${search.toString()}`
  );
  return response.data.data;
}

async function runMailDeliveryAdminAction(
  deliveryId: string,
  action: 'reconcile' | 'retry' | 'cancel',
  input: { idempotencyKey: string; version: number }
): Promise<MailDeliveryAuditItem> {
  const response = await axiosInstance.post<ApiResponse<MailDeliveryAuditItem>, typeof input>(
    `/api/platform/v1/admin/mail/delivery-audit/${encodeURIComponent(deliveryId)}/${action}`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export function reconcileMailDeliveryAdmin(
  deliveryId: string,
  input: { idempotencyKey: string; version: number }
) {
  return runMailDeliveryAdminAction(deliveryId, 'reconcile', input);
}

export function retryMailDeliveryAdmin(
  deliveryId: string,
  input: { idempotencyKey: string; version: number }
) {
  return runMailDeliveryAdminAction(deliveryId, 'retry', input);
}

export function cancelMailDeliveryAdmin(
  deliveryId: string,
  input: { idempotencyKey: string; version: number }
) {
  return runMailDeliveryAdminAction(deliveryId, 'cancel', input);
}

export async function createMailDeliveryAuditExport(input: {
  filters: Record<string, unknown>;
  purpose: string;
  idempotencyKey: string;
}): Promise<MailDeliveryAuditExport> {
  const response = await axiosInstance.post<ApiResponse<MailDeliveryAuditExport>, typeof input>(
    '/api/platform/v1/admin/mail/delivery-audit/exports',
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function getMailDeliveryAuditExport(
  exportId: string
): Promise<MailDeliveryAuditExport> {
  const response = await axiosInstance.get<ApiResponse<MailDeliveryAuditExport>>(
    `/api/platform/v1/admin/mail/delivery-audit/exports/${encodeURIComponent(exportId)}`
  );
  return response.data.data;
}

export async function approveMailDeliveryAuditExport(
  exportId: string,
  input: { decision: 'APPROVE'; idempotencyKey: string }
): Promise<MailDeliveryAuditExport> {
  const response = await axiosInstance.post<ApiResponse<MailDeliveryAuditExport>, typeof input>(
    `/api/platform/v1/admin/mail/delivery-audit/exports/${encodeURIComponent(exportId)}/approvals`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function createMailRetentionEvidenceExport(input: {
  scope: Record<string, unknown>;
  purpose: string;
  policyVersion: number;
  idempotencyKey: string;
}): Promise<MailRetentionEvidenceExport> {
  const response = await axiosInstance.post<ApiResponse<MailRetentionEvidenceExport>, typeof input>(
    '/api/platform/v1/admin/mail/retention/evidence-exports',
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function getMailRetentionEvidenceExport(
  exportId: string
): Promise<MailRetentionEvidenceExport> {
  const response = await axiosInstance.get<ApiResponse<MailRetentionEvidenceExport>>(
    `/api/platform/v1/admin/mail/retention/evidence-exports/${encodeURIComponent(exportId)}`
  );
  return response.data.data;
}

export async function approveMailRetentionEvidenceExport(
  exportId: string,
  input: { decision: 'APPROVE'; idempotencyKey: string }
): Promise<MailRetentionEvidenceExport> {
  const response = await axiosInstance.post<ApiResponse<MailRetentionEvidenceExport>, typeof input>(
    `/api/platform/v1/admin/mail/retention/evidence-exports/${encodeURIComponent(exportId)}/approvals`,
    input,
    { headers: mailAdminElevatedHeaders() }
  );
  return response.data.data;
}

export async function downloadMailDeliveryAuditExport(exportId: string): Promise<Blob> {
  const response = await axiosInstance.get<Blob>(
    `/api/platform/v1/admin/mail/delivery-audit/exports/${encodeURIComponent(exportId)}/download`,
    {
      responseType: 'blob',
      headers: { ...mailAdminElevatedHeaders(), Accept: 'application/json' },
    }
  );
  return response.data;
}

export async function downloadMailRetentionEvidenceExport(exportId: string): Promise<Blob> {
  const response = await axiosInstance.get<Blob>(
    `/api/platform/v1/admin/mail/retention/evidence-exports/${encodeURIComponent(exportId)}/download`,
    {
      responseType: 'blob',
      headers: { ...mailAdminElevatedHeaders(), Accept: 'application/json' },
    }
  );
  return response.data;
}
