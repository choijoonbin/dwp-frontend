import { describe, expect, it } from 'vitest';

import {
  CALENDAR_DEFAULT_PATH,
  CALENDAR_NAVIGATION,
  findCalendarNavigationItem,
} from './calendar-navigation';

describe('calendar product navigation', () => {
  it('keeps user and delegated administration destinations in one product shell', () => {
    const items = CALENDAR_NAVIGATION.flatMap((group) => group.items);

    expect(items.map((item) => item.view)).toEqual([
      'home',
      'schedule',
      'availability',
      'resources',
      'insights',
      'admin-overview',
      'admin-resources',
      'admin-policies',
    ]);
    expect(
      items
        .filter((item) => item.view.startsWith('admin-'))
        .every((item) => item.requiredResourceKey === 'ADMIN.CALENDAR')
    ).toBe(true);
  });

  it('normalizes trailing slashes without accepting unrelated paths', () => {
    expect(CALENDAR_DEFAULT_PATH).toBe('/calendar/home');
    expect(findCalendarNavigationItem('/calendar/schedule/')?.view).toBe('schedule');
    expect(findCalendarNavigationItem('/calendar/not-a-view')).toBeUndefined();
  });
});
