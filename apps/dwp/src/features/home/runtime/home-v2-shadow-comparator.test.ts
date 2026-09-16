import { describe, expect, it } from 'vitest';

import { compareHomeShadowSnapshots } from './home-v2-shadow-comparator';

import type { HomeShadowSemanticSnapshot } from './home-v2-shadow-comparator';

const baseline: HomeShadowSemanticSnapshot = {
  appDock: ['group:work', 'app:dwp-work:NOT_REQUESTED'],
  customized: true,
  density: 'comfortable',
  freshness: 'CURRENT',
  layout: ['daily-brief:visible:full:standard'],
  mode: 'CLASSIC',
  partial: false,
  presentation: 'balanced',
  requiredAnnouncements: ['REQUIRED'],
  routeActions: ['daily-brief:SOURCE_ROUTE:/work'],
  widgets: [{ binding: 'TRUSTED', key: 'daily-brief', state: 'AVAILABLE' }],
};

describe('Home v2 semantic shadow comparator', () => {
  it('returns only bounded aggregate data for a match', () => {
    expect(compareHomeShadowSnapshots(baseline, structuredClone(baseline))).toEqual({
      count: 0,
      outcome: 'MATCH',
      reasons: ['MATCH'],
    });
  });

  it('classifies freshness-only drift as expected transient', () => {
    expect(compareHomeShadowSnapshots(baseline, { ...baseline, freshness: 'STALE' })).toEqual({
      count: 1,
      outcome: 'EXPECTED_TRANSIENT',
      reasons: ['EXPECTED_TRANSIENT', 'FRESHNESS'],
    });
  });

  it('keeps unavailable-only evidence distinct and removes it from a proven mismatch', () => {
    expect(compareHomeShadowSnapshots(baseline, { ...baseline, partial: true })).toEqual({
      count: 1,
      outcome: 'UNAVAILABLE',
      reasons: ['UNAVAILABLE'],
    });
    expect(
      compareHomeShadowSnapshots(baseline, {
        ...baseline,
        partial: true,
        presentation: 'focused',
      })
    ).toEqual({ count: 1, outcome: 'MISMATCH', reasons: ['LAYOUT'] });
  });

  it('treats bounded badge count and version classes as app-dock semantics', () => {
    expect(
      compareHomeShadowSnapshots(
        { ...baseline, appDock: ['group:work', 'app:dwp-work:AVAILABLE:3:1:COUNTER'] },
        { ...baseline, appDock: ['group:work', 'app:dwp-work:AVAILABLE:4:1:COUNTER'] }
      )
    ).toEqual({ count: 1, outcome: 'MISMATCH', reasons: ['APP_DOCK'] });
  });

  it('classifies semantic structure without copying raw content into the result', () => {
    const comparison = compareHomeShadowSnapshots(baseline, {
      ...baseline,
      mode: 'FLOW_V1',
      layout: ['private-title:visible:full:standard'],
      routeActions: ['daily-brief:COMMAND:private-object-id'],
      widgets: [{ binding: 'UNTRUSTED', key: 'private-definition', state: 'FORBIDDEN' }],
    });
    expect(comparison).toEqual({
      count: 5,
      outcome: 'MISMATCH',
      reasons: ['MODE', 'LAYOUT', 'AUTHORITY', 'WIDGET_STATE', 'ROUTE_ACTION'],
    });
    expect(JSON.stringify(comparison)).not.toContain('private');
  });

  it('fails closed when either projection is unavailable', () => {
    expect(compareHomeShadowSnapshots(null, baseline)).toEqual({
      count: 1,
      outcome: 'UNAVAILABLE',
      reasons: ['UNAVAILABLE'],
    });
  });
});
