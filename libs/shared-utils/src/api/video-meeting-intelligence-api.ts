import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

import type { ApiResponse } from '../types';

import {
  VIDEO_MEETING_API_BASE,
  type VideoMeetingAttendanceState,
  type VideoMeetingRole,
} from './video-meeting-api';

export type VideoMeetingIntelligenceRunState = 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type VideoMeetingIntelligenceReportState =
  'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'DELETED';
export type VideoMeetingIntelligenceAudience = 'PRIVATE_REVIEWERS' | 'MEETING_PARTICIPANTS';
export type VideoMeetingIntelligenceReviewDecision = 'APPROVE' | 'REJECT';
export type VideoMeetingIntelligencePermission = 'VIEW' | 'REVIEW' | 'MANAGE';
export type VideoMeetingIntelligenceExportFormat = 'JSON' | 'MARKDOWN';
const MAX_INTELLIGENCE_EXPORT_BYTES = 2_000_000;
const sha256Digest = /^[0-9a-f]{64}$/u;
export type VideoMeetingIntelligenceClimateLabel =
  'ALIGNED' | 'MIXED' | 'CONTESTED' | 'INSUFFICIENT_EVIDENCE';
export type VideoMeetingIntelligenceClimateSignal =
  'CONSTRUCTIVE_DISAGREEMENT' | 'UNRESOLVED_DISAGREEMENT' | 'LOW_TRANSCRIPT_EVIDENCE';

export type VideoMeetingIntelligenceCitation = {
  segmentId: string;
  startMillis: number;
  endMillis: number;
};

export type VideoMeetingIntelligenceCitedText = {
  text: string;
  citations: VideoMeetingIntelligenceCitation[];
};

export type VideoMeetingIntelligenceConversationClimate = {
  label: VideoMeetingIntelligenceClimateLabel;
  signals: VideoMeetingIntelligenceClimateSignal[];
  citations: VideoMeetingIntelligenceCitation[];
};

export type VideoMeetingIntelligenceAnalysis = {
  executiveSummary: VideoMeetingIntelligenceCitedText;
  topics: VideoMeetingIntelligenceCitedText[];
  decisions: VideoMeetingIntelligenceCitedText[];
  actionItems: VideoMeetingIntelligenceCitedText[];
  openQuestions: VideoMeetingIntelligenceCitedText[];
  risks: VideoMeetingIntelligenceCitedText[];
  conversationClimate: VideoMeetingIntelligenceConversationClimate;
};

export type VideoMeetingIntelligenceRun = {
  runId: string;
  meetingId: string;
  sourceArtifactId: string;
  state: VideoMeetingIntelligenceRunState;
  analysisProfile: string;
  outputLanguage: string;
  processingRegion: string;
  providerCode: string;
  providerModel: string;
  schemaVersion: string;
  requestedAt: string;
  completedAt?: string | null;
  failureCode?: string | null;
  version: number;
  reportId?: string | null;
};

export type VideoMeetingIntelligenceReview = {
  reviewId: string;
  reviewedReportVersion: number;
  decision: VideoMeetingIntelligenceReviewDecision;
  reasonCode: string;
  reviewedAt: string;
  reviewedBy: number;
};

export type VideoMeetingIntelligenceReport = {
  reportId: string;
  meetingId: string;
  runId: string;
  state: VideoMeetingIntelligenceReportState;
  audience: VideoMeetingIntelligenceAudience;
  schemaVersion: string;
  retentionUntil: string;
  legalHold: boolean;
  approvedAt?: string | null;
  publishedAt?: string | null;
  version: number;
  canCurrentViewerReview: boolean;
  analysis?: VideoMeetingIntelligenceAnalysis | null;
  reviews: VideoMeetingIntelligenceReview[];
  followUpCandidates?: VideoMeetingIntelligenceFollowUpCandidate[];
};

export type VideoMeetingIntelligenceFollowUpCandidate = {
  candidateId: string;
  sourceVersion: number;
  actionItemIndex: number;
};

export type CreateVideoMeetingIntelligenceRunInput = {
  sourceArtifactId: string;
  outputLanguage: string;
  expectedContentPlanVersion: number;
  idempotencyKey: string;
  correlationId?: string;
};

export type ReviewVideoMeetingIntelligenceReportInput = {
  expectedVersion: number;
  decision: VideoMeetingIntelligenceReviewDecision;
  reasonCode: string;
  correlationId?: string;
};

export type VideoMeetingIntelligenceGrant = {
  aclId: string;
  reportId: string;
  principalUserId: number;
  permission: VideoMeetingIntelligencePermission;
  grantedAt: string;
  grantedBy: number;
  expiresAt?: string | null;
  reasonCode: string;
};

export type VideoMeetingIntelligenceReviewerCandidate = {
  userId: number;
  participantId: string;
  displayName: string;
  participantRole: VideoMeetingRole;
  attendanceState: VideoMeetingAttendanceState;
  assignmentEligible: boolean;
  ineligibleReason?: 'CURRENT_MANAGER' | 'INTELLIGENCE_REQUESTER' | null;
};

