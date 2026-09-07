import fs from 'node:fs';
import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { approvalsRoutes } from './approvals-routes';
import { calendarRoutes } from './calendar-routes';
import { communicationsRoutes } from './communications-routes';
import { dwaionRoutes } from './dwaion-routes';
import { hcmRoutes } from './hcm-routes';
import { mailRoutes } from './mail-routes';
import { meetingsRoutes } from './meetings-routes';
import { messagingRoutes } from './messaging-routes';
import { notificationRoutes } from './notification-routes';
import { roomsRoutes } from './rooms-routes';
import { ProductAnyRouteGuard, ProductRouteGuard, ProductWorkRouteGuard } from './route-support';
import { servicesRoutes } from './services-routes';
import { spacesRoutes } from './spaces-routes';

import type { RouteObject } from 'react-router-dom';

type GuardProps = {
  productId?: string;
  resourceKey?: string;
  authorities?: readonly { resourceKey: string; permissionCode: string }[];
  legacy?: ReactNode;
  surfaceId?: string;
};

function routeBySurfaceId(
  routes: readonly RouteObject[],
  surfaceId: string
): RouteObject | undefined {
  for (const route of routes) {
    if (isValidElement<GuardProps>(route.element) && route.element.props.surfaceId === surfaceId) {
      return route;
    }
    const nested = routeBySurfaceId(route.children ?? [], surfaceId);
    if (nested) return nested;
  }
  return undefined;
}

function legacyGuard(routes: readonly RouteObject[], surfaceId: string) {
  const route = routeBySurfaceId(routes, surfaceId);
  expect(route, `missing route for ${surfaceId}`).toBeDefined();
  expect(isValidElement<GuardProps>(route?.element)).toBe(true);
  if (!isValidElement<GuardProps>(route?.element)) return null;
  const legacy = route.element.props.legacy;
  expect(isValidElement<GuardProps>(legacy), `missing legacy guard for ${surfaceId}`).toBe(true);
  return isValidElement<GuardProps>(legacy) ? legacy : null;
}

function childElement(node: ReactNode): ReactNode {
  return isValidElement<{ children?: ReactNode }>(node) ? node.props.children : null;
}

function expectSingleAuthority(
  routes: readonly RouteObject[],
  surfaceId: string,
  resourceKey: string
) {
  const guard = legacyGuard(routes, surfaceId);
  expect(guard?.type).toBe(ProductRouteGuard);
  expect(guard?.props.resourceKey).toBe(resourceKey);
}

function expectAnyAuthority(
  routes: readonly RouteObject[],
  surfaceId: string,
  resourceKeys: readonly string[]
) {
  const guard = legacyGuard(routes, surfaceId);
  expect(guard?.type).toBe(ProductAnyRouteGuard);
  expect(guard?.props.authorities?.map(({ resourceKey }) => resourceKey)).toEqual(resourceKeys);
}

