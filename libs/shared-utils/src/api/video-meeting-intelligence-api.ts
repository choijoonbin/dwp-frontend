import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

import { VIDEO_MEETING_API_BASE } from './video-meeting-api';

export type VideoMeetingIntelligenceRunState = 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type VideoMeetingIntelligenceReportState =
  'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'DELETED';
export type VideoMeetingIntelligenceAudience = 'PRIVATE_REVIEWERS' | 'MEETING_PARTICIPANTS';
export type VideoMeetingIntelligenceReviewDecision = 'APPROVE' | 'REJECT';
export type VideoMeetingIntelligencePermission = 'VIEW' | 'REVIEW' | 'MANAGE';
export type VideoMeetingIntelligenceClimateLabel =
  'ALIGNED' | 'MIXED' | 'CONTESTED' | 'INSUFFICIENT_EVIDENCE';
export type VideoMeetingIntelligenceClimateSignal =
  | 'BALANCED_TURN_TAKING'
  | 'CONSTRUCTIVE_DISAGREEMENT'
  | 'UNRESOLVED_DISAGREEMENT'
  | 'DOMINANT_MONOLOGUE_PATTERN'
  | 'LOW_TRANSCRIPT_EVIDENCE';

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

export type GrantVideoMeetingIntelligenceAccessInput = {
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
  meetingId: string
): Promise<VideoMeetingIntelligenceReport | null> {
  try {
    const response = await axiosInstance.get<ApiResponse<VideoMeetingIntelligenceReport>>(
      intelligencePath(meetingId, 'reports/latest')
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
      permission: input.permission,
      expiresAt: input.expiresAt,
      reasonCode: input.reasonCode,
    },
    commandHeaders(input)
  );
  return response.data.data;
}

export async function revokeVideoMeetingIntelligenceAccess(
  meetingId: string,
  reportId: string,
  principalUserId: number,
  permission: VideoMeetingIntelligencePermission,
  correlationId?: string
): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    intelligencePath(
      meetingId,
      `reports/${encodeURIComponent(reportId)}/acl/${encodeURIComponent(String(principalUserId))}/${encodeURIComponent(permission)}`
    ),
    commandHeaders({ correlationId })
  );
}
