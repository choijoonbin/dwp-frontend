import { describe, expect, it, vi } from 'vitest';

import {
  canAccessAdminNavigationItem,
  canEnterTenantControlPlane,
  hasProviderControlPlaneRole,
  resolvePrimaryAuthorityRole,
} from './control-plane-access';

import type { AdminNavigationItem } from '../admin/admin-navigation';

const item = (
  view: AdminNavigationItem['view'],
  resource?: string,
  permission?: string
): AdminNavigationItem => ({
  section: view === 'audit-events' ? 'governance' : 'experience',
  view,
  path: `/admin/test/${view}`,
  icon: (() => null) as unknown as AdminNavigationItem['icon'],
  requiredResourceKey: resource,
  requiredPermissionCode: permission,
});

describe('control plane access policy', () => {
  it('recognizes every provider persona exposed by the provider router', () => {
    expect(hasProviderControlPlaneRole(['PROVIDER_OPERATOR'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_SUPPORT'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_AUDITOR'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_TENANT_PROVISIONER'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_RELEASE_APPROVER'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_DATA_APPROVER'])).toBe(true);
    expect(hasProviderControlPlaneRole(['TENANT_ADMIN'])).toBe(false);
  });

  it('admits a scoped app owner and limits navigation to delegated app governance', () => {
    const resourceRoles = [
      {
        responsibilityCode: 'APP_OWNER',
        resourceType: 'APP',
        resourceKey: 'APP.MAIL_CALENDAR',
        resourceSetId: 'set-1',
        resourceSetKey: 'APP_MAIL_CALENDAR',
      },
    ];
    expect(canEnterTenantControlPlane(['WORKSPACE_MEMBER'], false, false, resourceRoles)).toBe(
      true
    );
    expect(
      canAccessAdminNavigationItem(
        {
          ...item('app-governance', 'ADMIN.APP_GOVERNANCE'),
          requiredResponsibilityCodes: ['APP_OWNER'],
        },
        {
          roles: ['WORKSPACE_MEMBER'],
          permissionsLoaded: true,
          hasPermission: vi.fn(() => false),
          resourceRoles,
        }
      )
    ).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('branding'), {
        roles: ['WORKSPACE_MEMBER'],
        permissionsLoaded: true,
        hasPermission: vi.fn(() => false),
        resourceRoles,
      })
    ).toBe(false);
  });

  it('admits a provider operator to tenant administration only with an active support session', () => {
    expect(canEnterTenantControlPlane(['PROVIDER_SUPPORT'], false, false)).toBe(false);
    expect(canEnterTenantControlPlane(['PROVIDER_SUPPORT'], false, true)).toBe(true);
  });

  it('limits delegated communications roles to the newsroom administration resource', () => {
    const hasPermission = vi.fn(
      (resource: string, permission = 'VIEW') =>
        resource === 'ADMIN.COMMUNICATIONS' && ['VIEW', 'CREATE', 'UPDATE'].includes(permission)
    );
    expect(canEnterTenantControlPlane(['COMMUNICATIONS_EDITOR'], true)).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('announcements', 'ADMIN.COMMUNICATIONS'), {
        roles: ['COMMUNICATIONS_EDITOR'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('branding'), {
        roles: ['COMMUNICATIONS_EDITOR'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(false);
    expect(resolvePrimaryAuthorityRole(['COMMUNICATIONS_PUBLISHER'])).toBe(
      'COMMUNICATIONS_PUBLISHER'
    );
  });

  it('separates service catalog design from request operations', () => {
    const catalogPermission = vi.fn(
      (resource: string, permission = 'VIEW') =>
        resource === 'ADMIN.SERVICE_CATALOG' && ['VIEW', 'CREATE', 'UPDATE'].includes(permission)
    );
    expect(canEnterTenantControlPlane(['SERVICE_CATALOG_MANAGER'], true)).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('service-catalog', 'ADMIN.SERVICE_CATALOG'), {
        roles: ['SERVICE_CATALOG_MANAGER'],
        permissionsLoaded: true,
        hasPermission: catalogPermission,
      })
    ).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('service-operations', 'ADMIN.SERVICE_OPERATIONS'), {
        roles: ['SERVICE_CATALOG_MANAGER'],
        permissionsLoaded: true,
        hasPermission: catalogPermission,
      })
    ).toBe(false);
    expect(resolvePrimaryAuthorityRole(['SERVICE_AGENT'])).toBe('SERVICE_AGENT');
  });

  it('routes workforce governors only to explicitly granted people administration', () => {
    const hasPermission = vi.fn(
      (resource: string, permission = 'VIEW') =>
        resource === 'ADMIN.WORKFORCE_ACCESS' && permission === 'MANAGE'
    );
    expect(canEnterTenantControlPlane(['HR_ADMIN'], true)).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('workforce-access', 'ADMIN.WORKFORCE_ACCESS', 'MANAGE'), {
        roles: ['HR_ADMIN'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('app-access-requests', 'ADMIN.APP_ACCESS_REQUESTS'), {
        roles: ['HR_ADMIN'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(false);
  });

  it('does not infer application approval responsibility from tenant administration', () => {
    expect(
      canAccessAdminNavigationItem(
        {
          ...item('app-access-requests', 'ADMIN.APP_ACCESS_REQUESTS'),
          requiredResponsibilityCodes: ['APP_ACCESS_APPROVER', 'APP_ACCESS_MANAGER'],
        },
        {
          roles: ['TENANT_ADMIN'],
          permissionsLoaded: true,
          hasPermission: vi.fn(() => false),
          resourceRoles: [],
        }
      )
    ).toBe(false);
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

  it('exposes only the assigned-review surface to a workforce reviewer', () => {
    const hasPermission = vi.fn(() => false);
    const reviewItem = {
      ...item('access-reviews'),
      reviewerAccessible: true,
    };
    expect(
      canAccessAdminNavigationItem(reviewItem, {
        roles: ['WORKSPACE_MEMBER'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(true);
    expect(
      canAccessAdminNavigationItem(reviewItem, {
        roles: ['PROVIDER_SUPPORT'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(false);
  });

  it('uses an explicit authority role instead of a mutable job title', () => {
    expect(resolvePrimaryAuthorityRole(['ADMIN', 'PROVIDER_ADMIN'])).toBe('PROVIDER_ADMIN');
    expect(resolvePrimaryAuthorityRole(['WORKSPACE_MEMBER'])).toBe('WORKSPACE_MEMBER');
    expect(
      resolvePrimaryAuthorityRole(
        ['WORKSPACE_MEMBER'],
        [
          {
            responsibilityCode: 'APP_ACCESS_MANAGER',
            resourceType: 'APP',
            resourceKey: 'APP.MAIL_CALENDAR',
            resourceSetId: 'set-1',
            resourceSetKey: 'APP_MAIL_CALENDAR',
          },
        ]
      )
    ).toBe('APP_ACCESS_MANAGER');
  });
});
