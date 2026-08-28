import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

import { VIDEO_MEETING_API_BASE } from './video-meeting-api';

export type VideoMeetingContentPlanState = 'DISABLED' | 'BLOCKED' | 'READY';
export type VideoMeetingContentNoticeState = 'PUBLISHED' | 'SUPERSEDED';
export type VideoMeetingRecordingState =
  'REQUESTED' | 'STARTING' | 'RECORDING' | 'STOP_REQUESTED' | 'STOPPED' | 'FAILED';

export type VideoMeetingContentBlocker = {
  code: string;
  category: string;
  description: string;
  retryable: boolean;
};

export type VideoMeetingContentDependencies = {
  egressAvailable: boolean;
  storageAvailable: boolean;
  kmsAvailable: boolean;
  auditAvailable: boolean;
  speechToTextAvailable: boolean;
  languageModelAvailable: boolean;
};

export type VideoMeetingContentNotice = {
  noticeId: string;
  revision: number;
  state: VideoMeetingContentNoticeState;
  disclosureCode: string;
  recordingDisclosed: boolean;
  transcriptionDisclosed: boolean;
  aiSummaryDisclosed: boolean;
  publishedAt: string;
  acknowledgedByViewer: boolean;
};

export type VideoMeetingContentConsent = {
  requiredAcknowledgements: number;
  receivedAcknowledgements: number;
  complete: boolean;
};

export type VideoMeetingRecordingSession = {
  recordingSessionId: string;
  state: VideoMeetingRecordingState;
  planVersion: number;
  noticeId: string;
  requestedAt: string;
  stopRequestedAt?: string | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  failureCode?: string | null;
  version: number;
};

export type VideoMeetingContentPlan = {
  meetingId: string;
  planId: string;
  recordingRequested: boolean;
  transcriptionRequested: boolean;
  aiSummaryRequested: boolean;
  e2eeEnabled: boolean;
  state: VideoMeetingContentPlanState;
  blockers: VideoMeetingContentBlocker[];
  dependencies: VideoMeetingContentDependencies;
  notice?: VideoMeetingContentNotice | null;
  consent: VideoMeetingContentConsent;
  recordingSession?: VideoMeetingRecordingSession | null;
  version: number;
  updatedAt: string;
};

export type UpdateVideoMeetingContentPlanInput = {
  recordingRequested: boolean;
  transcriptionRequested: boolean;
  aiSummaryRequested: boolean;
  e2eeEnabled: boolean;
  expectedVersion: number;
  idempotencyKey: string;
};

export type VideoMeetingNoticeAcknowledgement = {
  acknowledgementId: string;
  noticeId: string;
  noticeRevision: number;
  participantId: string;
  acknowledgedAt: string;
};

export type VideoMeetingRecordingCommand = {
  accepted: boolean;
  commandState: string;
  blockers: VideoMeetingContentBlocker[];
  recordingSession?: VideoMeetingRecordingSession | null;
  contentPlanVersion: number;
};

function contentPath(meetingId: string, suffix: string): string {
  return `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/${suffix}`;
}

function commandConfig(idempotencyKey: string) {
  const normalizedKey = idempotencyKey.trim();
  if (
    normalizedKey.length < 8 ||
    normalizedKey.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(normalizedKey)
  ) {
    throw new Error('Video meeting content commands require a valid idempotency key.');
  }
  return { headers: { 'Idempotency-Key': normalizedKey } };
}

export async function getVideoMeetingContentPlan(
  meetingId: string
): Promise<VideoMeetingContentPlan> {
  const response = await axiosInstance.get<ApiResponse<VideoMeetingContentPlan>>(
    contentPath(meetingId, 'content-plan')
  );
  return response.data.data;
}

export async function updateVideoMeetingContentPlan(
  meetingId: string,
  input: UpdateVideoMeetingContentPlanInput
): Promise<VideoMeetingContentPlan> {
  const { idempotencyKey, ...body } = input;
  const response = await axiosInstance.put<
    ApiResponse<VideoMeetingContentPlan>,
    Omit<UpdateVideoMeetingContentPlanInput, 'idempotencyKey'>
  >(contentPath(meetingId, 'content-plan'), body, commandConfig(idempotencyKey));
  return response.data.data;
}

export async function acknowledgeVideoMeetingContentNotice(
  meetingId: string,
  noticeId: string,
  idempotencyKey: string
): Promise<VideoMeetingNoticeAcknowledgement> {
  const response = await axiosInstance.post<
    ApiResponse<VideoMeetingNoticeAcknowledgement>,
    Record<string, never>
  >(
    contentPath(meetingId, `content-notices/${encodeURIComponent(noticeId)}/acknowledge`),
    {},
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function requestVideoMeetingRecording(
  meetingId: string,
  expectedPlanVersion: number,
  idempotencyKey: string
): Promise<VideoMeetingRecordingCommand> {
  const response = await axiosInstance.post<
    ApiResponse<VideoMeetingRecordingCommand>,
    { expectedPlanVersion: number }
  >(
    contentPath(meetingId, 'recording/request'),
    { expectedPlanVersion },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function stopVideoMeetingRecording(
  meetingId: string,
  expectedSessionVersion: number,
  idempotencyKey: string
): Promise<VideoMeetingRecordingCommand> {
  const response = await axiosInstance.post<
    ApiResponse<VideoMeetingRecordingCommand>,
    { expectedSessionVersion: number }
  >(
    contentPath(meetingId, 'recording/stop'),
    { expectedSessionVersion },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}
