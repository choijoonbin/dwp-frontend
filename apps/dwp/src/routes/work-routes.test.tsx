import {
  cloneElement,
  createElement,
  isValidElement,
  Suspense,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Navigate, type RouteObject } from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';

import { WORK_NAVIGATION } from '../features/work/work-navigation';
import { WORK_HUB_VIEWS } from '../features/work-hub/work-hub-view-contract';
import { ProductRouteGuard } from './route-support';
import { workRoutes } from './work-routes';

const routeMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useLocation: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: routeMocks.useAuth,
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: routeMocks.usePermissions,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterDom>()),
  useLocation: routeMocks.useLocation,
}));

function workChild(predicate: (route: RouteObject) => boolean): RouteObject {
  const route = workRoutes[0]?.children?.find(predicate);
  expect(route).toBeDefined();
  return route!;
}

function elementChild(element: ReactNode): ReactElement<{ children?: ReactNode }> {
  expect(isValidElement(element)).toBe(true);
  return element as ReactElement<{ children?: ReactNode }>;
}

function redirectFor(route: RouteObject, search: string): ReactNode {
  routeMocks.useLocation.mockReturnValue({ search });
  const element = route.element;
  expect(isValidElement(element)).toBe(true);
  if (!isValidElement(element) || typeof element.type !== 'function') {
    throw new Error('Expected a Work queue redirect component.');
  }
  const RedirectComponent = element.type as (props: unknown) => ReactNode;
  return RedirectComponent(element.props);
}

function expectQueueRedirect(route: RouteObject, search: string) {
  const result = redirectFor(route, search);
  expect(isValidElement(result)).toBe(true);
  if (!isValidElement<{ replace: boolean; to: { pathname: string; search: string } }>(result)) {
    throw new Error('Expected a Work queue redirect element.');
  }
  expect(result.type).toBe(Navigate);
  expect(result.props).toEqual({
    replace: true,
    to: { pathname: '/work/queue', search },
  });
}

function workPermissionBoundary() {
  const authBoundary = elementChild(workRoutes[0]?.element);
  const workspaceBoundary = elementChild(authBoundary.props.children);
  const permissionBoundary = elementChild(workspaceBoundary.props.children);
  expect(permissionBoundary.type).toBe(ProductRouteGuard);
  expect(permissionBoundary.props).toMatchObject({
    resourceKey: 'APP.WORK',
    permissionCode: 'VIEW',
  });
  return cloneElement(
    permissionBoundary,
    undefined,
    createElement('span', { 'data-testid': 'work-content' }, 'Work')
  );
}

function renderWorkPermissionBoundary() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: ['/work/queue'] }, workPermissionBoundary())
  );
}

describe('Work information architecture', () => {
  beforeEach(() => {
    routeMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: [], resourceRoles: [] },
    });
    routeMocks.useLocation.mockReset();
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });
  });

  it('exposes the six designed Work destinations as distinct routes', () => {
    expect(WORK_NAVIGATION).toHaveLength(1);
    expect(WORK_NAVIGATION[0].items.map(({ view, path }) => ({ view, path }))).toEqual(
      WORK_HUB_VIEWS.map(({ view, path }) => ({ view, path }))
    );
    expect(WORK_NAVIGATION[0].items).toHaveLength(6);
    for (const { view } of WORK_HUB_VIEWS) {
      expect(workChild((route) => route.path === view).element).toBeDefined();
    }
  });

  it('keeps the Work shell behind an accessible route loading boundary', () => {
    const authBoundary = elementChild(workRoutes[0]?.element);
    const workspaceBoundary = elementChild(authBoundary.props.children);
    const appBoundary = elementChild(workspaceBoundary.props.children);
    const loadingBoundary = elementChild(appBoundary.props.children);
    const lazyLayout = elementChild(loadingBoundary.props.children);

    expect(loadingBoundary.type).toBe(Suspense);
    expect((lazyLayout.type as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for('react.lazy'));
  });

  it('fails closed when the application permission list is empty', () => {
    expect(renderWorkPermissionBoundary()).not.toContain('data-testid="work-content"');
  });

  it.each(['VIEW', 'MANAGE'])('accepts an explicit APP.WORK:%s grant', (permissionCode) => {
    routeMocks.usePermissions.mockReturnValue({
      permissions: [
        {
          resourceType: 'APP',
          resourceKey: 'APP.WORK',
          permissionCode,
          effect: 'ALLOW',
        },
      ],
      isLoaded: true,
      hasPermission: vi.fn(
        (resourceKey: string, requestedCode: string) =>
          resourceKey === 'APP.WORK' && requestedCode === permissionCode
      ),
    });

    expect(renderWorkPermissionBoundary()).toContain('data-testid="work-content"');
  });

  it('fails closed for an explicit deny or an unrelated application grant', () => {
    routeMocks.usePermissions.mockReturnValue({
      permissions: [
        {
          resourceType: 'APP',
          resourceKey: 'APP.WORK',
          permissionCode: 'VIEW',
          effect: 'DENY',
        },
        {
          resourceType: 'APP',
          resourceKey: 'APP.CALENDAR',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
        },
      ],
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });

    expect(renderWorkPermissionBoundary()).not.toContain('data-testid="work-content"');
  });

  it('keeps provider identities outside the tenant Work route', () => {
    routeMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'PROVIDER', roles: [], resourceRoles: [] },
    });
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: false,
      hasPermission: vi.fn(() => true),
    });

    expect(renderWorkPermissionBoundary()).not.toContain('data-testid="work-content"');
  });

  it('converges the Work index on the queue and preserves compatibility search params', () => {
    expectQueueRedirect(
      workChild((route) => route.index === true),
      '?item=approval-17&source=legacy'
    );
  });

  it('converges the legacy Work home on the queue and preserves compatibility search params', () => {
    expectQueueRedirect(
      workChild((route) => route.path === 'home'),
      '?view=mine&filter=overdue'
    );
  });

  it('converges unknown Work children on the queue and preserves compatibility search params', () => {
    expectQueueRedirect(
      workChild((route) => route.path === '*'),
      '?item=service-42&returnTo=work'
    );
  });
});
