import { describe, expect, it } from 'vitest';

import type { VideoMeetingHistoryItem } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import {
  filterMeetingHistoryPage,
  MEETING_HISTORY_PAGE_SIZE,
  meetingHistoryPageCount,
} from './meeting-history';

function history(
  meetingId: string,
  options: {
    title: string;
    recording?: boolean;
    transcript?: boolean;
    canHost?: boolean;
  }
): VideoMeetingHistoryItem {
  return {
    meetingId,
    title: options.title,
    organizerName: meetingId === 'one' ? 'Joonbin Choi' : 'Mina Kim',
    recordingAvailable: options.recording ?? false,
    transcriptAvailable: options.transcript ?? false,
    canHost: options.canHost ?? false,
  } as VideoMeetingHistoryItem;
}

const PAGE = [
  history('one', {
    title: 'Launch decision',
    recording: true,
    transcript: true,
    canHost: true,
  }),
  history('two', { title: 'Weekly planning', transcript: true }),
  history('three', { title: 'System review' }),
];

describe('Meeting library current-page filters', () => {
  it('requests ten bounded rows while preserving pagination from the server total', () => {
    expect(MEETING_HISTORY_PAGE_SIZE).toBe(10);
    expect(meetingHistoryPageCount(25, MEETING_HISTORY_PAGE_SIZE)).toBe(3);
    expect(meetingHistoryPageCount(20, MEETING_HISTORY_PAGE_SIZE)).toBe(2);
  });

  it('filters by evidence that is explicitly present on the history item', () => {
    expect(filterMeetingHistoryPage(PAGE, '', 'RECORDING').map((item) => item.meetingId)).toEqual([
      'one',
    ]);
    expect(filterMeetingHistoryPage(PAGE, '', 'TRANSCRIPT').map((item) => item.meetingId)).toEqual([
      'one',
      'two',
    ]);
    expect(filterMeetingHistoryPage(PAGE, '', 'NO_MEDIA').map((item) => item.meetingId)).toEqual([
      'three',
    ]);
  });

  it('searches only the title and organizer exposed by the bounded history endpoint', () => {
    expect(filterMeetingHistoryPage(PAGE, 'weekly', 'ALL').map((item) => item.meetingId)).toEqual([
      'two',
    ]);
    expect(filterMeetingHistoryPage(PAGE, 'joonbin', 'ALL').map((item) => item.meetingId)).toEqual([
      'one',
    ]);
    expect(filterMeetingHistoryPage(PAGE, 'architecture evidence', 'ALL')).toEqual([]);
  });

  it('filters by the current actor role already exposed on each history item', () => {
    expect(filterMeetingHistoryPage(PAGE, '', 'ALL', 'HOST').map((item) => item.meetingId)).toEqual(
      ['one']
    );
    expect(
      filterMeetingHistoryPage(PAGE, '', 'ALL', 'ATTENDEE').map((item) => item.meetingId)
    ).toEqual(['two', 'three']);
  });
});
