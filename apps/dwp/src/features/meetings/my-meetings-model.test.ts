import { describe, expect, it } from 'vitest';

import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import { filterMeetingPage, meetingPagination, MY_MEETINGS_PAGE_SIZE } from './my-meetings';

function meeting(
  meetingId: string,
  lifecycleState: VideoMeetingSummary['lifecycleState'],
  canHost: boolean,
  title: string
): VideoMeetingSummary {
  return {
    meetingId,
    lifecycleState,
    canHost,
    title,
    organizerName: canHost ? 'Joonbin Choi' : 'Mina Kim',
    agenda: title === 'Architecture review' ? 'Gateway decision' : null,
  } as VideoMeetingSummary;
}

const PAGE = [
  meeting('scheduled', 'SCHEDULED', true, 'Architecture review'),
  meeting('live', 'LIVE', false, 'Launch room'),
  meeting('ended', 'ENDED', false, 'Weekly retrospective'),
  meeting('cancelled', 'CANCELLED', true, 'Cancelled planning'),
];

describe('My meetings current-page filters', () => {
  it('separates upcoming, live, and past lifecycle states without inventing invitation state', () => {
    expect(filterMeetingPage(PAGE, '', 'UPCOMING', 'ALL').map((item) => item.meetingId)).toEqual([
      'scheduled',
    ]);
    expect(filterMeetingPage(PAGE, '', 'LIVE', 'ALL').map((item) => item.meetingId)).toEqual([
      'live',
    ]);
    expect(filterMeetingPage(PAGE, '', 'PAST', 'ALL').map((item) => item.meetingId)).toEqual([
      'ended',
      'cancelled',
    ]);
  });

  it('filters host and participant roles from the authoritative capability', () => {
    expect(filterMeetingPage(PAGE, '', 'ALL', 'HOST').map((item) => item.meetingId)).toEqual([
      'scheduled',
      'cancelled',
    ]);
    expect(filterMeetingPage(PAGE, '', 'ALL', 'ATTENDEE').map((item) => item.meetingId)).toEqual([
      'live',
      'ended',
    ]);
  });

  it('matches only fields already present in the loaded server page', () => {
    expect(filterMeetingPage(PAGE, 'gateway', 'ALL', 'ALL').map((item) => item.meetingId)).toEqual([
      'scheduled',
    ]);
    expect(filterMeetingPage(PAGE, 'mina', 'ALL', 'ALL').map((item) => item.meetingId)).toEqual([
      'live',
      'ended',
    ]);
  });
});

describe('My meetings bounded server pagination', () => {
  it('limits each request to ten meetings and derives controls from the server total', () => {
    expect(MY_MEETINGS_PAGE_SIZE).toBe(10);
    expect(meetingPagination(24, 0, MY_MEETINGS_PAGE_SIZE)).toEqual({
      page: 0,
      current: 1,
      total: 3,
      hasPrevious: false,
      hasNext: true,
    });
    expect(meetingPagination(24, 2, MY_MEETINGS_PAGE_SIZE)).toEqual({
      page: 2,
      current: 3,
      total: 3,
      hasPrevious: true,
      hasNext: false,
    });
  });

  it('clamps stale server pages without exposing an invalid navigation state', () => {
    expect(meetingPagination(4, 8, MY_MEETINGS_PAGE_SIZE)).toEqual({
      page: 0,
      current: 1,
      total: 1,
      hasPrevious: false,
      hasNext: false,
    });
    expect(meetingPagination(0, -1, 0)).toEqual({
      page: 0,
      current: 1,
      total: 1,
      hasPrevious: false,
      hasNext: false,
    });
  });
});
