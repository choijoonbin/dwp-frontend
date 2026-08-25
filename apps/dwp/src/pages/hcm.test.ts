import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HcmPage from './hcm';

const pageMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
  useProviderSupportContext: vi.fn(),
  useHcmExperience: vi.fn(),
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
  useHcmExperience: pageMocks.useHcmExperience,
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
    pageMocks.useAuth.mockReturnValue({ user: { roles: [] } });
    pageMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });
    pageMocks.useProviderSupportContext.mockReturnValue({ isLoading: false, data: undefined });
    pageMocks.useHcmExperience.mockReturnValue({
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
    pageMocks.useAuth.mockReturnValue({ user: { roles: ['PROVIDER_SUPPORT'] } });
    pageMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => true),
    });
    pageMocks.useProviderSupportContext.mockReturnValue({
      isLoading: false,
      data: { scopes: ['WORKFORCE_READ'] },
    });

    expect(renderPage('/hr/pay')).toContain('access:support-scope-denied');
    expect(pageMocks.useHcmExperience).not.toHaveBeenCalled();
  });

  it('denies an HCM administration page without VIEW or MANAGE before mounting it', () => {
    expect(renderPage('/hr/operations/time')).toContain('access:route-denied');
    expect(pageMocks.useHcmExperience).not.toHaveBeenCalled();
  });
});
