import { describe, expect, it } from 'vitest';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import {
  formatHomeJoinCode,
  homeAgendaItems,
  homeFocusMeeting,
  homeMeetingDate,
  homeMeetingMinutesUntil,
  homeMeetingPath,
  homeUnavailableReason,
} from './meeting-home-model';

const now = Date.parse('2026-09-04T04:00:00Z');
const meeting = (overrides: Partial<VideoMeetingSummary> = {}): VideoMeetingSummary =>
  ({
    meetingId: 'meeting/7?scope=x#y',
    lifecycleState: 'SCHEDULED',
    startsAt: '2026-09-04T04:30:00Z',
    ...overrides,
  }) as VideoMeetingSummary;

describe('meeting home navigation and join code', () => {
  it('normalizes pasted codes, uppercases and groups four characters', () => {
    expect(formatHomeJoinCode(' abcd efgh jkmn pqrs ')).toBe('ABCD-EFGH-JKMN-PQRS');
  });

  it('removes ambiguous and invalid characters and keeps partial input editable', () => {
    expect(formatHomeJoinCode(' iIoO01/? ')).toBe('');
    expect(formatHomeJoinCode('abcde')).toBe('ABCD-E');
    expect(formatHomeJoinCode('ABCD-EFGH')).toBe('ABCD-EFGH');
    expect(formatHomeJoinCode('')).toBe('');
  });

  it('bounds normalized codes to sixteen meaningful characters', () => {
    expect(formatHomeJoinCode('abcdefghjkmnpqrstuvwxyz23456789')).toBe('ABCD-EFGH-JKMN-PQRS');
  });

  it.each(['DRAFT', 'SCHEDULED', 'LOBBY', 'LIVE'] as const)(
    'routes %s to the existing room with an escaped opaque meeting id',
    (lifecycleState) => {
      expect(homeMeetingPath(meeting({ lifecycleState }))).toBe(
        '/meetings/room/meeting%2F7%3Fscope%3Dx%23y'
      );
    }
  );

  it.each(['ENDED', 'CANCELLED'] as const)(
    'routes %s to records instead of offering a media room route',
    (lifecycleState) => {
      expect(homeMeetingPath(meeting({ lifecycleState }))).toBe(
        '/meetings/history?meeting=meeting%2F7%3Fscope%3Dx%23y'
      );
    }
  );
});

describe('meeting home command focus', () => {
  it('keeps a genuinely live meeting ahead of scheduled work', () => {
    const live = meeting({ meetingId: 'live', lifecycleState: 'LIVE' });
    const scheduled = meeting({ meetingId: 'scheduled' });
    expect(homeFocusMeeting(live, scheduled, [live, scheduled])).toBe(live);
  });

  it('does not let an untimed lobby shell hide the next scheduled meeting', () => {
    const abandonedLobby = meeting({
      meetingId: 'untimed-lobby',
      lifecycleState: 'LOBBY',
      startsAt: null as unknown as string,
    });
    const scheduled = meeting({ meetingId: 'scheduled' });
    expect(homeFocusMeeting(null, abandonedLobby, [scheduled])).toBe(scheduled);
  });

  it('still exposes an untimed lobby when no live or timed work exists', () => {
    const lobby = meeting({
      meetingId: 'only-lobby',
      lifecycleState: 'LOBBY',
      startsAt: null as unknown as string,
    });
    expect(homeFocusMeeting(null, lobby, [])).toBe(lobby);
  });
});

