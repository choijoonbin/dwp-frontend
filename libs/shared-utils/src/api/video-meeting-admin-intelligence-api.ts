import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export type VideoMeetingAdminReadinessState =
  'READY' | 'BLOCKED' | 'CONNECTION_REQUIRED' | 'NOT_VERIFIED';

export type VideoMeetingAdminReadinessSignal = {
  state: VideoMeetingAdminReadinessState;
  reason?: string | null;
};

export type VideoMeetingAdminIntelligenceReadiness = {
  readinessVersion: string;
  observedAt: string;
  recordingPolicy: 'NEVER' | 'HOST_OPT_IN' | 'ADMIN_REQUIRED';
  providerCode?: string | null;
  providerModel?: string | null;
  processingRegion?: string | null;
  capabilities: Record<string, VideoMeetingAdminReadinessSignal>;
  dependencies: Record<string, VideoMeetingAdminReadinessSignal>;
  governance: Record<string, VideoMeetingAdminReadinessSignal>;
  retention: {
    meetingDays: number;
    artifactDays: number;
    chatDays: number;
    intelligenceWorkerReady: boolean;
    signals?: Record<string, VideoMeetingAdminReadinessSignal>;
  };
};

export async function getVideoMeetingAdminIntelligenceReadiness(): Promise<VideoMeetingAdminIntelligenceReadiness> {
  const response = await axiosInstance.get<ApiResponse<VideoMeetingAdminIntelligenceReadiness>>(
    `${VIDEO_MEETING_API_BASE}/admin/intelligence/readiness`
  );
  return response.data.data;
}
