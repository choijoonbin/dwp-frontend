import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navigate, type RouteObject } from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';

import { WORK_NAVIGATION } from '../features/work/work-navigation';
import { workRoutes } from './work-routes';

const routeMocks = vi.hoisted(() => ({
  useLocation: vi.fn(),
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

describe('Work information architecture', () => {
  beforeEach(() => {
    routeMocks.useLocation.mockReset();
  });

  it('exposes only the unified queue in the Work navigation', () => {
    expect(WORK_NAVIGATION).toHaveLength(1);
    expect(WORK_NAVIGATION[0]).toMatchObject({
      id: 'work',
      items: [{ view: 'queue', path: '/work/queue' }],
    });
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
