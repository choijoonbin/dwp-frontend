import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';
import type { VideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import type { VideoMeetingScheduleState } from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';

export type MeetingTimeFilter = 'UPCOMING' | 'LIVE' | 'PAST' | 'ALL' | 'PENDING';
export type MeetingRoleFilter = 'ALL' | 'HOST' | 'ATTENDEE';
export type MeetingSeriesFilter = 'ALL' | 'RECURRING' | 'ONCE';
export const MY_MEETINGS_PAGE_SIZE = 10;
export type MyMeetingEvidence = {
  preparation?: VideoMeetingPreparation;
  schedule?: VideoMeetingScheduleState;
  loading: boolean;
  failed: boolean;
};

export function meetingPagination(total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
  const boundedPage = Math.min(Math.max(0, page), totalPages - 1);
  return {
    page: boundedPage,
    current: boundedPage + 1,
    total: totalPages,
    hasPrevious: boundedPage > 0,
    hasNext: boundedPage + 1 < totalPages,
  } as const;
}

export function meetingTimeBucket(meeting: VideoMeetingSummary) {
  if (meeting.lifecycleState === 'LIVE') return 'LIVE';
  if (['ENDED', 'CANCELLED'].includes(meeting.lifecycleState)) return 'PAST';
  return 'UPCOMING';
}

export function meetingDateKey(startsAt: string, timeZone: string) {
  return resolveZonedDateKey(startsAt, timeZone) ?? '';
}

export function validMeetingDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return meetingDateKey(value + 'T12:00:00Z', 'UTC') === value ? value : '';
}

export function pendingMeetingInvitation(preparation?: VideoMeetingPreparation) {
  return Boolean(
    preparation?.canRespond &&
    preparation.myResponse &&
    (['PENDING', 'NEEDS_RESPONSE', 'RECONFIRM_REQUIRED'].includes(
      preparation.myResponse.response
    ) ||
      preparation.myResponse.invitationRevision !== preparation.invitationRevision)
  );
}

export function filterMeetingPage(
  meetings: VideoMeetingSummary[],
  search: string,
  time: MeetingTimeFilter,
  role: MeetingRoleFilter,
  evidence: Record<string, MyMeetingEvidence> = {},
  date = '',
  series: MeetingSeriesFilter = 'ALL',
  timeZone = 'Asia/Seoul'
) {
  const query = search.trim().toLocaleLowerCase();
  return meetings.filter((meeting) => {
    const item = evidence[meeting.meetingId];
    if (time === 'PENDING' && !pendingMeetingInvitation(item?.preparation)) return false;
    if (time !== 'ALL' && time !== 'PENDING' && meetingTimeBucket(meeting) !== time) return false;
    if (role === 'HOST' && !meeting.canHost) return false;
    if (role === 'ATTENDEE' && meeting.canHost) return false;
    if (date && meetingDateKey(meeting.startsAt, timeZone) !== date) return false;
    // Missing or rejected evidence is unknown, never silently classified as a one-off meeting.
    if (
      series !== 'ALL' &&
      (!item?.schedule || Boolean(item.schedule.seriesId) !== (series === 'RECURRING'))
    )
      return false;
    return (
      !query ||
      [
        meeting.title,
        meeting.organizerName,
        meeting.agenda ?? '',
        ...(item?.preparation?.agendaItems.map(({ title }) => title) ?? []),
      ].some((value) => value.toLocaleLowerCase().includes(query))
    );
  });
}

export function meetingInvitationProgress(preparation?: VideoMeetingPreparation) {
  if (!preparation) return null;
  const total = Object.values(preparation.invitationCounts).reduce((sum, count) => sum + count, 0);
  return {
    total,
    accepted: preparation.invitationCounts.accepted,
    percent: total ? Math.round((preparation.invitationCounts.accepted / total) * 1000) / 10 : 0,
  };
}
