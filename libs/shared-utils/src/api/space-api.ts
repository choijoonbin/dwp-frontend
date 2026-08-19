import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type SpaceRole = 'VIEWER' | 'CONTRIBUTOR' | 'EDITOR' | 'MODERATOR' | 'OWNER' | 'GUEST';

export type SpaceSummary = {
  spaceId: string;
  spaceKey: string;
  nameKo: string;
  nameEn: string;
  summaryKo: string;
  summaryEn: string;
  purposeType: 'PROJECT' | 'COMMUNITY' | 'OPERATIONS' | 'KNOWLEDGE' | 'LEADERSHIP';
  visibility: 'OPEN' | 'REQUEST' | 'PRIVATE' | 'HIDDEN';
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  memberRole?: SpaceRole | null;
  memberCount: number;
  contentCount: number;
  unreadCount: number;
  iconKey: string;
  accentToken: string;
  coverAssetUrl?: string | null;
  lifecycleState: string;
  lastActivityAt: string;
  version: number;
};

export type SpaceContent = {
  contentId: string;
  contentType: 'PAGE' | 'POST' | 'FILE' | 'LINK' | 'CANVAS' | 'DECISION' | 'APP_EMBED';
  title: string;
  summary: string;
  route?: string | null;
  dataClassification: string;
  lifecycleState: string;
  authorUserId: number;
  authorName?: string | null;
  currentRevision: number;
  publishedAt?: string | null;
  updatedAt: string;
};

export type SpaceAppBinding = {
  bindingId: string;
  appKey: string;
  displayNameKo: string;
  displayNameEn: string;
  launchTarget: string;
  iconKey: string;
  dataAccessScope: string;
  lifecycleState: string;
};

export type SpaceActivity = {
  activityId: string;
  spaceKey: string;
  spaceNameKo: string;
  spaceNameEn: string;
  activityType: string;
  actorType: string;
  actorName?: string | null;
  objectType: string;
  titleKo: string;
  titleEn: string;
  route?: string | null;
  occurredAt: string;
};

export type SpaceTemplate = {
  templateId: string;
  templateKey: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  purposeType: SpaceSummary['purposeType'];
  creationMode: 'AUTO' | 'POLICY' | 'APPROVAL';
  defaultVisibility: SpaceSummary['visibility'];
  defaultDataClassification: SpaceSummary['dataClassification'];
  iconKey: string;
  accentToken: string;
  lifecycleState: string;
  currentVersion: number;
  version: number;
};

export type SpaceRequest = {
  requestId: string;
  templateId: string;
  templateNameKo: string;
  templateNameEn: string;
  requesterUserId: number;
  requesterName?: string | null;
  requestedKey: string;
  requestedName: string;
  requestedSummary: string;
  requestedVisibility: SpaceSummary['visibility'];
  justification: string;
  decisionMode: string;
  riskLevel: string;
  policyEvidence: Record<string, unknown>;
  status: string;
  decisionNote?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  version: number;
};

export type SpaceMember = {
  membershipId: string;
  principalType: 'USER' | 'GROUP';
  principalRef: string;
  memberRole: SpaceRole;
  membershipSource: string;
  lifecycleState: string;
  validFrom: string;
  validUntil?: string | null;
  version: number;
};

export type SpaceAccessRequest = {
  accessRequestId: string;
  spaceId: string;
  spaceKey: string;
  spaceNameKo: string;
  spaceNameEn: string;
  requesterUserId: number;
  requesterName?: string | null;
  requestedRole: 'VIEWER' | 'CONTRIBUTOR';
  justification: string;
  decisionMode: string;
  status: string;
  decisionNote?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  version: number;
};

export type SpacePublicationReview = {
  reviewId: string;
  spaceId: string;
  spaceKey: string;
  spaceNameKo: string;
  spaceNameEn: string;
  contentId: string;
  contentTitle: string;
  contentType: string;
  dataClassification: string;
  reviewerStrategy: string;
  status: string;
  createdAt: string;
};

