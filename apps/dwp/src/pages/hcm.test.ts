import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HcmPage from './hcm';

const pageMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
  useProviderSupportContext: vi.fn(),
  useHcmAccess: vi.fn(),
  useOptionalAllowedProductSurface: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: pageMocks.useAuth,
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: pageMocks.usePermissions,
}));

vi.mock('@dwp-frontend/shared-utils/auth/provider-support-context', () => ({
  useProviderSupportContext: pageMocks.useProviderSupportContext,
}));

vi.mock('../features/hcm/use-hcm-experience', () => ({
  useHcmAccess: pageMocks.useHcmAccess,
}));

vi.mock('../components/allowed-product-surface-context', () => ({
  useOptionalAllowedProductSurface: pageMocks.useOptionalAllowedProductSurface,
}));

vi.mock('../components/product-surface-access-state', () => ({
  ProductSurfaceAccessState: ({ decision }: { decision: { state: string } }) =>
    `access:${decision.state}`,
}));

function renderPage(path: string) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [path] }, createElement(HcmPage))
  );
}

describe('HCM legacy page guard', () => {
  beforeEach(() => {
    pageMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: [], resourceRoles: [] },
    });
    pageMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });
    pageMocks.useProviderSupportContext.mockReturnValue({ isLoading: false, data: undefined });
    pageMocks.useOptionalAllowedProductSurface.mockReturnValue(undefined);
    pageMocks.useHcmAccess.mockReturnValue({
      isManager: false,
      canOperate: false,
      canManageTime: false,
      canManageAbsence: false,
      canManageBenefits: false,
      canManagePay: false,
      canManageTalent: false,
    });
  });

  it('denies /hr/pay before mounting its page experience for WORKFORCE_READ support', () => {
    pageMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'PROVIDER', roles: ['PROVIDER_SUPPORT'], resourceRoles: [] },
    });
    pageMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => true),
    });
    pageMocks.useProviderSupportContext.mockReturnValue({
      isLoading: false,
      data: { scopes: ['WORKFORCE_READ'] },
    });

    expect(renderPage('/hr/pay')).toContain('access:support-scope-denied');
    expect(pageMocks.useHcmAccess).not.toHaveBeenCalled();
  });

  it('denies an HCM administration page without VIEW or MANAGE before mounting it', () => {
    expect(renderPage('/hr/operations/time')).toContain('access:route-denied');
    expect(pageMocks.useHcmAccess).not.toHaveBeenCalled();
  });

  it('does not mount legacy audience resolution for an exact governed operations page', () => {
    pageMocks.useOptionalAllowedProductSurface.mockReturnValue({ surfaceId: 'hcm.operations' });

    renderPage('/hr/operations/time');

    expect(pageMocks.useHcmAccess).not.toHaveBeenCalled();
  });
});
