import { describe, expect, it } from 'vitest';

import { findRoomsNavigationItem, ROOMS_NAVIGATION } from '../features/rooms/rooms-navigation';
import { resolveLegacyWorkplacePlannerLocation } from '../features/rooms/workplace-planner-url-state';
import {
  resolveLegacyRoomsPath,
  resolveLegacyWorkplaceFindLocation,
  resolveLegacyWorkplaceReservationsLocation,
  roomsRoutes,
} from './rooms-routes';

import type { RouteObject } from 'react-router-dom';

function routeContractKeys(routes: readonly RouteObject[]): string[] {
  return routes.flatMap((route) => {
    const handle = route.handle as { routeContractKey?: unknown } | undefined;
    return [
      ...(typeof handle?.routeContractKey === 'string' ? [handle.routeContractKey] : []),
      ...routeContractKeys(route.children ?? []),
    ];
  });
}

describe('legacy Rooms route resolver', () => {
  it('canonicalizes case-insensitive registered aliases without accepting unknown targets', () => {
    expect(resolveLegacyRoomsPath('/ROOMS')).toBe('/workplace/home');
    expect(resolveLegacyRoomsPath('/ROOMS/ADMIN/OVERVIEW')).toBe('/workplace/admin/overview');
    expect(resolveLegacyRoomsPath('/ROOMS/UNKNOWN')).toBeUndefined();
  });
});

describe('legacy Workplace discovery redirects', () => {
  it('preserves allowed Explore state and the hash while migrating canonical field names', () => {
    expect(
      resolveLegacyWorkplaceFindLocation(
        '?site=site-1&floor=floor-1&time=09%3A30&timeZone=Asia%2FSeoul&type=DESK&q=quiet&token=secret',
        '#resource',
        'explore'
      )
    ).toEqual({
      pathname: '/workplace/find',
      search: '?v=1&start=09%3A30&tz=Asia%2FSeoul&sites=site-1&floors=floor-1&types=DESK&q=quiet',
      hash: '#resource',
    });
  });

  it('forces the Rooms alias to the room source instead of accepting a conflicting type', () => {
    expect(resolveLegacyWorkplaceFindLocation('?type=DESK&view=map', '', 'rooms')).toEqual({
      pathname: '/workplace/find',
      search: '?v=1&types=ROOM&view=map',
      hash: '',
    });
  });

  it('publishes one canonical menu item and keeps the legacy Explore contract redirectable', () => {
    expect(findRoomsNavigationItem('/workplace/find')).toMatchObject({
      view: 'find',
      requiredResourceKey: 'APP.WORKPLACE',
      requiredPermissionCode: 'VIEW',
    });
    expect(ROOMS_NAVIGATION.flatMap((group) => group.items).map((item) => item.path)).not.toEqual(
      expect.arrayContaining(['/workplace/explore', '/workplace/rooms'])
    );
    expect(routeContractKeys(roomsRoutes)).toEqual(
      expect.arrayContaining([
        'route.workplace.work.find.page',
        'route.workplace.work.reservations.page',
        'route.workplace.work.explore.page',
      ])
    );
  });
});

describe('legacy Workplace reservation redirects', () => {
  it('preserves the Workplace booking detail and hash on the canonical timeline', () => {
    expect(
      resolveLegacyWorkplaceReservationsLocation(
        '?booking=desk%2F1&period=TODAY',
        '#detail',
        'my-bookings'
      )
    ).toEqual({
      pathname: '/workplace/reservations',
      search:
        '?v=1&period=TODAY&types=WORKSPACE&status=ACTIVE&authority=WORKPLACE&reservation=desk%2F1&reservationAuthority=WORKPLACE',
      hash: '#detail',
    });
  });

  it('preserves the Calendar event detail without changing its command authority', () => {
    expect(
      resolveLegacyWorkplaceReservationsLocation('?event=event%2F1', '', 'my-meetings')
    ).toEqual({
      pathname: '/workplace/reservations',
      search:
        '?v=1&period=UPCOMING&types=MEETING&status=ACTIVE&authority=CALENDAR&reservation=event%2F1&reservationAuthority=CALENDAR',
      hash: '',
    });
  });

  it('publishes one canonical reservation menu item and removes both legacy entries', () => {
    expect(findRoomsNavigationItem('/workplace/reservations')).toMatchObject({
      view: 'reservations',
      requiredResourceKey: 'APP.WORKPLACE',
    });
    expect(ROOMS_NAVIGATION.flatMap((group) => group.items).map((item) => item.path)).not.toEqual(
      expect.arrayContaining(['/workplace/my-bookings', '/workplace/my-meetings'])
    );
  });
});