export type SpaceLifecycleReview = {
  lifecycleReviewId: string;
  spaceId: string;
  spaceKey: string;
  spaceNameKo: string;
  spaceNameEn: string;
  reviewType: string;
  dueAt: string;
  status: string;
  recommendation?: string | null;
  evidence: Record<string, unknown>;
};

export type SpaceHome = {
  generatedAt: string;
  metrics: {
    mySpaces: number;
    discoverableSpaces: number;
    pendingRequests: number;
    reviewQueue: number;
    unreadSignals: number;
  };
  focusSpaces: SpaceSummary[];
  recentActivity: SpaceActivity[];
  recommendedTemplates: SpaceTemplate[];
  insights: Array<{
    key: string;
    tone: string;
    titleKo: string;
    titleEn: string;
    detailKo: string;
    detailEn: string;
    route: string;
  }>;
  canCreate: boolean;
  canAdminister: boolean;
};

export type SpaceDetail = {
  space: SpaceSummary;
  contentPolicy: string;
  appPolicy: string;
  aiPolicy: string;
  canContribute: boolean;
  canModerate: boolean;
  canManage: boolean;
  featuredContent: SpaceContent[];
  apps: SpaceAppBinding[];
  activity: SpaceActivity[];
};

export type SpaceAdminOverview = {
  generatedAt: string;
  metrics: {
    activeSpaces: number;
    restrictedSpaces: number;
    pendingCreationRequests: number;
    pendingPublicationReviews: number;
    overdueLifecycleReviews: number;
    activeMemberships: number;
  };
  priorityRequests: SpaceRequest[];
  publicationQueue: SpacePublicationReview[];
  lifecycleQueue: SpaceLifecycleReview[];
  portfolio: SpaceSummary[];
};

export type SpaceOperationsDashboard = {
  generatedAt: string;
  entitlementProviderConfigured: boolean;
  metrics: {
    queuedDeliveries: number;
    deadLetters: number;
    openFindings: number;
    highRiskFindings: number;
    ownerlessSpaces: number;
    overdueReviews: number;
    synchronizedLast24Hours: number;
  };
  recentRuns: Array<{
    runId: string;
    triggerType: 'SCHEDULED' | 'MANUAL' | 'RECOVERY';
    lifecycleState: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    plannedCount: number;
    expiredCount: number;
    findingCount: number;
    requestedBy?: number | null;
    summary: Record<string, unknown>;
    startedAt: string;
    completedAt?: string | null;
  }>;
  findings: Array<{
    findingId: string;
    spaceId?: string | null;
    membershipId?: string | null;
    findingType:
      | 'OWNERLESS_SPACE'
      | 'ENTITLEMENT_DELIVERY'
      | 'EXPIRED_MEMBERSHIP'
      | 'LIFECYCLE_REVIEW';
    severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
    lifecycleState: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
    targetType: string;
    targetRef: string;
    title: string;
    evidence: Record<string, unknown>;
    firstDetectedAt: string;
    lastDetectedAt: string;
  }>;
  deliveries: Array<{
    syncItemId: string;
    spaceId: string;
    membershipId: string;
    principalType: 'USER' | 'GROUP';
    principalRef: string;
    resourceKey: string;
    permissionCode: string;
    desiredState: 'GRANTED' | 'REVOKED';
    deliveryState: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'RETRY' | 'DEAD';
    attemptCount: number;
    nextAttemptAt: string;
    externalState?: string | null;
    lastError?: string | null;
    lastAttemptAt?: string | null;
    synchronizedAt?: string | null;
  }>;
};

const base = '/api/spaces/v1';

async function getData<T>(path: string): Promise<T> {
  const response = await axiosInstance.get<ApiResponse<T>>(`${base}${path}`);
  return response.data.data;
}

export const getSpaceHome = () => getData<SpaceHome>('/home');
export const getSpaces = (scope: 'MY' | 'DISCOVER', query = '') =>
  getData<SpaceSummary[]>(`/spaces?scope=${scope}&q=${encodeURIComponent(query)}`);
export const getSpace = (spaceKey: string) => getData<SpaceDetail>(`/spaces/${spaceKey}`);
export const getSpaceContent = (spaceKey: string) =>
  getData<SpaceContent[]>(`/spaces/${spaceKey}/content`);
