import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AllowedProductSurfaceProvider } from '../features/shell/allowed-product-surface-context';
import { ProductAreaNavigationItemAccessGuard } from './product-area-navigation-access-guard';

import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';
import type { GovernedProductAreaNavigationItem } from './product-area-permissions';
import type { ComponentProps } from 'react';

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
    createElement('span', { 'data-access-state': decision.state }, decision.state),
}));

const scope = {
  key: 'opaque-scope',
  kind: 'RESOURCE_SET' as const,
  displayName: 'Assigned area',
  isDefault: true,
  readOnly: false,
};

const exactManagementDecision: AllowedSurfaceDecision = {
  state: 'allowed',
  context: {
    contextKey: 'sample-management',
    productKey: 'sample',
    surfaceKey: 'sample.management',
    plane: 'management',
    accessMode: 'NORMAL',
    accessSource: 'MANAGEMENT',
    appResourceKey: 'APP.SAMPLE',
    effectiveGrants: [],
    scopes: [scope],
    revalidateAt: '2030-01-01T00:00:00Z',
  },
  routeGrantRef: 'route.sample.management.page',
  scope,
  effectiveReadOnly: false,
  revalidateAt: '2030-01-01T00:00:00Z',
  decisionRevision: 'revision-1',
};

function renderNavigationGuard(
  item: GovernedProductAreaNavigationItem,
  boundaryKind: 'surface' | 'exact-route'
) {
  const providerProps = {
    decision: exactManagementDecision,
    boundaryKind,
  } as ComponentProps<typeof AllowedProductSurfaceProvider>;
  const guardProps = { item } as ComponentProps<typeof ProductAreaNavigationItemAccessGuard>;
  return renderToStaticMarkup(
    createElement(
      AllowedProductSurfaceProvider,
      providerProps,
      createElement(
        ProductAreaNavigationItemAccessGuard,
        guardProps,
        createElement('span', { 'data-testid': 'page' }, 'page')
      )
    )
  );
}

describe('legacy navigation guard under exact product PAGE authority', () => {
  beforeEach(() => {
    accessMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: [], resourceRoles: [] },
    });
    accessMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });
    accessMocks.useProviderSupportContext.mockReturnValue({ isLoading: false, data: undefined });
  });

  it('keeps the exact server-authorized ADMIN page visible without a legacy permission', () => {
    expect(
      renderNavigationGuard(
        { requiredResourceKey: 'ADMIN.SAMPLE', requiredPermissionCode: 'VIEW' },
        'exact-route'
      )
    ).toContain('data-testid="page"');
  });

  it('keeps Surface-only and mixed APP authority checks on the legacy deny path', () => {
    expect(
      renderNavigationGuard(
        { requiredResourceKey: 'ADMIN.SAMPLE', requiredPermissionCode: 'VIEW' },
        'surface'
      )
    ).toContain('data-access-state="route-denied"');
    expect(
      renderNavigationGuard(
        {
          requiredAnyAuthorities: [
            { resourceKey: 'ADMIN.SAMPLE', permissionCode: 'VIEW' },
            { resourceKey: 'APP.SAMPLE', permissionCode: 'VIEW' },
          ],
        },
        'exact-route'
      )
    ).toContain('data-access-state="route-denied"');
  });
});
