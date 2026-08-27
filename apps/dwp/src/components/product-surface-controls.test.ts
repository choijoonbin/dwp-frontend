import { describe, expect, it } from 'vitest';

import {
  advanceSurfaceExpiryClock,
  resetSurfaceExpiryClock,
  resolveSurfaceExpiryIndicator,
  resolveSurfaceExpiryClockElapsed,
  resolveSurfaceExpiryTransitionDelay,
  surfaceExpiryAnnouncementKey,
  surfaceExpiryClockIdentity,
} from './product-surface-controls';
import { productSurfaceContentInstanceKey } from './product-surface-content-instance-key';
import { resolveProductSurfaceHeaderControlModel } from './product-surface-header-control-model';

describe('product surface content instance', () => {
  it('changes across scope or authority revision so stale local page state is remounted', () => {
    const current = {
      contextKey: 'context-1',
      surfaceKey: 'approvals.admin',
      contextScopeKey: 'scope-a',
      decisionRevision: 'revision-1',
    };

    expect(productSurfaceContentInstanceKey(current)).not.toBe(
      productSurfaceContentInstanceKey({ ...current, contextScopeKey: 'scope-b' })
    );
    expect(productSurfaceContentInstanceKey(current)).not.toBe(
      productSurfaceContentInstanceKey({ ...current, decisionRevision: 'revision-2' })
    );
  });
});

describe('management surface expiry indicator', () => {
  const serverNow = Date.parse('2026-08-24T01:00:00Z');

  it('warns once the server-clock deadline enters the final five minutes', () => {
    expect(resolveSurfaceExpiryIndicator('management', '2026-08-24T01:05:00Z', serverNow)).toEqual({
      state: 'warning',
    });
    expect(resolveSurfaceExpiryIndicator('management', '2026-08-24T01:10:00Z', serverNow)).toEqual({
      state: 'hidden',
      warningDelayMs: 5 * 60_000,
    });
  });

  it('never interrupts Work and fails expired/invalid management time closed', () => {
    expect(resolveSurfaceExpiryIndicator('work', 'not-a-time', serverNow)).toEqual({
      state: 'hidden',
    });
    expect(resolveSurfaceExpiryIndicator('management', '2026-08-24T00:59:59Z', serverNow)).toEqual({
      state: 'expired',
    });
    expect(resolveSurfaceExpiryIndicator('management', 'not-a-time', serverNow)).toEqual({
      state: 'expired',
    });
  });

  it('schedules warning to expiry and gives each live-region announcement a distinct key', () => {
    const warning = resolveSurfaceExpiryIndicator('management', '2026-08-24T01:05:00Z', serverNow);

    expect(resolveSurfaceExpiryTransitionDelay(warning, 5 * 60_000)).toBe(5 * 60_000);
    expect(surfaceExpiryAnnouncementKey('revision-1', '2026-08-24T01:05:00Z', 'warning')).not.toBe(
      surfaceExpiryAnnouncementKey('revision-1', '2026-08-24T01:05:00Z', 'expired')
    );
  });

  it('resets elapsed time when refreshed authority establishes a new trusted clock baseline', () => {
    const previousIdentity = surfaceExpiryClockIdentity(
      'revision-1',
      Date.parse('2026-08-24T01:00:00Z'),
      '2026-08-24T01:10:00Z'
    );
    const previousClock = { identity: previousIdentity, elapsedMs: 5 * 60_000 };
    const revalidateRefreshedIdentity = surfaceExpiryClockIdentity(
      'revision-1',
      Date.parse('2026-08-24T01:00:00Z'),
      '2026-08-24T01:18:00Z'
    );
    const refreshedIdentities = [
      surfaceExpiryClockIdentity(
        'revision-2',
        Date.parse('2026-08-24T01:00:00Z'),
        '2026-08-24T01:10:00Z'
      ),
      surfaceExpiryClockIdentity(
        'revision-1',
        Date.parse('2026-08-24T01:08:00Z'),
        '2026-08-24T01:10:00Z'
      ),
      revalidateRefreshedIdentity,
    ];

    for (const refreshedIdentity of refreshedIdentities) {
      expect(resolveSurfaceExpiryClockElapsed(previousClock, refreshedIdentity)).toBe(0);
      expect(resetSurfaceExpiryClock(previousClock, refreshedIdentity)).toEqual({
        identity: refreshedIdentity,
        elapsedMs: 0,
      });
    }

    const refreshedClock = resetSurfaceExpiryClock(previousClock, revalidateRefreshedIdentity);
    expect(advanceSurfaceExpiryClock(refreshedClock, previousIdentity, 60_000)).toBe(
      refreshedClock
    );
    expect(
      resolveSurfaceExpiryIndicator(
        'management',
        '2026-08-24T01:18:00Z',
        Date.parse('2026-08-24T01:08:00Z') +
          resolveSurfaceExpiryClockElapsed(refreshedClock, revalidateRefreshedIdentity)
      )
    ).toEqual({ state: 'hidden', warningDelayMs: 5 * 60_000 });
  });
});

describe('product surface header control model', () => {
  const work = {
    productId: 'calendar',
    surfaceId: 'calendar.work',
    plane: 'work' as const,
    labelKey: 'navigation.groups.calendar.start',
    path: '/calendar/home',
  };
  const management = {
    productId: 'calendar',
    surfaceId: 'calendar.management',
    plane: 'management' as const,
    labelKey: 'navigation.groups.calendar.admin',
    path: '/calendar/admin/overview',
  };

  it('does not project a single current Work surface as a redundant header link', () => {
    const managementEntry = { ...management, entryKind: 'management-entry' as const };

    expect(
      resolveProductSurfaceHeaderControlModel('calendar.work', [work, managementEntry])
    ).toEqual({
      current: work,
      currentPlane: 'work',
      samePlaneEntries: [work],
      transitionEntry: managementEntry,
    });
  });

  it('separates same-plane choices from the explicit Management transition', () => {
    const team = {
      ...work,
      productId: 'hcm',
      surfaceId: 'hcm.team',
      labelKey: 'navigation.groups.hcm.team',
      path: '/hr/team',
    };
    const personal = {
      ...work,
      productId: 'hcm',
      surfaceId: 'hcm.personal',
      labelKey: 'navigation.groups.hcm.personal',
      path: '/hr/home',
    };
    const managementEntry = {
      ...management,
      productId: 'hcm',
      surfaceId: 'hcm.management',
      path: '/hr/manage',
      entryKind: 'management-entry' as const,
    };

    expect(
      resolveProductSurfaceHeaderControlModel('hcm.personal', [personal, team, managementEntry])
    ).toMatchObject({
      currentPlane: 'work',
      samePlaneEntries: [personal, team],
      transitionEntry: managementEntry,
    });
  });

  it('exposes Management as state and keeps Work return as the opposite-plane action', () => {
    const workReturn = { ...work, entryKind: 'work-return' as const };

    expect(
      resolveProductSurfaceHeaderControlModel('calendar.management', [workReturn, management])
    ).toEqual({
      current: management,
      currentPlane: 'management',
      samePlaneEntries: [management],
      transitionEntry: workReturn,
    });
  });
});
