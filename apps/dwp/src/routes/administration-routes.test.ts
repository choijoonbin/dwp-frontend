import { createElement, isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navigate } from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';

import {
  AdminLegacyRedirect,
  AdminRouteGuard,
  AdminSectionRedirect,
  SpacesAdminLegacyIndexRedirect,
  TenantAdminLegacyRedirect,
  TenantAdminRouteGuard,
  TenantAdminSectionRedirect,
  administrationRoutes,
} from './administration-routes';
import { routeFallback } from './route-support';

const routeMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
  useProviderSupportContext: vi.fn(),
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: routeMocks.useAuth,
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: routeMocks.usePermissions,
}));

vi.mock('@dwp-frontend/shared-utils/auth/provider-support-context', () => ({
  useProviderSupportContext: routeMocks.useProviderSupportContext,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterDom>()),
  useParams: routeMocks.useParams,
  useSearchParams: routeMocks.useSearchParams,
}));

function expectProviderRedirect(result: ReactNode) {
  expect(isValidElement(result)).toBe(true);
  if (!isValidElement<{ to: string; replace: boolean }>(result)) {
    throw new Error('Expected a Provider redirect element.');
  }
  expect(result.type).toBe(Navigate);
  expect(result.props).toMatchObject({ to: '/provider', replace: true });
}

function administrationRoute(path: string) {
  const matches = administrationRoutes.filter((route) => route.path === path);
  expect(matches, path).toHaveLength(1);
  return matches[0]!;
}

describe('administration identity-plane route boundary', () => {
  beforeEach(() => {
    routeMocks.useAuth.mockReturnValue({
      user: {
        identityPlane: 'PROVIDER',
        roles: ['PROVIDER_SUPPORT'],
        resourceRoles: [],
      },
    });
    routeMocks.usePermissions.mockReset();
    routeMocks.useProviderSupportContext.mockReset();
    routeMocks.useParams.mockReset();
    routeMocks.useSearchParams.mockReset();
  });

  it('redirects every Provider administration entry before authority or support resolution', () => {
    const results = [
      AdminRouteGuard({ children: createElement('span', null, 'admin') }),
      AdminLegacyRedirect(),
      AdminSectionRedirect(),
    ];

    results.forEach(expectProviderRedirect);
    expect(routeMocks.usePermissions).not.toHaveBeenCalled();
    expect(routeMocks.useProviderSupportContext).not.toHaveBeenCalled();
  });

  it('keeps tenant administration entries pending until permissions finish loading', () => {
    routeMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: ['ADMIN'], resourceRoles: [] },
    });
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: false,
      hasPermission: vi.fn(),
    });
    routeMocks.useParams.mockReturnValue({ section: 'spaces' });
    routeMocks.useSearchParams.mockReturnValue([new URLSearchParams()]);

    expect(TenantAdminRouteGuard({ children: createElement('span') })).toBe(routeFallback);
    expect(TenantAdminLegacyRedirect()).toBe(routeFallback);
    expect(TenantAdminSectionRedirect()).toBe(routeFallback);
  });

  it('resolves the top-level Spaces legacy index from its management authority', () => {
    const hasPermission = vi.fn(
      (resourceKey: string, permissionCode?: string) =>
        resourceKey === 'ADMIN.SPACE_TEMPLATES' &&
        (permissionCode === 'VIEW' || permissionCode === 'MANAGE')
    );
    routeMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: ['SPACE_TEMPLATE_ADMIN'], resourceRoles: [] },
    });
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: true,
      hasPermission,
    });
    const result = SpacesAdminLegacyIndexRedirect();

    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ to: string; replace: boolean }>(result)) {
      throw new Error('Expected a Spaces management redirect element.');
    }
    expect(result.type).toBe(Navigate);
    expect(result.props).toMatchObject({ to: '/spaces/admin/templates', replace: true });
    expect(administrationRoute('admin/spaces').handle).toMatchObject({
      productSurfaceId: 'spaces.management',
      productPageLifecycle: 'DRAFT',
      legacyProductIndex: true,
    });
  });
});

describe('administration product legacy route lifecycle', () => {
  it('preserves exact boundaries for official targets and legacy guards for DRAFT targets', () => {
    expect(administrationRoute('admin/experience/announcements').handle).toMatchObject({
      routeContractKey: 'route.communications.management.content.page',
      productPageLifecycle: 'OFFICIAL',
    });
    expect(administrationRoute('admin/spaces/operations').handle).toMatchObject({
      routeContractKey: 'route.spaces.management.operations.page',
      productPageLifecycle: 'DRAFT',
    });
    expect(administrationRoute('admin/spaces/templates').handle).toMatchObject({
      routeContractKey: 'route.spaces.management.templates.page',
      productPageLifecycle: 'DRAFT',
    });
  });
});
