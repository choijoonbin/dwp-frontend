import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ProductRouteGuard, ProductWorkRouteGuard } from './route-support';
import { meetingsRoutes } from './meetings-routes';

import type { RouteObject } from 'react-router-dom';

function routeBySurfaceId(
  routes: readonly RouteObject[],
  surfaceId: string
): RouteObject | undefined {
  for (const route of routes) {
    const handle = route.handle as { surfaceId?: unknown } | undefined;
    if (handle?.surfaceId === surfaceId) return route;
    const child = routeBySurfaceId(route.children ?? [], surfaceId);
    if (child) return child;
  }
  return undefined;
}

function legacyShell(route: RouteObject | undefined): ReactNode {
  expect(isValidElement<{ legacy?: ReactNode }>(route?.element)).toBe(true);
  if (!isValidElement<{ legacy?: ReactNode }>(route?.element)) return null;
  return route.element.props.legacy;
}

describe('Meeting route shells', () => {
  it('keeps work entitlement and management authority as separate legacy boundaries', () => {
    const workLegacyShell = legacyShell(routeBySurfaceId(meetingsRoutes, 'meetings.work'));
    const managementLegacyShell = legacyShell(
      routeBySurfaceId(meetingsRoutes, 'meetings.management')
    );

    expect(isValidElement(workLegacyShell)).toBe(true);
    if (isValidElement<{ resourceKey?: string }>(workLegacyShell)) {
      expect(workLegacyShell.type).toBe(ProductWorkRouteGuard);
      expect(workLegacyShell.props.resourceKey).toBe('APP.MEETINGS');
    }

    expect(isValidElement(managementLegacyShell)).toBe(true);
    if (isValidElement<{ resourceKey?: string }>(managementLegacyShell)) {
      expect(managementLegacyShell.type).toBe(ProductRouteGuard);
      expect(managementLegacyShell.props.resourceKey).toBe('ADMIN.MEETINGS');
    }
  });

  it('keeps all three management pages DRAFT while the immutable registry has no exact slice', () => {
    const management = routeBySurfaceId(meetingsRoutes, 'meetings.management');
    const pages = (management?.children ?? []).filter((route) => {
      const handle = route.handle as { routeContractKey?: unknown } | undefined;
      return typeof handle?.routeContractKey === 'string';
    });

    expect(management?.handle).toMatchObject({
      surfaceId: 'meetings.management',
      productSurfaceLifecycle: 'DRAFT',
    });
    expect(pages.map((route) => route.path)).toEqual(['operations', 'policies', 'intelligence']);
    expect(pages.map((route) => route.handle)).toEqual([
      {
        routeContractKey: 'route.meetings.management.operations.page',
        productPageLifecycle: 'DRAFT',
      },
      {
        routeContractKey: 'route.meetings.management.policies.page',
        productPageLifecycle: 'DRAFT',
      },
      {
        routeContractKey: 'route.meetings.management.intelligence.page',
        productPageLifecycle: 'DRAFT',
      },
    ]);
  });
});