export type VideoMeetingIntelligenceReviewerAssignments = {
  reportId: string;
  reportVersion: number;
  eligibleParticipants: VideoMeetingIntelligenceReviewerCandidate[];
  activeGrants: VideoMeetingIntelligenceGrant[];
};

export type GrantVideoMeetingIntelligenceAccessInput = {
  expectedReportVersion: number;
  permission: VideoMeetingIntelligencePermission;
  expiresAt?: string | null;
  reasonCode: string;
  correlationId?: string;
};

function intelligencePath(meetingId: string, suffix: string): string {
  return `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/intelligence/${suffix}`;
}

function commandHeaders(input: { idempotencyKey?: string; correlationId?: string }) {
  const headers: Record<string, string> = {};
  if (input.idempotencyKey !== undefined) {
    const key = input.idempotencyKey.trim();
    if (key.length < 8 || key.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(key)) {
      throw new Error('Meeting intelligence commands require a valid idempotency key.');
    }
    headers['Idempotency-Key'] = key;
  }
  if (input.correlationId !== undefined) {
    const correlationId = input.correlationId.trim();
    if (
      !correlationId ||
      correlationId.length > 160 ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(correlationId)
    ) {
      throw new Error('Meeting intelligence commands require a valid correlation ID.');
    }
    headers['X-Correlation-ID'] = correlationId;
  }
  return Object.keys(headers).length ? { headers } : undefined;
}

export async function createVideoMeetingIntelligenceRun(
  meetingId: string,
  input: CreateVideoMeetingIntelligenceRunInput
): Promise<VideoMeetingIntelligenceRun> {
  const response = await axiosInstance.post<
    ApiResponse<VideoMeetingIntelligenceRun>,
    Omit<CreateVideoMeetingIntelligenceRunInput, 'idempotencyKey' | 'correlationId'>
  >(
    intelligencePath(meetingId, 'runs'),
    {
      sourceArtifactId: input.sourceArtifactId,
      outputLanguage: input.outputLanguage,
      expectedContentPlanVersion: input.expectedContentPlanVersion,
    },
    commandHeaders(input)
  );
  return response.data.data;
}

export async function getVideoMeetingIntelligenceRun(
  meetingId: string,
  runId: string
): Promise<VideoMeetingIntelligenceRun> {
  const response = await axiosInstance.get<ApiResponse<VideoMeetingIntelligenceRun>>(
    intelligencePath(meetingId, `runs/${encodeURIComponent(runId)}`)
  );
  return response.data.data;
}