export const getSpaceTemplates = () => getData<SpaceTemplate[]>('/templates');
export const getSpaceRequests = (status = 'ALL') =>
  getData<SpaceRequest[]>(`/requests?status=${encodeURIComponent(status)}`);
export const getSpaceMembers = (spaceKey: string) =>
  getData<SpaceMember[]>(`/spaces/${spaceKey}/owner/members`);
export const getMySpaceAccessRequests = (status = 'ALL') =>
  getData<SpaceAccessRequest[]>(`/access-requests?status=${encodeURIComponent(status)}`);
export const getSpaceOwnerAccessRequests = (spaceKey: string, status = 'ALL') =>
  getData<SpaceAccessRequest[]>(
    `/spaces/${spaceKey}/owner/access-requests?status=${encodeURIComponent(status)}`
  );

export async function requestSpaceAccess(
  spaceKey: string,
  input: { requestedRole: 'VIEWER' | 'CONTRIBUTOR'; justification: string }
): Promise<SpaceAccessRequest> {
  const response = await axiosInstance.post<ApiResponse<SpaceAccessRequest>, typeof input>(
    `${base}/spaces/${spaceKey}/access-requests`,
    input
  );
  return response.data.data;
}

export async function decideSpaceAccessRequest(
  spaceKey: string,
  requestId: string,
  input: { decision: 'APPROVE' | 'REJECT'; note: string; expectedVersion: number }
): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, typeof input>(
    `${base}/spaces/${spaceKey}/owner/access-requests/${requestId}/decision`,
    input
  );
}

export async function saveSpaceMember(
  spaceKey: string,
  input: {
    principalType: 'USER' | 'GROUP';
    principalRef: string;
    memberRole: SpaceRole;
    validUntil?: string | null;
  }
): Promise<SpaceMember[]> {
  const response = await axiosInstance.post<ApiResponse<SpaceMember[]>, typeof input>(
    `${base}/spaces/${spaceKey}/owner/members`,
    input
  );
  return response.data.data;
}

export async function updateSpaceMember(
  spaceKey: string,
  membershipId: string,
  input: { memberRole: SpaceRole; validUntil?: string | null; expectedVersion: number }
): Promise<SpaceMember[]> {
  const response = await axiosInstance.put<ApiResponse<SpaceMember[]>, typeof input>(
    `${base}/spaces/${spaceKey}/owner/members/${membershipId}`,
    input
  );
  return response.data.data;
}

export async function revokeSpaceMember(
  spaceKey: string,
  membershipId: string
): Promise<SpaceMember[]> {
  const response = await axiosInstance.delete<ApiResponse<SpaceMember[]>>(
    `${base}/spaces/${spaceKey}/owner/members/${membershipId}`
  );
  return response.data.data;
}

export async function createSpaceRequest(input: {
  templateId: string;
  requestedKey: string;
  requestedName: string;
  requestedSummary: string;
  requestedVisibility: SpaceSummary['visibility'];
  justification: string;
}): Promise<SpaceRequest> {
  const response = await axiosInstance.post<ApiResponse<SpaceRequest>, typeof input>(
    `${base}/requests`,
    input
  );
  return response.data.data;
}

export async function createSpaceContent(
  spaceKey: string,
  input: {
    contentType: SpaceContent['contentType'];
    title: string;
    summary: string;
    dataClassification: string;
    content: Record<string, unknown>;
  }
): Promise<SpaceContent> {
  const response = await axiosInstance.post<ApiResponse<SpaceContent>, typeof input>(
    `${base}/spaces/${spaceKey}/content`,
    input
  );
  return response.data.data;
}

export async function updateSpacePolicies(
  spaceKey: string,
  input: {
    contentPolicy: string;
    appPolicy: string;
    aiPolicy: string;
    expectedVersion: number;
  }
): Promise<SpaceDetail> {
  const response = await axiosInstance.put<ApiResponse<SpaceDetail>, typeof input>(
    `${base}/spaces/${spaceKey}/owner/policies`,
    input
  );
  return response.data.data;
}

