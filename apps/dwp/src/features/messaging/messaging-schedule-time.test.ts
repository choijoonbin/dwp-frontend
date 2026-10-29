import { describe, expect, it } from 'vitest';

import { resolveMessagingScheduleTime } from './messaging-schedule-time';

describe('messaging scheduled local time resolution', () => {
  it('rejects the America/New_York spring-forward gap by local round-trip', () => {
    expect(resolveMessagingScheduleTime('2026-03-08T02:30', 'America/New_York')).toEqual({
      kind: 'nonexistent',
    });
  });

  it('rejects the duplicated America/New_York fall-back time', () => {
    expect(resolveMessagingScheduleTime('2026-11-01T01:30', 'America/New_York')).toEqual({
      kind: 'ambiguous',
    });
  });

  it('returns the unique instant on either side of a DST transition', () => {
    expect(resolveMessagingScheduleTime('2026-03-08T03:30', 'America/New_York')).toEqual({
      kind: 'valid',
      scheduledFor: '2026-03-08T07:30:00Z',
    });
    expect(resolveMessagingScheduleTime('2026-11-01T02:30', 'America/New_York')).toEqual({
      kind: 'valid',
      scheduledFor: '2026-11-01T07:30:00Z',
    });
  });
});