describe('product Management legacy shell separation', () => {
  it('requires every two-surface caller to provide a dedicated Management shell', () => {
    const source = fs.readFileSync(
      new URL('./two-surface-product-routes.tsx', import.meta.url),
      'utf8'
    );
    expect(source).toContain('managementLegacyShell: ReactNode');
    expect(source).not.toContain('managementLegacyShell?: ReactNode');
    expect(source).not.toContain('managementLegacyShell = legacyShell');
  });

  it('binds single-authority Management surfaces to their ADMIN resource', () => {
    expectSingleAuthority(calendarRoutes, 'calendar.management', 'ADMIN.CALENDAR');
    expectSingleAuthority(mailRoutes, 'mail.management', 'ADMIN.MAIL');
    expectSingleAuthority(meetingsRoutes, 'meetings.management', 'ADMIN.MEETINGS');
    expectSingleAuthority(messagingRoutes, 'messaging.management', 'ADMIN.MESSAGING');
    expectSingleAuthority(
      communicationsRoutes,
      'communications.management',
      'ADMIN.COMMUNICATIONS'
    );
  });

  it('requires explicit APP entitlement for every governed Work compatibility shell', () => {
    for (const [routes, surfaceId, resourceKey] of [
      [approvalsRoutes, 'approvals.work', 'APP.APPROVALS'],
      [calendarRoutes, 'calendar.work', 'APP.CALENDAR'],
      [communicationsRoutes, 'communications.work', 'APP.COMMUNICATIONS'],
      [dwaionRoutes, 'dwaion.work', 'APP.ASK'],
      [mailRoutes, 'mail.work', 'APP.MAIL'],
      [meetingsRoutes, 'meetings.work', 'APP.MEETINGS'],
      [messagingRoutes, 'messaging.work', 'APP.MESSAGING'],
      [notificationRoutes, 'notifications.work', 'APP.NOTIFICATIONS'],
      [roomsRoutes, 'workplace.work', 'APP.WORKPLACE'],
      [servicesRoutes, 'services.work', 'APP.EMPLOYEE_SERVICES'],
      [spacesRoutes, 'spaces.work', 'APP.SPACES'],
    ] as const) {
      const guard = legacyGuard(routes, surfaceId);
      expect(guard?.type, surfaceId).toBe(ProductWorkRouteGuard);
      expect(guard?.props.productId, surfaceId).toBe(surfaceId.split('.')[0]);
      expect(guard?.props.resourceKey, surfaceId).toBe(resourceKey);
      expect(guard?.props.surfaceId, surfaceId).toBe(surfaceId);
    }

    const askRoute = dwaionRoutes.find((route) => route.path === 'ask');
    const workspaceGuard = childElement(askRoute?.element);
    const productGuard = childElement(workspaceGuard);
    expect(isValidElement<GuardProps>(productGuard)).toBe(true);
    if (isValidElement<GuardProps>(productGuard)) {
      expect(productGuard.type).toBe(ProductWorkRouteGuard);
      expect(productGuard.props.productId).toBe('dwaion');
      expect(productGuard.props.resourceKey).toBe('APP.ASK');
      expect(productGuard.props.surfaceId).toBe('dwaion.work');
    }
  });

  it('binds multi-authority Management surfaces without requiring the Work app', () => {
    expectAnyAuthority(approvalsRoutes, 'approvals.admin', [
      'ADMIN.APPROVAL_OPERATIONS',
      'ADMIN.APPROVAL_DESIGN',
      'ADMIN.APPROVAL_POLICY',
      'ADMIN.APPROVAL_SIGNATURE',
    ]);
    expectAnyAuthority(servicesRoutes, 'services.management', [
      'ADMIN.SERVICE_CATALOG',
      'ADMIN.SERVICE_OPERATIONS',
    ]);
    expectAnyAuthority(notificationRoutes, 'notifications.management', [
      'ADMIN.NOTIFICATION_OPERATIONS',
      'ADMIN.NOTIFICATION_CONTRACT',
      'ADMIN.NOTIFICATION_POLICY',
      'ADMIN.NOTIFICATION_TEMPLATE',
    ]);
    expectAnyAuthority(dwaionRoutes, 'dwaion.management', [
      'ADMIN.DWAION_OPERATIONS',
      'ADMIN.DWAION_AGENTS',
      'ADMIN.DWAION_SOURCES',
      'ADMIN.DWAION_ACTIONS',
      'ADMIN.DWAION_SAFETY',
      'ADMIN.DWAION_EVALUATION',
      'ADMIN.DWAION_GATES',
      'ADMIN.DWAION_RETENTION',
      'ADMIN.DWAION_AUDIT',
    ]);
    expectAnyAuthority(roomsRoutes, 'workplace.management', ['ADMIN.WORKPLACE', 'ADMIN.ROOMS']);
    expectAnyAuthority(spacesRoutes, 'spaces.management', [
      'ADMIN.SPACE_GOVERNANCE',
      'ADMIN.SPACE_TEMPLATES',
      'ADMIN.SPACE_COMPLIANCE',
      'ADMIN.SPACE_ACCESS_REVIEW',
    ]);
  });

  it('uses surface-aware HCM legacy guards for every entitlement-independent surface', () => {
    for (const surfaceId of ['hcm.personal', 'hcm.team', 'hcm.operations', 'hcm.management']) {
      const guard = legacyGuard(hcmRoutes, surfaceId);
      expect(guard?.props.surfaceId).toBe(surfaceId);
    }
  });
});
