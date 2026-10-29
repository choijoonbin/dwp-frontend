import { describe, expect, it } from 'vitest';

import { calendarAvailabilityIsoRange } from './calendar-availability-range';

describe('calendar availability range', () => {
  it('uses calendar-zone day boundaries and preserves DST-length days', () => {
    expect(
      calendarAvailabilityIsoRange({ start: '2026-10-31', end: '2026-11-01' }, 'America/New_York')
    ).toEqual({
      from: '2026-10-31T04:00:00Z',
      to: '2026-11-02T05:00:00Z',
    });
  });

  it('rejects incomplete or invalid ranges instead of falling back to the browser timezone', () => {
    expect(calendarAvailabilityIsoRange({ start: '2026-10-31', end: null }, 'UTC')).toBeNull();
    expect(
      calendarAvailabilityIsoRange({ start: '2026-10-31', end: '2026-11-01' }, 'Not/A_Zone')
    ).toBeNull();
  });
});
