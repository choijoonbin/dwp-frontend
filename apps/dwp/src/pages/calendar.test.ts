import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./calendar.tsx', import.meta.url), 'utf8');

const calendarViews = [
  'calendar-home',
  'calendar-schedule',
  'calendar-focus-planner',
  'calendar-invitations',
  'calendar-availability',
  'calendar-trash',
  'calendar-insights',
  'calendar-admin',
  'calendar-admin-company-calendars',
  'calendar-admin-policies',
] as const;

describe('Calendar page loading boundary', () => {
  it('keeps every feature view behind a lazy import', () => {
    calendarViews.forEach((view) => {
      expect(source).toContain(`import('../features/calendar/${view}')`);
      expect(source).not.toMatch(
        new RegExp(`import\\s+\\{[^}]+\\}\\s+from\\s+['"]\\.\\./features/calendar/${view}['"]`)
      );
    });

    expect(source.match(/const Calendar\w+ = lazy\(/g)).toHaveLength(calendarViews.length);
  });

  it('keeps access and date context mounted above the shared route fallback', () => {
    const accessGuardStart = source.indexOf('<ProductAreaNavigationItemAccessGuard');
    const dateProviderStart = source.indexOf('<DwpDatePickerProvider>');
    const suspenseStart = source.indexOf('<Suspense fallback={<RouteFallback />}>');
    const suspenseEnd = source.indexOf('</Suspense>');
    const dateProviderEnd = source.indexOf('</DwpDatePickerProvider>');
    const accessGuardEnd = source.indexOf('</ProductAreaNavigationItemAccessGuard>');

    expect(accessGuardStart).toBeGreaterThan(-1);
    expect(accessGuardStart).toBeLessThan(dateProviderStart);
    expect(dateProviderStart).toBeLessThan(suspenseStart);
    expect(suspenseStart).toBeLessThan(suspenseEnd);
    expect(suspenseEnd).toBeLessThan(dateProviderEnd);
    expect(dateProviderEnd).toBeLessThan(accessGuardEnd);
  });
});
