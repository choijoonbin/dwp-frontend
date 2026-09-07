import { describe, expect, it } from 'vitest';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';

import { calendarDisplayDateValue, calendarResolvedTimeZone } from './calendar-regional-time';

describe('calendar regional time', () => {
  it('uses the selected product timezone and keeps date-only values on their canonical day', () => {
    const timeZone = calendarResolvedTimeZone('America/Los_Angeles', 'Asia/Seoul');
    expect(timeZone).toBe('America/Los_Angeles');
    expect(resolveZonedDateKey(calendarDisplayDateValue('2026-08-11', timeZone), timeZone)).toBe(
      '2026-08-11'
    );
  });

  it('uses the runtime zone only for the system preference', () => {
    expect(calendarResolvedTimeZone('system', 'Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(calendarResolvedTimeZone('UTC', 'Asia/Tokyo')).toBe('UTC');
  });
});
