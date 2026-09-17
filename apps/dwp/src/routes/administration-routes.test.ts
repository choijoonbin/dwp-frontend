import { createElement, isValidElement, Suspense, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navigate } from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';

import {
  AdminLegacyRedirect,
  AdminHomeStudioRouteGuard,
  AdminHomeLegacyRedirect,
  AdminRouteGuard,
  AdminSectionRedirect,
  ProductApplicationRedirect,
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
  useLocation: vi.fn(),
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
  useLocation: routeMocks.useLocation,
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
    routeMocks.useLocation.mockReturnValue({
      pathname: '/admin/spaces',
      search: '?state=draft',
      hash: '#catalog',
    });
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

  it('renders the authorized tenant settings home when no legacy view is requested', () => {
    routeMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: ['ADMIN'], resourceRoles: [] },
    });
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: true,
      hasPermission: vi.fn(() => true),
    });
    routeMocks.useSearchParams.mockReturnValue([new URLSearchParams()]);

    const result = TenantAdminLegacyRedirect();
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement(result)) throw new Error('Expected the tenant settings home element.');
    expect(result.type).toBe(Suspense);
  });

  it('keeps the settings home closed when no administration item is authorized', () => {
    routeMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: [], resourceRoles: [] },
    });
    routeMocks.usePermissions.mockReturnValue({
      permissions: [],
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });
    routeMocks.useSearchParams.mockReturnValue([new URLSearchParams()]);

    const result = TenantAdminLegacyRedirect();
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ to: string; replace: boolean }>(result)) {
      throw new Error('Expected an access-denied redirect.');
    }
    expect(result.type).toBe(Navigate);
    expect(result.props).toMatchObject({ to: '/403', replace: true });
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
    if (!isValidElement<{ target: string }>(result)) {
      throw new Error('Expected a Spaces management redirect element.');
    }
    expect(result.type).toBe(ProductApplicationRedirect);
    expect(result.props).toMatchObject({
      target: '/spaces/admin/templates?state=draft#catalog',
    });
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

describe('Home Studio administration route boundary', () => {
  it('keeps the common shell and every legacy entry under the guarded admin parent', () => {
    const admin = administrationRoute('admin');
    const children = admin.children ?? [];
    const paths = children.map((route) => route.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        'experience/home',
        'experience/home/:studioSection',
        'experience/home-experience',
        'experience/home-composition',
        'experience/home-apps',
      ])
    );
    expect(
      administrationRoutes.filter((route) => route.path?.startsWith('admin/experience/home'))
    ).toHaveLength(0);
  });

  it('requires exact VIEW authority for direct entry and does not infer it from MANAGE', () => {
    const child = createElement('span', null, 'home studio');
    const hasView = vi.fn(
      (resourceKey: string, permissionCode?: string) =>
        resourceKey === 'ADMIN.HOME_EXPERIENCE' && permissionCode === 'VIEW'
    );
    routeMocks.usePermissions.mockReturnValue({ isLoaded: true, hasPermission: hasView });
    expect(AdminHomeStudioRouteGuard({ children: child })).toBe(child);

    const hasManageOnly = vi.fn(
      (resourceKey: string, permissionCode?: string) =>
        resourceKey === 'ADMIN.HOME_EXPERIENCE' && permissionCode === 'MANAGE'
    );
    routeMocks.usePermissions.mockReturnValue({ isLoaded: true, hasPermission: hasManageOnly });
    const denied = AdminHomeStudioRouteGuard({ children: child });
    expect(isValidElement(denied)).toBe(true);
    if (!isValidElement<{ to: string; replace: boolean }>(denied)) {
      throw new Error('Expected a forbidden redirect element.');
    }
    expect(denied.type).toBe(Navigate);
    expect(denied.props).toMatchObject({ to: '/403', replace: true });
  });

  it.each([
    ['catalog', '/admin/experience/home/widgets'],
    ['blueprints', '/admin/experience/home/templates'],
    ['policy', '/admin/experience/home/modes'],
  ])('maps legacy composition tab %s into the common shell', (tab, destination) => {
    routeMocks.useSearchParams.mockReturnValue([new URLSearchParams({ tab })]);
    const redirect = AdminHomeLegacyRedirect({ view: 'composition' });
    expect(isValidElement(redirect)).toBe(true);
    if (!isValidElement<{ to: string; replace: boolean }>(redirect)) {
      throw new Error('Expected a Home Studio legacy redirect element.');
    }
    expect(redirect.type).toBe(Navigate);
    expect(redirect.props).toMatchObject({ to: destination, replace: true });
  });
});
