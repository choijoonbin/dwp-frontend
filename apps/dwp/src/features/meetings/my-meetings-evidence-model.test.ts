import { describe, expect, it } from 'vitest';
import type { VideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingScheduleState } from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';
import {
  filterMeetingPage,
  meetingDateKey,
  meetingInvitationProgress,
  pendingMeetingInvitation,
  validMeetingDate,
} from './my-meetings-model';
import { copyMeetingScheduleStructure } from './meeting-schedule-source-picker';
import { emptyMeetingSchedule } from './meeting-schedule-model';

const preparation = (
  response: NonNullable<VideoMeetingPreparation['myResponse']>['response'],
  canRespond = true
) =>
  ({
    canRespond,
    invitationRevision: 3,
    myResponse: { response, invitationRevision: 3, version: 0 },
    invitationResponses: [{ response, mine: true }],
    invitationCounts: { accepted: 7, pending: 1, tentative: 0, declined: 0 },
    agendaItems: [],
  }) as unknown as VideoMeetingPreparation;
const meeting = {
  meetingId: 'meeting',
  title: 'Review',
  organizerName: 'Mina',
  lifecycleState: 'SCHEDULED',
  canHost: true,
  startsAt: '2026-09-04T23:30:00Z',
  durationMinutes: 45,
} as VideoMeetingSummary;

describe('U02 authorized evidence projections', () => {
  it.each(['PENDING', 'NEEDS_RESPONSE', 'RECONFIRM_REQUIRED'] as const)(
    'recognizes canonical pending state %s without granting authority',
    (state) => {
      expect(pendingMeetingInvitation(preparation(state))).toBe(true);
      expect(pendingMeetingInvitation(preparation(state, false))).toBe(false);
    }
  );
  it('requires response again for an older invitation revision but not an accepted current revision', () => {
    const source = preparation('ACCEPTED');
    expect(pendingMeetingInvitation(source)).toBe(false);
    source.myResponse!.invitationRevision = 2;
    expect(pendingMeetingInvitation(source)).toBe(true);
    expect(pendingMeetingInvitation(undefined)).toBe(false);
  });
  it('uses aggregate invitation counts without inventing hidden roster entries', () => {
    expect(meetingInvitationProgress(preparation('ACCEPTED'))).toEqual({
      total: 8,
      accepted: 7,
      percent: 87.5,
    });
  });
  it('filters a canonical date in the viewer timezone and rejects malformed URL dates', () => {
    expect(meetingDateKey(meeting.startsAt, 'Asia/Seoul')).toBe('2026-09-05');
    expect(meetingDateKey(meeting.startsAt, 'America/Los_Angeles')).toBe('2026-09-04');
    expect(validMeetingDate('2026-02-30')).toBe('');
    expect(validMeetingDate('2026-99-99')).toBe('');
    expect(validMeetingDate('2026-09-04')).toBe('2026-09-04');
    expect(filterMeetingPage([meeting], '', 'ALL', 'ALL', {}, '2026-09-05')).toHaveLength(1);
  });
  it('never classifies unavailable recurrence evidence as a one-off meeting', () => {
    expect(filterMeetingPage([meeting], '', 'ALL', 'ALL', {}, '', 'ONCE')).toHaveLength(0);
    const evidence = {
      meeting: {
        loading: false,
        failed: false,
        schedule: { seriesId: null } as VideoMeetingScheduleState,
      },
    };
    expect(filterMeetingPage([meeting], '', 'ALL', 'ALL', evidence, '', 'ONCE')).toHaveLength(1);
  });
});

describe('U03 recent meeting structure copy boundary', () => {
  it('copies only authorable structure while preserving current time, people and policy', () => {
    const draft = {
      ...emptyMeetingSchedule('Asia/Seoul'),
      sourceTemplateId: 'old-source',
      sourceTemplateVersion: 5,
    };
    draft.participants = [
      {
        userId: 9,
        displayName: 'Current invitee',
        emailAddress: 'current@example.test',
        organizationName: '',
      },
    ];
    const source = preparation('ACCEPTED');
    source.agendaItems = [
      {
        itemId: 'old-item',
        position: 0,
        title: 'Approved scope',
        objective: 'Review evidence',
        ownerUserId: 42,
        ownerDisplayName: 'Previous owner',
        plannedMinutes: 20,
      },
    ];
    const copied = copyMeetingScheduleStructure(
      draft,
      { ...meeting, agenda: 'Preparation context' },
      source
    );
    expect(copied.title).toBe('Review');
    expect(copied.agenda).toBe('Preparation context');
    expect(copied.startsAt).toBe(draft.startsAt);
    expect(copied.participants).toEqual(draft.participants);
    expect(copied.accessScope).toBe(draft.accessScope);
    expect(copied.waitingRoomEnabled).toBe(draft.waitingRoomEnabled);
    expect(copied.agendaItems[0].ownerUserId).toBeNull();
    expect(copied.agendaItems[0].key).not.toBe('old-item');
    expect(copied).not.toHaveProperty('sourceTemplateId');
    expect(copied).not.toHaveProperty('myResponse');
    expect(copied).not.toHaveProperty('materials');
  });
});