describe('meeting home time semantics', () => {
  it.each([
    [1, 1],
    [60_000, 1],
    [60_001, 2],
    [30 * 60_000, 30],
  ])('rounds a future %d millisecond offset upward to %d minutes', (delta, minutes) => {
    expect(
      homeMeetingMinutesUntil(meeting({ startsAt: new Date(now + delta).toISOString() }), now)
    ).toBe(minutes);
  });

  it.each([0, -1, -60_000])(
    'does not show a misleading starts-in countdown for offset %d',
    (delta) => {
      expect(
        homeMeetingMinutesUntil(meeting({ startsAt: new Date(now + delta).toISOString() }), now)
      ).toBeNull();
    }
  );

  it.each(['DRAFT', 'LOBBY', 'LIVE', 'ENDED', 'CANCELLED'] as const)(
    'does not derive a future countdown for lifecycle %s',
    (lifecycleState) => {
      expect(homeMeetingMinutesUntil(meeting({ lifecycleState }), now)).toBeNull();
    }
  );

  it('fails safely for invalid start or clock values', () => {
    expect(homeMeetingMinutesUntil(meeting({ startsAt: 'not-a-date' }), now)).toBeNull();
    expect(homeMeetingMinutesUntil(meeting(), Number.NaN)).toBeNull();
  });

  it('formats the same instant in the explicit home timezone across a calendar day boundary', () => {
    const instant = '2026-09-04T23:30:00Z';
    expect(homeMeetingDate(instant, 'en-GB', 'UTC', true)).toBe('11:30 PM');
    expect(homeMeetingDate(instant, 'en-GB', 'Asia/Seoul', true)).toBe('08:30 AM');
    expect(homeMeetingDate(instant, 'en-GB', 'UTC')).toContain('Fri');
    expect(homeMeetingDate(instant, 'en-GB', 'Asia/Seoul')).toContain('Sat');
  });

  it('accepts epoch timestamps and exposes unavailable dates without throwing', () => {
    expect(homeMeetingDate(now, 'en-GB', 'UTC', true)).toBe('04:00 AM');
    expect(homeMeetingDate('not-a-date', 'en-GB', 'UTC')).toBe('—');
    expect(homeMeetingDate(Number.NaN, 'en-GB', 'UTC')).toBe('—');
  });

  it('falls back to UTC for an invalid timezone and normalizes locale through the shared contract', () => {
    expect(homeMeetingDate(now, 'en-GB', 'Missing/Timezone', true)).toBe(
      homeMeetingDate(now, 'en', 'UTC', true)
    );
    expect(homeMeetingDate(now, 'not_a_locale', 'Asia/Seoul', true)).toBe(
      homeMeetingDate(now, 'en', 'Asia/Seoul', true)
    );
    expect(homeMeetingDate(now, 'en-GB', 'UTC', true)).toBe(
      homeMeetingDate(now, 'en', 'UTC', true)
    );
  });
});

describe('meeting home agenda projection', () => {
  it('keeps only explicit non-empty lines and removes common list markers', () => {
    expect(
      homeAgendaItems('1. Release scope\n- Open risk\n\n\u2022 Final decision\n4) Follow-up')
    ).toEqual(['Release scope', 'Open risk', 'Final decision', 'Follow-up']);
  });

  it('does not invent slots from prose punctuation and bounds the home preview', () => {
    expect(homeAgendaItems('Scope, risk, and decision.')).toEqual(['Scope, risk, and decision.']);
    expect(homeAgendaItems('1\n2\n3\n4\n5\n6\n7')).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(homeAgendaItems(null)).toEqual([]);
  });
});

describe('meeting home service-unavailable explanations', () => {
  it.each(['MEETINGS_DISABLED', 'MEETINGS_DISABLED_BY_POLICY'])(
    'identifies the administrator policy reason %s',
    (reason) => expect(homeUnavailableReason(reason)).toBe('policy')
  );

  it.each([
    'CAPABILITY_NOT_READY',
    'MEETING_PROVIDER_UNAVAILABLE',
    'REALTIME_PROVIDER_LIVENESS_NOT_READY',
    'REALTIME_PROVIDER_UNAVAILABLE',
  ])('identifies recoverable readiness reason %s', (reason) =>
    expect(homeUnavailableReason(reason)).toBe('temporary')
  );

  it.each([
    undefined,
    null,
    '',
    'MEETING_PROVIDER_DISABLED',
    'MEDIA_PROVIDER_NOT_CONFIGURED',
    'UNRECOGNIZED_PROVIDER_REASON',
  ])('keeps missing or configuration reason %s fail-closed', (reason) =>
    expect(homeUnavailableReason(reason)).toBe('configuration')
  );
});
