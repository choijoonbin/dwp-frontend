import type { VideoMeetingHistoryItem } from '@dwp-frontend/shared-utils/api/video-meeting-api';

export const meetingHistoryNavigation = [
  'ALL',
  'PARTICIPATING',
  'SHARED',
  'REVIEW',
  'FAVORITES',
] as const;
export type MeetingHistoryNavigation = (typeof meetingHistoryNavigation)[number];

/** Favorites use a server-side personal projection; sharing/review require separate authority. */
export function meetingHistoryNavigationAvailable(value: MeetingHistoryNavigation): boolean {
  return value === 'ALL' || value === 'PARTICIPATING' || value === 'FAVORITES';
}

export function meetingHistoryHasViewerMembership(meeting: VideoMeetingHistoryItem): boolean {
  return ['ORGANIZER', 'CO_HOST', 'PRESENTER', 'ATTENDEE', 'GUEST'].some(
    (role) => role === meeting.myRole
  );
}
