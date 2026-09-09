import type { VideoMeetingParticipant, VideoMeetingRole } from './video-meeting-lifecycle-contract';

export type VideoMeetingLifecycleState =
  'DRAFT' | 'SCHEDULED' | 'LOBBY' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type VideoMeetingAccessScope = 'INTERNAL' | 'INVITED' | 'PUBLIC_CODE';
export type VideoMeetingArtifactType =
  'RECORDING' | 'TRANSCRIPT' | 'SUMMARY' | 'ATTENDANCE' | 'CHAT_EXPORT';
export type VideoMeetingArtifactState =
  'NONE' | 'PROCESSING' | 'AVAILABLE' | 'UNAVAILABLE' | 'FAILED' | 'DELETED';

export type VideoMeetingArtifact = {
  artifactId: string;
  artifactType: VideoMeetingArtifactType;
  artifactState: VideoMeetingArtifactState;
  contentType?: string | null;
  sizeBytes?: number | null;
  retentionUntil?: string | null;
  metadata: Record<string, unknown>;
  version: number;
};

export type VideoMeetingDecision = {
  decision: string;
  ownerUserId?: number | null;
  status?: string | null;
  sourceTimestampSeconds?: number | null;
};

export type VideoMeetingFollowUpAction = {
  action: string;
  ownerUserId?: number | null;
  dueInDays?: number | null;
  status?: string | null;
  sourceTimestampSeconds?: number | null;
};

export type VideoMeetingSummary = {
  meetingId: string;
  meetingCode: string;
  title: string;
  description?: string | null;
  agenda?: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  timeZone: string;
  accessScope: VideoMeetingAccessScope;
  waitingRoomEnabled: boolean;
  guestAccessEnabled: boolean;
  allowJoinBeforeHost: boolean;
  defaultMicrophoneEnabled: boolean;
  defaultCameraEnabled: boolean;
  lifecycleState: VideoMeetingLifecycleState;
  organizerUserId?: number | null;
  organizerName: string;
  attendeeCount: number;
  participantLimit?: number | null;
  myRole?: VideoMeetingRole | null;
  canHost: boolean;
  canModerate: boolean;
  provider?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  participants: VideoMeetingParticipant[];
  decisions: VideoMeetingDecision[];
  followUpActions: VideoMeetingFollowUpAction[];
  artifacts: VideoMeetingArtifact[];
  aiNotesAvailable: boolean;
  version: number;
};
