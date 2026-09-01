import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { VideoMeetingParticipant } from './video-meeting-lifecycle-contract';

export const VIDEO_MEETING_API_BASE = '/api/meetings/v1';

export async function leaveVideoMeeting(
  meetingId: string,
  options?: { keepalive?: boolean }
): Promise<VideoMeetingParticipant> {
  const path = `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/leave`;
  const response = await axiosInstance.post<ApiResponse<VideoMeetingParticipant>, undefined>(
    path,
    undefined,
    options?.keepalive ? { keepalive: true } : undefined
  );
  return response.data.data;
}