export const getSpaceAdminOverview = () => getData<SpaceAdminOverview>('/admin/overview');
export const getSpaceAdminSpaces = (query = '') =>
  getData<SpaceSummary[]>(`/admin/spaces?q=${encodeURIComponent(query)}`);
export const getSpaceAdminRequests = (status = 'ALL') =>
  getData<SpaceRequest[]>(`/admin/requests?status=${encodeURIComponent(status)}`);
export const getSpaceAdminTemplates = () => getData<SpaceTemplate[]>('/admin/templates');
export const getSpacePublicationReviews = (status = 'ALL') =>
  getData<SpacePublicationReview[]>(`/admin/content-reviews?status=${encodeURIComponent(status)}`);
export const getSpaceLifecycleReviews = (status = 'ALL') =>
  getData<SpaceLifecycleReview[]>(`/admin/lifecycle?status=${encodeURIComponent(status)}`);
export const getSpaceOperations = () => getData<SpaceOperationsDashboard>('/admin/operations');

export async function recoverSpaceOwner(
  spaceKey: string,
  input: { personPublicId: string; reason: string }
): Promise<SpaceMember[]> {
  const response = await axiosInstance.post<ApiResponse<SpaceMember[]>, typeof input>(
    `${base}/admin/spaces/${encodeURIComponent(spaceKey)}/owner-recovery`,
    input
  );
  return response.data.data;
}

export async function reconcileSpaceOperations(): Promise<
  SpaceOperationsDashboard['recentRuns'][number]
> {
  const response = await axiosInstance.post<
    ApiResponse<SpaceOperationsDashboard['recentRuns'][number]>,
    Record<string, never>
  >(`${base}/admin/operations/reconcile`, {});
  return response.data.data;
}

export async function retrySpaceEntitlement(syncItemId: string): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, Record<string, never>>(
    `${base}/admin/operations/entitlements/${syncItemId}/retry`,
    {}
  );
}

export async function decideSpaceRequest(
  requestId: string,
  input: { decision: 'APPROVE' | 'REJECT'; note: string; expectedVersion: number }
): Promise<SpaceRequest> {
  const response = await axiosInstance.post<ApiResponse<SpaceRequest>, typeof input>(
    `${base}/admin/requests/${requestId}/decision`,
    input
  );
  return response.data.data;
}

export async function decideSpacePublication(
  reviewId: string,
  input: { decision: 'APPROVE' | 'REJECT'; note: string }
): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, typeof input>(
    `${base}/admin/content-reviews/${reviewId}/decision`,
    input
  );
}

export type SaveSpaceTemplateInput = {
  templateKey: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  purposeType: SpaceSummary['purposeType'];
  creationMode: SpaceTemplate['creationMode'];
  defaultVisibility: SpaceSummary['visibility'];
  defaultDataClassification: SpaceSummary['dataClassification'];
  allowedContentTypes: SpaceContent['contentType'][];
  defaultApps: string[];
  iconKey: string;
  accentToken: string;
  lifecycleState: string;
  expectedVersion?: number | null;
};

export async function createSpaceTemplate(input: SaveSpaceTemplateInput): Promise<SpaceTemplate> {
  const response = await axiosInstance.post<ApiResponse<SpaceTemplate>, typeof input>(
    `${base}/admin/templates`,
    input
  );
  return response.data.data;
}

export async function updateSpaceTemplate(
  templateId: string,
  input: SaveSpaceTemplateInput
): Promise<SpaceTemplate> {
  const response = await axiosInstance.put<ApiResponse<SpaceTemplate>, typeof input>(
    `${base}/admin/templates/${templateId}`,
    input
  );
  return response.data.data;
}

export async function decideSpaceLifecycle(
  lifecycleReviewId: string,
  input: { recommendation: 'KEEP' | 'ARCHIVE' | 'DELETE' | 'REVIEW_ACCESS'; note: string }
): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, typeof input>(
    `${base}/admin/lifecycle/${lifecycleReviewId}/decision`,
    input
  );
}
