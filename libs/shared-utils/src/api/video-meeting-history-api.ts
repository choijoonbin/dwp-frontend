import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';
import type { VideoMeetingRole } from './video-meeting-lifecycle-contract';
import type { VideoMeetingSummary } from './video-meeting-summary-contract';

type VideoMeetingPage<T> = { items: T[]; page: number; pageSize: number; total: number };

export type VideoMeetingHistoryPublicationState =
  'NONE' | 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
export type VideoMeetingHistoryPublicationFilter = 'ALL' | VideoMeetingHistoryPublicationState;
export type VideoMeetingHistoryRetentionState =
  'UNCONFIGURED' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'LEGAL_HOLD';
export type VideoMeetingHistoryRetentionFilter = 'ALL' | VideoMeetingHistoryRetentionState;

export type VideoMeetingHistoryItem = VideoMeetingSummary & {
  endedAt: string;
  actualDurationMinutes: number;
  participantPeak: number;
  averageQualityScore?: number | null;
  recordingAvailable: boolean;
  transcriptAvailable: boolean;
  publicationState: VideoMeetingHistoryPublicationState;
  retentionState: VideoMeetingHistoryRetentionState;
  retentionUntil?: string | null;
};

type WireHistoryItem = {
  meetingId: string;
  title: string;
  organizerUserId?: number;
  organizerName?: string;
  participantRole?: VideoMeetingRole;
  canHost?: boolean;
  endedAt?: string | null;
  actualDurationMinutes: number;
  participantPeak: number;
  averageQualityScore?: number | null;
  recordingAvailable: boolean;
  transcriptAvailable: boolean;
  publicationState?: string | null;
  retentionState?: string | null;
  retentionUntil?: string | null;
};

const PUBLICATION_STATES = new Set<VideoMeetingHistoryPublicationState>([
  'NONE',
  'DRAFT',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
]);
const RETENTION_STATES = new Set<VideoMeetingHistoryRetentionState>([
  'UNCONFIGURED',
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'LEGAL_HOLD',
]);

function publicationState(value?: string | null): VideoMeetingHistoryPublicationState {
  return PUBLICATION_STATES.has(value as VideoMeetingHistoryPublicationState)
    ? (value as VideoMeetingHistoryPublicationState)
    : 'NONE';
}

function retentionState(value?: string | null): VideoMeetingHistoryRetentionState {
  return RETENTION_STATES.has(value as VideoMeetingHistoryRetentionState)
    ? (value as VideoMeetingHistoryRetentionState)
    : 'UNCONFIGURED';
}

function normalizeHistory(item: WireHistoryItem): VideoMeetingHistoryItem {
  const endsAt = item.endedAt ?? new Date().toISOString();
  return {
    meetingId: item.meetingId,
    meetingCode: '',
    title: item.title,
    startsAt: endsAt,
    endsAt,
    durationMinutes: item.actualDurationMinutes,
    timeZone: '',
    accessScope: 'INVITED',
    waitingRoomEnabled: false,
    guestAccessEnabled: false,
    allowJoinBeforeHost: false,
    defaultMicrophoneEnabled: false,
    defaultCameraEnabled: false,
    lifecycleState: 'ENDED',
    organizerUserId: item.organizerUserId,
    organizerName: item.organizerName ?? '',
    attendeeCount: item.participantPeak,
    myRole: item.participantRole ?? null,
    canHost: item.canHost === true,
    canModerate: false,
    participants: [],
    decisions: [],
    followUpActions: [],
    artifacts: [],
    aiNotesAvailable: false,
    version: 0,
    endedAt: endsAt,
    actualDurationMinutes: item.actualDurationMinutes,
    participantPeak: item.participantPeak,
    averageQualityScore: item.averageQualityScore,
    recordingAvailable: item.recordingAvailable,
    transcriptAvailable: item.transcriptAvailable,
    publicationState: publicationState(item.publicationState),
    retentionState: retentionState(item.retentionState),
    retentionUntil: item.retentionUntil ?? null,
  };
}

export async function getVideoMeetingHistory(
  page = 0,
  pageSize = 30,
  options: {
    favoriteOnly?: boolean;
    publication?: VideoMeetingHistoryPublicationFilter;
    retention?: VideoMeetingHistoryRetentionFilter;
    signal?: AbortSignal;
  } = {}
): Promise<VideoMeetingPage<VideoMeetingHistoryItem>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (options.favoriteOnly) query.set('favoriteOnly', 'true');
  if (options.publication && options.publication !== 'ALL')
    query.set('publication', options.publication);
  if (options.retention && options.retention !== 'ALL') query.set('retention', options.retention);
  const response = await axiosInstance.get<ApiResponse<VideoMeetingPage<WireHistoryItem>>>(
    `${VIDEO_MEETING_API_BASE}/history?${query.toString()}`,
    { signal: options.signal }
  );
  const result = response.data.data;
  return {
    items: result.items.map(normalizeHistory),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  };
}
