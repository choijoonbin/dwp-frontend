import { describe, expect, it } from 'vitest';

import {
  migrateLegacyWorkplaceFindUrl,
  parseWorkplaceFindUrl,
  updateWorkplaceFindUrl,
} from './workplace-find-url-state';

describe('Workplace find URL state', () => {
  it('normalizes a versioned canonical URL without retaining unsafe or unsupported state', () => {
    const parsed = parseWorkplaceFindUrl(
      new URLSearchParams(
        'v=99&date=2026-09-17&start=09%3A30&duration=60&tz=Asia%2FSeoul' +
          '&sites=site-1,site-2&floors=floor-1&types=DESK,ROOM&features=DISPLAY,VIDEO' +
          '&capacity=4&view=split&sort=CAPACITY&q=%00+project+&token=secret&scope=SELF'
      )
    );

    expect(parsed.state).toMatchObject({
      date: '2026-09-17',
      start: '09:30',
      duration: 60,
      timeZone: 'Asia/Seoul',
      siteId: 'site-1',
      floorId: 'floor-1',
      type: 'DESK',
      feature: 'DISPLAY',
      capacity: 4,
      view: null,
      sort: 'capacity',
      query: 'project',
      scope: 'SELF',
    });
    expect(parsed.corrected).toBe(true);
    expect(parsed.canonicalSearchParams.toString()).toBe(
      'v=1&date=2026-09-17&start=09%3A30&duration=60&tz=Asia%2FSeoul' +
        '&sites=site-1&floors=floor-1&types=DESK&features=DISPLAY&capacity=4' +
        '&sort=CAPACITY&q=project&scope=SELF'
    );
  });

  it('migrates Explore aliases and forces Rooms aliases to the room authority', () => {
    const explore = migrateLegacyWorkplaceFindUrl(
      new URLSearchParams(
        'time=10%3A00&timeZone=Asia%2FSeoul&site=site-1&floor=floor-1&type=DESK&feature=MONITOR&q=focus'
      ),
      'explore'
    );
    expect(explore.toString()).toBe(
      'v=1&start=10%3A00&tz=Asia%2FSeoul&sites=site-1&floors=floor-1&types=DESK&features=MONITOR&q=focus'
    );

    const rooms = migrateLegacyWorkplaceFindUrl(
      new URLSearchParams('type=DESK&date=2026-09-17&resource=room-1'),
      'rooms'
    );
    expect(rooms.toString()).toBe('v=1&date=2026-09-17&types=ROOM&resource=room-1');
  });

  it('keeps Gregorian leap dates and rejects impossible dates and time zones without a polyfill', () => {
    const leapDay = parseWorkplaceFindUrl(
      new URLSearchParams('date=2028-02-29&tz=Asia%2FSeoul&types=ALL')
    );
    expect(leapDay.state).toMatchObject({ date: '2028-02-29', timeZone: 'Asia/Seoul' });

    const invalid = parseWorkplaceFindUrl(
      new URLSearchParams('date=2026-02-29&tz=Not%2FA_Zone&types=ALL')
    );
    expect(invalid.state).toMatchObject({ date: null, timeZone: null });
    expect(invalid.canonicalSearchParams.toString()).toBe('v=1&types=ALL');
  });

  it('updates only canonical fields and keeps the exact surface scope', () => {
    const next = updateWorkplaceFindUrl(
      new URLSearchParams('v=1&types=ALL&scope=SELF&token=secret'),
      { sites: 'site-2', types: 'ROOM', sort: 'name' }
    );

    expect(next.toString()).toBe('v=1&sites=site-2&types=ROOM&sort=NAME&scope=SELF');
  });
});
