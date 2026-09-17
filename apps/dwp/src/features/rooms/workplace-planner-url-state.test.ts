import { describe, expect, it } from 'vitest';

import {
  migrateLegacyWorkplacePlannerUrl,
  parseWorkplacePlannerUrl,
  resolveLegacyWorkplacePlannerLocation,
  updateWorkplacePlannerUrl,
} from './workplace-planner-url-state';

const referenceDate = '2026-09-16';

describe('workplace planner URL state', () => {
  it('normalizes a shareable weekly plan without retaining unsafe or unsupported values', () => {
    const parsed = parseWorkplacePlannerUrl(
      new URLSearchParams(
        'week=2026-09-17&dates=2026-09-18,invalid,2026-09-14,2026-09-18&start=25:00&duration=99999&tz=unsafe%00&target=team&beneficiaries=user-2,%3Cbad%3E,user-3,user-2&group=team-1&types=LOCKER,ROOM,DESK&adjacent=1&neighborhood=1&minDistance=1.5&maxDistance=8&step=review&token=secret'
      ),
      { referenceDate }
    );

    expect(parsed.state).toMatchObject({
      week: '2026-09-14',
      dates: ['2026-09-14', '2026-09-18'],
      start: '09:00',
      duration: 540,
      timeZone: 'Asia/Seoul',
      target: 'TEAM',
      beneficiaryRefs: ['user-2', 'user-3'],
      groupRef: 'team-1',
      resourceTypes: ['DESK', 'LOCKER'],
      adjacentSeats: true,
      sameNeighborhood: true,
      minimumDistanceMeters: 1.5,
      maximumDistanceMeters: 8,
      step: 'REVIEW',
    });
    expect(parsed.canonicalSearchParams.has('token')).toBe(false);
    expect(parsed.corrected).toBe(true);
  });

  it('defaults to the five weekdays of the reference week', () => {
    const state = parseWorkplacePlannerUrl(new URLSearchParams(), { referenceDate }).state;
    expect(state.week).toBe('2026-09-14');
    expect(state.dates).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ]);
    expect(state.resourceTypes).toEqual(['DESK', 'PARKING', 'LOCKER']);
  });

  it('preserves server recovery references while changing plan filters', () => {
    const current = new URLSearchParams(
      'v=1&week=2026-09-14&dates=2026-09-14&start=09%3A00&duration=540&tz=Asia%2FSeoul&target=SELF&types=DESK&step=RESULT&intent=intent-1&batch=batch-1&item=item-1'
    );
    const next = updateWorkplacePlannerUrl(
      current,
      { types: ['DESK', 'PARKING'] },
      { referenceDate }
    );
    expect(parseWorkplacePlannerUrl(next, { referenceDate }).state).toMatchObject({
      resourceTypes: ['DESK', 'PARKING'],
      intentId: 'intent-1',
      batchId: 'batch-1',
      selectedItemId: 'item-1',
    });
  });

  it('migrates the legacy Find mode once and keeps only recognized planner scope', () => {
    const migrated = migrateLegacyWorkplacePlannerUrl(
      new URLSearchParams(
        'mode=PLANNER&date=2026-09-16&start=10%3A30&duration=180&tz=Asia%2FSeoul&sites=site-1&floors=floor-1&types=ALL&q=quiet&resource=desk-1'
      ),
      { referenceDate }
    );
    expect(migrated.toString()).toBe(
      'v=1&week=2026-09-14&dates=2026-09-14%2C2026-09-15%2C2026-09-16%2C2026-09-17%2C2026-09-18&start=10%3A30&duration=180&tz=Asia%2FSeoul&target=SELF&site=site-1&floor=floor-1&types=DESK%2CPARKING%2CLOCKER&step=PLAN'
    );
  });

  it('preserves the hash while moving the legacy Find mode to the canonical planner', () => {
    expect(
      resolveLegacyWorkplacePlannerLocation('?mode=PLANNER&date=2026-09-16', '#review', {
        referenceDate,
      })
    ).toEqual({
      pathname: '/workplace/planner',
      search:
        '?v=1&week=2026-09-14&dates=2026-09-14%2C2026-09-15%2C2026-09-16%2C2026-09-17%2C2026-09-18&start=09%3A00&duration=540&tz=Asia%2FSeoul&target=SELF&types=DESK%2CPARKING%2CLOCKER&step=PLAN',
      hash: '#review',
    });
  });
});
