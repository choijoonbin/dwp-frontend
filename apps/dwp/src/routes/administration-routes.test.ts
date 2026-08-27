import { createElement, isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navigate } from 'react-router-dom';

import {
  AdminLegacyRedirect,
  AdminRouteGuard,
  AdminSectionRedirect,
} from './administration-routes';

const routeMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
  useProviderSupportContext: vi.fn(),
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

function expectProviderRedirect(result: ReactNode) {
  expect(isValidElement(result)).toBe(true);
  if (!isValidElement<{ to: string; replace: boolean }>(result)) {
    throw new Error('Expected a Provider redirect element.');
  }
  expect(result.type).toBe(Navigate);
  expect(result.props).toMatchObject({ to: '/provider', replace: true });
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
});
