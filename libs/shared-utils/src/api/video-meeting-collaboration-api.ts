import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

import { VIDEO_MEETING_API_BASE, type VideoMeetingRole } from './video-meeting-api';

export type VideoMeetingCollaborationParticipant = {
  participantId: string;
  userId: number;
  personPublicId?: string | null;
  displayName: string;
  participantRole: VideoMeetingRole;
};

export type VideoMeetingChatMessageState = 'ACTIVE' | 'DELETED';

export type VideoMeetingChatMessage = {
  messageId: string;
  sequence: number;
  createdSequence: number;
  sender: VideoMeetingCollaborationParticipant;
  state: VideoMeetingChatMessageState;
  text?: string | null;
  sentAt: string;
  retentionUntil?: string | null;
  deletedAt?: string | null;
  mine: boolean;
  canDelete: boolean;
};

export type VideoMeetingHandRequestState =
  'RAISED' | 'ACKNOWLEDGED' | 'LOWERED' | 'DISMISSED' | 'CLEARED';

export type VideoMeetingHandRequest = {
  requestId: string;
  sequence: number;
  raisedSequence: number;
  requester: VideoMeetingCollaborationParticipant;
  state: VideoMeetingHandRequestState;
  raisedAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  mine: boolean;
  canLower: boolean;
  canAcknowledge: boolean;
  canDismiss: boolean;
};

export type VideoMeetingCollaborationPage<T> = {
  items: T[];
  nextSequence: number;
  hasMore: boolean;
};

function meetingCollaborationPath(meetingId: string, suffix: string): string {
  return `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/${suffix}`;
}

function streamQuery(afterSequence: number, limit: number): string {
  const search = new URLSearchParams({
    afterSequence: String(Math.max(0, Math.trunc(afterSequence))),
    limit: String(Math.max(1, Math.min(100, Math.trunc(limit)))),
  });
  return search.toString();
}

function commandConfig(idempotencyKey: string) {
  const normalizedKey = idempotencyKey.trim();
  if (
    normalizedKey.length < 8 ||
    normalizedKey.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(normalizedKey)
  ) {
    throw new Error('Video meeting collaboration commands require a valid idempotency key.');
  }
  return { headers: { 'Idempotency-Key': normalizedKey } };
}

export async function getVideoMeetingChatMessages(
  meetingId: string,
  afterSequence = 0,
  limit = 100
): Promise<VideoMeetingCollaborationPage<VideoMeetingChatMessage>> {
  const response = await axiosInstance.get<
    ApiResponse<VideoMeetingCollaborationPage<VideoMeetingChatMessage>>
  >(`${meetingCollaborationPath(meetingId, 'chat/messages')}?${streamQuery(afterSequence, limit)}`);
  return response.data.data;
}

export async function sendVideoMeetingChatMessage(
  meetingId: string,
  input: { text: string; idempotencyKey: string }
): Promise<VideoMeetingChatMessage> {
  const response = await axiosInstance.post<ApiResponse<VideoMeetingChatMessage>, { text: string }>(
    meetingCollaborationPath(meetingId, 'chat/messages'),
    { text: input.text.trim() },
    commandConfig(input.idempotencyKey)
  );
  return response.data.data;
}

export async function deleteVideoMeetingChatMessage(
  meetingId: string,
  messageId: string,
  input: { reason?: string | null; idempotencyKey: string }
): Promise<VideoMeetingChatMessage> {
  const response = await axiosInstance.post<
    ApiResponse<VideoMeetingChatMessage>,
    { reason: string | null }
  >(
    meetingCollaborationPath(meetingId, `chat/messages/${encodeURIComponent(messageId)}/delete`),
    { reason: input.reason?.trim() || null },
    commandConfig(input.idempotencyKey)
  );
  return response.data.data;
}

export async function getVideoMeetingHandRequests(
  meetingId: string,
  afterSequence = 0,
  limit = 100
): Promise<VideoMeetingCollaborationPage<VideoMeetingHandRequest>> {
  const response = await axiosInstance.get<
    ApiResponse<VideoMeetingCollaborationPage<VideoMeetingHandRequest>>
  >(`${meetingCollaborationPath(meetingId, 'hand-requests')}?${streamQuery(afterSequence, limit)}`);
  return response.data.data;
}

async function handCommand(
  meetingId: string,
  action: string,
  idempotencyKey: string
): Promise<VideoMeetingHandRequest> {
  const response = await axiosInstance.post<
    ApiResponse<VideoMeetingHandRequest>,
    Record<string, never>
  >(meetingCollaborationPath(meetingId, action), {}, commandConfig(idempotencyKey));
  return response.data.data;
}

export function raiseVideoMeetingHand(
  meetingId: string,
  idempotencyKey: string
): Promise<VideoMeetingHandRequest> {
  return handCommand(meetingId, 'hand-requests/raise', idempotencyKey);
}

export function lowerVideoMeetingHand(
  meetingId: string,
  requestId: string,
  idempotencyKey: string
): Promise<VideoMeetingHandRequest> {
  return handCommand(
    meetingId,
    `hand-requests/${encodeURIComponent(requestId)}/lower`,
    idempotencyKey
  );
}

export function acknowledgeVideoMeetingHand(
  meetingId: string,
  requestId: string,
  idempotencyKey: string
): Promise<VideoMeetingHandRequest> {
  return handCommand(
    meetingId,
    `hand-requests/${encodeURIComponent(requestId)}/acknowledge`,
    idempotencyKey
  );
}

export function dismissVideoMeetingHand(
  meetingId: string,
  requestId: string,
  idempotencyKey: string
): Promise<VideoMeetingHandRequest> {
  return handCommand(
    meetingId,
    `hand-requests/${encodeURIComponent(requestId)}/dismiss`,
    idempotencyKey
  );
}

export async function clearVideoMeetingHandRequests(
  meetingId: string,
  idempotencyKey: string
): Promise<{ clearedCount: number; sequence: number }> {
  const response = await axiosInstance.post<
    ApiResponse<{ clearedCount: number; sequence: number }>,
    Record<string, never>
  >(meetingCollaborationPath(meetingId, 'hand-requests/clear'), {}, commandConfig(idempotencyKey));
  return response.data.data;
}
