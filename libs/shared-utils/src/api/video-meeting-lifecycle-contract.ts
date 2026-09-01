export type VideoMeetingRole = 'ORGANIZER' | 'CO_HOST' | 'PRESENTER' | 'ATTENDEE' | 'GUEST';

export type VideoMeetingAttendanceState =
  'INVITED' | 'REQUESTED' | 'ADMITTED' | 'DENIED' | 'JOINED' | 'LEFT';

export type VideoMeetingParticipant = {
  participantId: string;
  userId?: number | null;
  personPublicId?: string | null;
  emailAddress?: string | null;
  displayName: string;
  jobTitle?: string | null;
  organizationName?: string | null;
  participantRole: VideoMeetingRole;
  attendanceState: VideoMeetingAttendanceState;
  canSelfUnmute: boolean;
  joinRequestedAt?: string | null;
  admittedAt?: string | null;
  joinedAt?: string | null;
  leftAt?: string | null;
  version: number;
};
