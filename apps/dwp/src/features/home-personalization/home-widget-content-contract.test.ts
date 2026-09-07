import { describe, expect, it } from 'vitest';

import {
  buildHomeWidgetConfiguration,
  homeWidgetContentContract,
} from './home-widget-content-contract';

describe('home widget content contract', () => {
  it('builds the registered schedule payload expected by the platform boundary', () => {
    expect(
      buildHomeWidgetConfiguration('schedule', ['title', 'startAt'], 'NEXT_7_DAYS', 6)
    ).toEqual({
      sourceKey: 'CALENDAR',
      fieldKeys: ['title', 'startAt'],
      filterPreset: 'NEXT_7_DAYS',
      itemLimit: 6,
    });
  });

  it('rejects unknown filters and removes repeated fields', () => {
    expect(buildHomeWidgetConfiguration('focus', ['title', 'title'], 'DUE_SOON', 30)).toMatchObject(
      { fieldKeys: ['title'], itemLimit: 20 }
    );
    expect(() => buildHomeWidgetConfiguration('focus', ['title'], 'TODAY', 3)).toThrow();
  });

  it('does not expose fixed or derived zones as configurable widgets', () => {
    expect(homeWidgetContentContract('command-rail')).toBeNull();
    expect(homeWidgetContentContract('focus-balance')).toBeNull();
    expect(homeWidgetContentContract('meeting-load')).toBeNull();
    expect(homeWidgetContentContract('today-flowline')).toBeNull();
  });
});
