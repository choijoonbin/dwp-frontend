import { describe, expect, it } from 'vitest';

import { calendarDate, calendarTime } from './calendar-components';

describe('calendar scheduling display time zone', () => {
  it('renders the evaluated zone instead of the regional default', () => {
    const instant = '2026-11-01T00:30:00Z';

    expect(calendarDate(instant, 'en', true, 'America/New_York')).toContain('October');
    expect(calendarDate(instant, 'en', true, 'Asia/Seoul')).toContain('November');
  });

  it('disambiguates both sides of the New York DST fold with an explicit offset', () => {
    const firstOneThirty = calendarTime('2026-11-01T05:30:00Z', 'en', 'America/New_York');
    const secondOneThirty = calendarTime('2026-11-01T06:30:00Z', 'en', 'America/New_York');

    expect(firstOneThirty).toContain('GMT-4');
    expect(secondOneThirty).toContain('GMT-5');
    expect(firstOneThirty).not.toBe(secondOneThirty);
  });
});