export async function getLatestVisibleVideoMeetingIntelligenceReport(
  meetingId: string,
  signal?: AbortSignal
): Promise<VideoMeetingIntelligenceReport | null> {
  try {
    const response = await axiosInstance.get<ApiResponse<VideoMeetingIntelligenceReport>>(
      intelligencePath(meetingId, 'reports/latest'),
      { signal }
    );
    return response.data.data;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export async function getLatestPublishedVideoMeetingIntelligenceReport(
  meetingId: string,
  signal?: AbortSignal
): Promise<VideoMeetingIntelligenceReport | null> {
  try {
    const response = await axiosInstance.get<ApiResponse<VideoMeetingIntelligenceReport>>(
      intelligencePath(meetingId, 'reports/latest-published'),
      { signal }
    );
    return response.data.data;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export async function getVideoMeetingIntelligenceReport(
  meetingId: string,
  reportId: string
): Promise<VideoMeetingIntelligenceReport> {
  const response = await axiosInstance.get<ApiResponse<VideoMeetingIntelligenceReport>>(
    intelligencePath(meetingId, `reports/${encodeURIComponent(reportId)}`)
  );
  return response.data.data;
}

export async function reviewVideoMeetingIntelligenceReport(
  meetingId: string,
  reportId: string,
  input: ReviewVideoMeetingIntelligenceReportInput
): Promise<VideoMeetingIntelligenceReport> {
  const response = await axiosInstance.post<
    ApiResponse<VideoMeetingIntelligenceReport>,
    Omit<ReviewVideoMeetingIntelligenceReportInput, 'correlationId'>
  >(
    intelligencePath(meetingId, `reports/${encodeURIComponent(reportId)}/review`),
    {
      expectedVersion: input.expectedVersion,
      decision: input.decision,
      reasonCode: input.reasonCode,
    },
    commandHeaders(input)
  );
  return response.data.data;
}

export async function publishVideoMeetingIntelligenceReport(
  meetingId: string,
  reportId: string,
  expectedVersion: number,
  correlationId?: string
): Promise<VideoMeetingIntelligenceReport> {
  const response = await axiosInstance.post<
    ApiResponse<VideoMeetingIntelligenceReport>,
    { expectedVersion: number }
  >(
    intelligencePath(meetingId, `reports/${encodeURIComponent(reportId)}/publish`),
    { expectedVersion },
    commandHeaders({ correlationId })
  );
  return response.data.data;
}

/**
 * The shared transport cannot send a DELETE body, so expectedVersion is carried in the query.
 * The meeting-server route must keep this query contract aligned before this command is wired.
 */
export async function deleteVideoMeetingIntelligenceReport(
  meetingId: string,
  reportId: string,
  expectedVersion: number,
  correlationId?: string
): Promise<VideoMeetingIntelligenceReport> {
  const search = new URLSearchParams({ expectedVersion: String(expectedVersion) });
  const response = await axiosInstance.delete<ApiResponse<VideoMeetingIntelligenceReport>>(
    `${intelligencePath(meetingId, `reports/${encodeURIComponent(reportId)}`)}?${search.toString()}`,
    commandHeaders({ correlationId })
  );
  return response.data.data;
}

export async function grantVideoMeetingIntelligenceAccess(
  meetingId: string,
  reportId: string,
  principalUserId: number,
  input: GrantVideoMeetingIntelligenceAccessInput
): Promise<VideoMeetingIntelligenceGrant> {
  const response = await axiosInstance.put<
    ApiResponse<VideoMeetingIntelligenceGrant>,
    Omit<GrantVideoMeetingIntelligenceAccessInput, 'correlationId'>
  >(
    intelligencePath(
      meetingId,
      `reports/${encodeURIComponent(reportId)}/acl/${encodeURIComponent(String(principalUserId))}`
    ),
    {
      expectedReportVersion: input.expectedReportVersion,
      permission: input.permission,
      expiresAt: input.expiresAt,
      reasonCode: input.reasonCode,
    },
    commandHeaders(input)
  );
  return response.data.data;
}

export async function getVideoMeetingIntelligenceReviewerAssignments(
  meetingId: string,
  reportId: string
): Promise<VideoMeetingIntelligenceReviewerAssignments> {
  const response = await axiosInstance.get<
    ApiResponse<VideoMeetingIntelligenceReviewerAssignments>
  >(intelligencePath(meetingId, `reports/${encodeURIComponent(reportId)}/reviewer-assignments`));
  return response.data.data;
}

export async function revokeVideoMeetingIntelligenceAccess(
  meetingId: string,
  reportId: string,
  principalUserId: number,
  permission: VideoMeetingIntelligencePermission,
  expectedReportVersion: number,
  correlationId?: string
): Promise<void> {
  const search = new URLSearchParams({ expectedReportVersion: String(expectedReportVersion) });
  await axiosInstance.delete<ApiResponse<void>>(
    `${intelligencePath(
      meetingId,
      `reports/${encodeURIComponent(reportId)}/acl/${encodeURIComponent(String(principalUserId))}/${encodeURIComponent(permission)}`
    )}?${search.toString()}`,
    commandHeaders({ correlationId })
  );
}

export async function downloadVideoMeetingIntelligenceReport(
  meetingId: string,
  reportId: string,
  expectedReportVersion: number,
  format: VideoMeetingIntelligenceExportFormat,
  authority: ProductSurfaceGovernedMutationAuthority,
  correlationId?: string,
  signal?: AbortSignal
): Promise<Blob> {
  if (!Number.isSafeInteger(expectedReportVersion) || expectedReportVersion <= 0) {
    throw new Error('Meeting intelligence exports require a valid report version.');
  }
  const command = commandHeaders({ correlationId });
  const governed = productSurfaceGovernedMutationConfig(authority);
  const response = await axiosInstance.post<
    Blob,
    { expectedReportVersion: number; format: VideoMeetingIntelligenceExportFormat }
  >(
    intelligencePath(meetingId, `reports/${encodeURIComponent(reportId)}/exports`),
    { expectedReportVersion, format },
    {
      responseType: 'blob',
      signal,
      contextScopeKey: governed.contextScopeKey,
      headers: {
        ...governed.headers,
        ...command?.headers,
        Accept: format === 'JSON' ? 'application/json' : 'text/markdown',
      },
    }
  );
  if (!(response.data instanceof Blob)) {
    throw new Error('Meeting intelligence export evidence is invalid.');
  }
  const expectedType = format === 'JSON' ? 'application/json' : 'text/markdown';
  const contentType = response.data.type.split(';', 1)[0]?.toLowerCase();
  const responseVersion = response.headers?.get('X-DWP-Report-Version')?.trim();
  const expectedDigest = response.headers?.get('X-DWP-Content-SHA256')?.trim().toLowerCase();
  if (
    !response.data.size ||
    response.data.size > MAX_INTELLIGENCE_EXPORT_BYTES ||
    contentType !== expectedType ||
    responseVersion !== String(expectedReportVersion) ||
    !expectedDigest ||
    !sha256Digest.test(expectedDigest) ||
    !globalThis.crypto?.subtle
  ) {
    throw new Error('Meeting intelligence export evidence is invalid.');
  }
  const contentBytes = new Uint8Array(await response.data.arrayBuffer());
  const digest = await globalThis.crypto.subtle.digest('SHA-256', contentBytes);
  const actualDigest = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  if (actualDigest !== expectedDigest) {
    throw new Error('Meeting intelligence export integrity check failed.');
  }
  return response.data;
}
