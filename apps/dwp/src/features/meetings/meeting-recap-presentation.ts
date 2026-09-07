import type { VideoMeetingParticipant } from '@dwp-frontend/shared-utils/api/video-meeting-api';

export function formatMeetingArtifactBytes(value?: number | null): string | null {
  if (value == null || value < 0) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function meetingParticipantOrder(participant: VideoMeetingParticipant): number {
  return {
    ORGANIZER: 0,
    CO_HOST: 1,
    PRESENTER: 2,
    ATTENDEE: 3,
    GUEST: 4,
  }[participant.participantRole];
}
