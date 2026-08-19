import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type MessagingMeetingCapability = {
  available: boolean;
  provider: string;
  unavailableReason?: string | null;
  audio: boolean;
  video: boolean;
  screenShare: boolean;
  participantList: boolean;
  tokenTtlSeconds: number;
};

export type MessagingMeetingSession = {
  sessionId: string;
  conversationId: string;
  provider: string;
  lifecycleState: 'ACTIVE' | 'ENDED';
  startedBy: number;
  startedAt: string;
  endedBy?: number | null;
  endedAt?: string | null;
  version: number;
};

export type MessagingMeetingJoinCredential = {
  sessionId: string;
  provider: string;
  serverUrl: string;
  participantToken: string;
  expiresAt: string;
};

type CurrentMeetingResponse = {
  session?: MessagingMeetingSession | null;
};

function meetingPath(conversationId: string, action: string): string {
  return `/api/messaging/v1/conversations/${encodeURIComponent(conversationId)}/meetings/${action}`;
}

export function isTrustedMeetingServerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'wss:') return true;
    return (
      url.protocol === 'ws:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

export async function getMessagingMeetingCapability(
  conversationId: string
): Promise<MessagingMeetingCapability> {
  const response = await axiosInstance.get<ApiResponse<MessagingMeetingCapability>>(
    meetingPath(conversationId, 'capabilities')
  );
  return response.data.data;
}

export async function getCurrentMessagingMeeting(
  conversationId: string
): Promise<MessagingMeetingSession | null> {
  const response = await axiosInstance.get<ApiResponse<CurrentMeetingResponse>>(
    meetingPath(conversationId, 'current')
  );
  return response.data.data.session ?? null;
}

export async function startMessagingMeeting(
  conversationId: string
): Promise<MessagingMeetingSession> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingMeetingSession>,
    Record<string, never>
  >(meetingPath(conversationId, 'start'), {});
  return response.data.data;
}

export async function issueMessagingMeetingToken(
  conversationId: string
): Promise<MessagingMeetingJoinCredential> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingMeetingJoinCredential>,
    Record<string, never>
  >(meetingPath(conversationId, 'token'), {});
  const credential = response.data.data;
  if (!isTrustedMeetingServerUrl(credential.serverUrl)) {
    throw new Error('The meeting provider returned an untrusted realtime endpoint.');
  }
  return credential;
}

export async function endMessagingMeeting(
  conversationId: string
): Promise<MessagingMeetingSession> {
  const response = await axiosInstance.post<
    ApiResponse<MessagingMeetingSession>,
    Record<string, never>
  >(meetingPath(conversationId, 'end'), {});
  return response.data.data;
}
