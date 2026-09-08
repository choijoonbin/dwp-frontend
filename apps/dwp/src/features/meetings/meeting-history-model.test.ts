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
    myRole: options.canHost ? 'ORGANIZER' : 'ATTENDEE',
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
  it('restores participation navigation only from explicit viewer membership, not host or media inference', () => {
    const records = [
      { ...PAGE[0], myRole: null, canHost: true },
      { ...PAGE[1], myRole: 'ATTENDEE' as const },
      { ...PAGE[2], myRole: 'GUEST' as const },
    ];
    expect(
      filterMeetingHistoryPage(records, '', 'ALL', 'ALL', { navigation: 'PARTICIPATING' }).map(
        ({ meetingId }) => meetingId
      )
    ).toEqual(['two', 'three']);
    for (const navigation of ['SHARED', 'REVIEW'] as const)
      expect(filterMeetingHistoryPage(records, '', 'ALL', 'ALL', { navigation })).toEqual([]);
    // Favorites are already paginated and authorized by the server, not inferred from roles.
    expect(
      filterMeetingHistoryPage(records, '', 'ALL', 'ALL', { navigation: 'FAVORITES' })
    ).toEqual(records);
  });
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

  it('combines organizer and date facets without searching another authorized server page', () => {
    const items = PAGE.map((item, index) => ({
      ...item,
      endedAt: `2026-09-0${index + 1}T00:00:00Z`,
    }));
    expect(
      filterMeetingHistoryPage(items, '', 'ALL', 'ALL', {
        organizer: 'Mina Kim',
        periodDays: 5,
        now: Date.parse('2026-09-07T00:00:00Z'),
        order: 'OLDEST',
      }).map(({ meetingId }) => meetingId)
    ).toEqual(['two', 'three']);
    expect(
      filterMeetingHistoryPage(items, '', 'ALL', 'ALL', {
        periodDays: 4,
        now: Date.parse('2026-09-07T00:00:00Z'),
        order: 'NEWEST',
      }).map(({ meetingId }) => meetingId)
    ).toEqual(['three']);
    expect(items.map(({ meetingId }) => meetingId)).toEqual(['one', 'two', 'three']);
  });

  it('does not classify a missing or invalid completion date as a recent meeting', () => {
    const invalid = PAGE.map((item, index) => ({ ...item, endedAt: index ? 'invalid' : '' }));
    expect(filterMeetingHistoryPage(invalid, '', 'ALL', 'ALL', { periodDays: 7 })).toEqual([]);
    expect(filterMeetingHistoryPage(invalid, '', 'ALL', 'ALL')).toHaveLength(3);
  });
});
