import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
import { communicationsRoutes } from './communications-routes';

import type { ReactElement, ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { GovernedProductAreaNavigationItem } from '../layouts/product-area-permissions';

const accessMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
  useProviderSupportContext: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: accessMocks.useAuth,
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: accessMocks.usePermissions,
}));

vi.mock('@dwp-frontend/shared-utils/auth/provider-support-context', () => ({
  useProviderSupportContext: accessMocks.useProviderSupportContext,
}));

vi.mock('../components/product-surface-access-state', () => ({
  ProductSurfaceAccessState: ({ decision }: { decision: { state: string } }) =>
    `access:${decision.state}`,
}));

function routeByContractKey(routes: readonly RouteObject[], routeContractKey: string): RouteObject {
  for (const route of routes) {
    if (
      (route.handle as { routeContractKey?: string } | undefined)?.routeContractKey ===
      routeContractKey
    ) {
      return route;
    }
    if (route.children) {
      try {
        return routeByContractKey(route.children, routeContractKey);
      } catch {
        // Continue searching sibling route branches.
      }
    }
  }
  throw new Error(`Missing route contract: ${routeContractKey}`);
}

function legacyPageGuard(routeContractKey: string) {
  const route = routeByContractKey(communicationsRoutes, routeContractKey);
  if (!isValidElement(route.element)) throw new Error(`Missing boundary: ${routeContractKey}`);
  const legacy = (route.element.props as { legacy?: ReactNode }).legacy;
  if (!isValidElement(legacy)) throw new Error(`Missing legacy page guard: ${routeContractKey}`);
  return legacy as ReactElement<{
    item: GovernedProductAreaNavigationItem & { path: string };
  }>;
}

describe('Communications legacy PAGE access', () => {
  beforeEach(() => {
    accessMocks.useAuth.mockReturnValue({ user: { roles: ['PROVIDER_SUPPORT'] } });
    accessMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => true),
    });
    accessMocks.useProviderSupportContext.mockReturnValue({
      isLoading: false,
      data: { scopes: ['TENANT_CONFIGURATION_READ'] },
    });
  });

  it('wraps every 000/100 Work PAGE route with the same item guard used by the sidebar', () => {
    const routeContractKeys = [
      'route.communications.work.home.page',
      ...(['for-you', 'all', 'required', 'saved'] as const).flatMap((view) => [
        `route.communications.work.${view}.page`,
        `route.communications.work.${view}-story.page`,
      ]),
    ];

    for (const routeContractKey of routeContractKeys) {
      expect(legacyPageGuard(routeContractKey).type).toBe(ProductAreaNavigationItemAccessGuard);
    }
  });

  it('denies the actual /communications/home legacy deep link for tenant-configuration support', () => {
    const guard = legacyPageGuard('route.communications.work.home.page');

    expect(guard.props.item.path).toBe('/communications/home');
    expect(renderToStaticMarkup(guard)).toContain('access:support-scope-denied');
  });
});
