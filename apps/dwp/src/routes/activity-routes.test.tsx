import {
  cloneElement,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductRouteGuard } from './route-support';
import { activityRoutes } from './activity-routes';

const routeMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: routeMocks.useAuth,
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: routeMocks.usePermissions,
}));

function elementChild(element: ReactNode): ReactElement<{ children?: ReactNode }> {
  expect(isValidElement(element)).toBe(true);
  return element as ReactElement<{ children?: ReactNode }>;
}

function activityBoundary() {
  const authBoundary = elementChild(activityRoutes[0]?.element);
  const workspaceBoundary = elementChild(authBoundary.props.children);
  const permissionBoundary = elementChild(workspaceBoundary.props.children);
  expect(permissionBoundary.type).toBe(ProductRouteGuard);
  expect(permissionBoundary.props).toMatchObject({
    resourceKey: 'APP.ACTIVITY',
    permissionCode: 'VIEW',
  });
  return cloneElement(
    permissionBoundary,
    undefined,
    createElement('span', { 'data-testid': 'activity-content' }, 'Activity')
  );
}

function renderActivityBoundary() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: ['/activity'] }, activityBoundary())
  );
}

describe('Activity route permission boundary', () => {
  beforeEach(() => {
    routeMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: [], resourceRoles: [] },
    });
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });
  });

  it('fails closed when the application permission list is empty', () => {
    expect(renderActivityBoundary()).not.toContain('data-testid="activity-content"');
  });

  it.each(['VIEW', 'MANAGE'])('accepts an explicit APP.ACTIVITY:%s grant', (permissionCode) => {
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: true,
      hasPermission: vi.fn(
        (resourceKey: string, requestedCode: string) =>
          resourceKey === 'APP.ACTIVITY' && requestedCode === permissionCode
      ),
    });

    expect(renderActivityBoundary()).toContain('data-testid="activity-content"');
  });

  it('fails closed for an explicit deny or an unrelated application grant', () => {
    routeMocks.usePermissions.mockReturnValue({
      permissions: [
        {
          resourceType: 'APP',
          resourceKey: 'APP.ACTIVITY',
          permissionCode: 'VIEW',
          effect: 'DENY',
        },
        {
          resourceType: 'APP',
          resourceKey: 'APP.WORK',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
        },
      ],
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });

    expect(renderActivityBoundary()).not.toContain('data-testid="activity-content"');
  });

  it('keeps provider identities outside the tenant Activity route', () => {
    routeMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'PROVIDER', roles: [], resourceRoles: [] },
    });
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: false,
      hasPermission: vi.fn(() => true),
    });

    expect(renderActivityBoundary()).not.toContain('data-testid="activity-content"');
  });
});
