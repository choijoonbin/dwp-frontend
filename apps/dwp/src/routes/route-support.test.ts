import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AllowedProductSurfaceProvider } from '../features/shell/allowed-product-surface-context';
import { ProductAnyRouteGuard, ProductRouteGuard } from './route-support';

import type { AllowedProductSurfaceBoundaryKind } from '../features/shell/allowed-product-surface-context';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';
import type { ComponentProps } from 'react';

const guardMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: guardMocks.useAuth,
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: guardMocks.usePermissions,
}));

vi.mock('../components/product-surface-access-state', () => ({
  ProductSurfaceAccessState: ({ decision }: { decision: { state: string } }) =>
    createElement('span', { 'data-access-state': decision.state }, decision.state),
}));

function allowedDecision(plane: 'work' | 'management'): AllowedSurfaceDecision {
  const scope = {
    key: 'opaque-scope',
    kind: plane === 'management' ? ('RESOURCE_SET' as const) : ('SELF' as const),
    displayName: plane === 'management' ? 'Assigned area' : 'Self',
    isDefault: true,
    readOnly: false,
  };
  return {
    state: 'allowed',
    context: {
      contextKey: `sample-${plane}`,
      productKey: 'sample',
      surfaceKey: `sample.${plane}`,
      plane,
      accessMode: 'NORMAL',
      accessSource: plane === 'management' ? 'MANAGEMENT' : 'ENTITLEMENT',
      appResourceKey: 'APP.SAMPLE',
      effectiveGrants: [],
      scopes: [scope],
      revalidateAt: '2030-01-01T00:00:00Z',
    },
    routeGrantRef: `route.sample.${plane}.page`,
    scope,
    effectiveReadOnly: false,
    revalidateAt: '2030-01-01T00:00:00Z',
    decisionRevision: 'revision-1',
  };
}

function renderProductGuard({
  boundaryKind,
  decision = allowedDecision('management'),
  resourceKey = 'ADMIN.SAMPLE',
}: {
  boundaryKind?: AllowedProductSurfaceBoundaryKind;
  decision?: AllowedSurfaceDecision;
  resourceKey?: string;
} = {}) {
  const providerProps = {
    decision,
    boundaryKind,
  } as ComponentProps<typeof AllowedProductSurfaceProvider>;
  const guardProps = {
    resourceKey,
    localDeny: true,
  } as ComponentProps<typeof ProductRouteGuard>;
  return renderToStaticMarkup(
    createElement(
      AllowedProductSurfaceProvider,
      providerProps,
      createElement(
        ProductRouteGuard,
        guardProps,
        createElement('span', { 'data-testid': 'page' }, 'page')
      )
    )
  );
}

describe('legacy product route guards under governed PAGE authority', () => {
  beforeEach(() => {
    guardMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: [], resourceRoles: [] },
    });
    guardMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });
  });

  it('does not re-deny an exact server-authorized management PAGE with a legacy ADMIN guard', () => {
    guardMocks.usePermissions.mockReturnValue({
      isLoaded: false,
      hasPermission: vi.fn(() => false),
    });

    const markup = renderProductGuard({ boundaryKind: 'exact-route' });

    expect(markup).toContain('data-testid="page"');
    expect(markup).not.toContain('data-access-state');
  });

  it('does not treat a Surface allow, Work allow, or non-ADMIN guard as exact management authority', () => {
    expect(renderProductGuard({ boundaryKind: 'surface' })).toContain(
      'data-access-state="route-denied"'
    );
    expect(
      renderProductGuard({
        boundaryKind: 'exact-route',
        decision: allowedDecision('work'),
      })
    ).toContain('data-access-state="route-denied"');
    expect(
      renderProductGuard({ boundaryKind: 'exact-route', resourceKey: 'DATA.SAMPLE' })
    ).toContain('data-access-state="route-denied"');
  });

  it('preserves the legacy permission path outside governed PAGE context', () => {
    guardMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(
        (resourceKey: string, permissionCode?: string) =>
          resourceKey === 'ADMIN.SAMPLE' && permissionCode === 'MANAGE'
      ),
    });

    expect(renderProductGuard()).toContain('data-testid="page"');
  });

  it('bypasses only an all-ADMIN ProductAny guard for an exact management PAGE', () => {
    const renderAny = (resourceKeys: readonly string[]) => {
      const providerProps = {
        decision: allowedDecision('management'),
        boundaryKind: 'exact-route',
      } as ComponentProps<typeof AllowedProductSurfaceProvider>;
      const guardProps = {
        authorities: resourceKeys.map((resourceKey) => ({
          resourceKey,
          permissionCode: 'VIEW' as const,
        })),
        localDeny: true,
      } as unknown as ComponentProps<typeof ProductAnyRouteGuard>;
      return renderToStaticMarkup(
        createElement(
          AllowedProductSurfaceProvider,
          providerProps,
          createElement(
            ProductAnyRouteGuard,
            guardProps,
            createElement('span', { 'data-testid': 'page' }, 'page')
          )
        )
      );
    };

    expect(renderAny(['ADMIN.SAMPLE', 'ADMIN.SAMPLE_AUDIT'])).toContain('data-testid="page"');
    expect(renderAny(['ADMIN.SAMPLE', 'APP.SAMPLE'])).toContain('data-access-state="route-denied"');
  });
});