describe('Workplace weekly planner route', () => {
  it('moves the legacy Find mode to one canonical planner route with query and hash state', () => {
    expect(
      resolveLegacyWorkplacePlannerLocation(
        '?mode=PLANNER&date=2026-09-16&sites=site-1&types=DESK',
        '#review',
        { referenceDate: '2026-09-16' }
      )
    ).toEqual({
      pathname: '/workplace/planner',
      search:
        '?v=1&week=2026-09-14&dates=2026-09-14%2C2026-09-15%2C2026-09-16%2C2026-09-17%2C2026-09-18&start=09%3A00&duration=540&tz=Asia%2FSeoul&target=SELF&site=site-1&types=DESK&step=PLAN',
      hash: '#review',
    });
  });

  it('publishes the planner once and binds its PAGE contract into the Workplace tree', () => {
    expect(findRoomsNavigationItem('/workplace/planner')).toMatchObject({
      view: 'planner',
      requiredResourceKey: 'APP.WORKPLACE',
      requiredPermissionCode: 'VIEW',
    });
    expect(
      ROOMS_NAVIGATION.flatMap((group) => group.items).filter(
        (item) => item.path === '/workplace/planner'
      )
    ).toHaveLength(1);
    expect(routeContractKeys(roomsRoutes)).toContain('route.workplace.work.planner.page');
  });
});

describe('Workplace Screens 17–23 production reachability', () => {
  const navigationItems = ROOMS_NAVIGATION.flatMap((group) => group.items);

  it('publishes the 28 canonical human menu entries exactly once', () => {
    expect(navigationItems).toHaveLength(28);
    expect(new Set(navigationItems.map((item) => item.path)).size).toBe(28);
    expect(navigationItems.map((item) => item.path)).toEqual(
      expect.arrayContaining([
        '/workplace/navigation',
        '/workplace/assistant',
        '/workplace/admin/devices',
        '/workplace/admin/service-providers',
        '/workplace/admin/space-planning',
        '/workplace/admin/assistant-governance',
      ])
    );
  });

  it('binds every new human page to one official route contract', () => {
    const keys = routeContractKeys(roomsRoutes);
    [
      'route.workplace.work.wayfinding.page',
      'route.workplace.work.assistant.page',
      'route.workplace.work.safety.page',
      'route.workplace.management.devices.page',
      'route.workplace.management.service-providers.page',
      'route.workplace.management.space-planning.page',
      'route.workplace.management.assistant-governance.page',
      'route.workplace.management.governance.page',
    ].forEach((key) => expect(keys.filter((candidate) => candidate === key)).toHaveLength(1));
  });

  it('keeps connector operations nested and device displays outside the human AuthGuard tree', () => {
    expect(navigationItems.map((item) => item.path)).not.toEqual(
      expect.arrayContaining([
        '/workplace/admin/connectors',
        '/workplace/kiosk',
        '/device/workplace/devices/:deviceId/display',
      ])
    );
    expect(roomsRoutes.some((route) => route.path === 'workplace/kiosk')).toBe(true);
    expect(
      roomsRoutes.some((route) => route.path === 'device/workplace/devices/:deviceId/display')
    ).toBe(true);
  });
});
