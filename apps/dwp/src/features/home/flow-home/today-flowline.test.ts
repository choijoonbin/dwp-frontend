import { describe, expect, it } from 'vitest';

import {
  resolveFlowlineOverflowDetailRoute,
  resolveTodayFlowlineSourceState,
} from './today-flowline';

describe('Today Flowline source states', () => {
  it('keeps fully forbidden sources distinct from an empty available flow', () => {
    expect(resolveTodayFlowlineSourceState('FORBIDDEN', 'FORBIDDEN', false)).toEqual({
      unavailable: false,
      hasAvailableSource: false,
      hasForbiddenSource: true,
      availabilityPartial: false,
      permissionPartial: false,
    });
  });

  it('marks permission-scoped partial content without treating it as unavailable', () => {
    expect(resolveTodayFlowlineSourceState('AVAILABLE', 'FORBIDDEN', false)).toEqual({
      unavailable: false,
      hasAvailableSource: true,
      hasForbiddenSource: true,
      availabilityPartial: false,
      permissionPartial: true,
    });
  });

  it('preserves both the unavailable and forbidden facts when no source is available', () => {
    expect(resolveTodayFlowlineSourceState('UNAVAILABLE', 'FORBIDDEN', false)).toEqual({
      unavailable: true,
      hasAvailableSource: false,
      hasForbiddenSource: true,
      availabilityPartial: false,
      permissionPartial: false,
    });
  });

  it('treats a request failure as unavailable regardless of stale section metadata', () => {
    expect(resolveTodayFlowlineSourceState('AVAILABLE', 'AVAILABLE', true)).toEqual({
      unavailable: true,
      hasAvailableSource: false,
      hasForbiddenSource: false,
      availabilityPartial: false,
      permissionPartial: false,
    });
  });

  it('routes single-source overflow to the source that is actually hidden', () => {
    expect(resolveFlowlineOverflowDetailRoute(new Set(['work']), '/calendar/schedule')).toBe(
      '/work'
    );
    expect(resolveFlowlineOverflowDetailRoute(new Set(['calendar']), '/work')).toBe(
      '/calendar/schedule'
    );
    expect(resolveFlowlineOverflowDetailRoute(new Set(['work', 'calendar']), '/work')).toBe(
      '/work'
    );
  });
});
