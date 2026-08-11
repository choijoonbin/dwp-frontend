import { describe, expect, it, vi } from 'vitest';

import {
  canAccessAdminNavigationItem,
  canEnterTenantControlPlane,
  hasProviderControlPlaneRole,
  resolvePrimaryAuthorityRole,
} from './control-plane-access';

import type { AdminNavigationItem } from '../admin/admin-navigation';

const item = (view: AdminNavigationItem['view'], resource?: string): AdminNavigationItem => ({
  section: view === 'audit-events' ? 'governance' : 'experience',
  view,
  path: `/admin/test/${view}`,
  icon: (() => null) as unknown as AdminNavigationItem['icon'],
  requiredResourceKey: resource,
});

describe('control plane access policy', () => {
  it('recognizes every provider persona exposed by the provider router', () => {
    expect(hasProviderControlPlaneRole(['PROVIDER_OPERATOR'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_SUPPORT'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_AUDITOR'])).toBe(true);
    expect(hasProviderControlPlaneRole(['TENANT_ADMIN'])).toBe(false);
  });

  it('admits a provider operator to tenant administration only with an active support session', () => {
    expect(canEnterTenantControlPlane(['PROVIDER_SUPPORT'], false, false)).toBe(false);
    expect(canEnterTenantControlPlane(['PROVIDER_SUPPORT'], false, true)).toBe(true);
  });

  it('keeps audit personas out of unscoped tenant administration pages', () => {
    const hasPermission = vi.fn(() => true);
    expect(
      canAccessAdminNavigationItem(item('branding'), {
        roles: ['AUDITOR'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(false);
    expect(
      canAccessAdminNavigationItem(item('audit-events', 'ADMIN.AUDIT_VIEW'), {
        roles: ['AUDITOR'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(true);
  });

  it('does not expose workforce pages through tenant control-plane support scope', () => {
    const access = {
      roles: ['PROVIDER_SUPPORT'],
      permissionsLoaded: true,
      hasPermission: vi.fn(() => false),
      supportScopes: ['WORKFORCE_READ'],
    };
    expect(canAccessAdminNavigationItem(item('access'), access)).toBe(false);
    expect(canAccessAdminNavigationItem(item('branding'), access)).toBe(false);
    expect(canAccessAdminNavigationItem(item('access'), access)).toBe(false);
  });

  it('uses an explicit authority role instead of a mutable job title', () => {
    expect(resolvePrimaryAuthorityRole(['ADMIN', 'PROVIDER_ADMIN'])).toBe('PROVIDER_ADMIN');
    expect(resolvePrimaryAuthorityRole(['WORKSPACE_MEMBER'])).toBe('WORKSPACE_MEMBER');
  });
});
