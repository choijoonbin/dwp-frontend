import { describe, expect, it, vi } from 'vitest';

import {
  canEnterTenantControlPlane,
  hasProviderControlPlaneRole,
  resolvePrimaryAuthorityRole,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';

import { canAccessAdminNavigationItem, canEnterCompanyAdministration } from './admin-access-policy';
import type { AdminNavigationItem } from './admin-navigation';

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
  it('never opens company administration for an app configuration responsibility alone', () => {
    expect(canEnterCompanyAdministration(['APP_CONFIG_ADMIN'], true)).toBe(false);
    expect(
      canEnterCompanyAdministration(['WORKSPACE_MEMBER'], false, false, [
        {
          responsibilityCode: 'APP_CONFIG_ADMIN',
          resourceType: 'APP',
          resourceKey: 'APP.APPROVALS',
          resourceSetId: 'set-1',
          resourceSetKey: 'APP_APPROVALS',
        },
      ])
    ).toBe(false);
    expect(canEnterCompanyAdministration(['WORKSPACE_MEMBER'], false)).toBe(false);
    expect(canEnterCompanyAdministration(['TENANT_ADMIN'], true)).toBe(true);
  });
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
        resourceKey: 'APP.MAIL',
        resourceSetId: 'set-1',
        resourceSetKey: 'APP_MAIL_CALENDAR',
      },
    ];
    expect(canEnterTenantControlPlane(['WORKSPACE_MEMBER'], false, false, resourceRoles)).toBe(
      true
    );
    expect(canEnterCompanyAdministration(['WORKSPACE_MEMBER'], false, false, resourceRoles)).toBe(
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

  it('keeps product specialists in product workbenches rather than company administration', () => {
    const productRoles = [
      'COMMUNICATIONS_EDITOR',
      'COMMUNICATIONS_PUBLISHER',
      'SERVICE_CATALOG_MANAGER',
      'SERVICE_AGENT',
      'HR_ADMIN',
      'PEOPLE_ADMIN',
      'SPACE_GOVERNANCE_ADMIN',
      'SPACE_TEMPLATE_ADMIN',
      'SPACE_COMPLIANCE_REVIEWER',
      'SPACE_ACCESS_REVIEWER',
    ];

    for (const role of productRoles) {
      expect(canEnterTenantControlPlane([role], true)).toBe(false);
      expect(
        canAccessAdminNavigationItem(item('branding', 'ADMIN.PRODUCT_SPECIALIST'), {
          roles: [role],
          permissionsLoaded: true,
          hasPermission: vi.fn(() => true),
        })
      ).toBe(false);
    }

    expect(resolvePrimaryAuthorityRole(['COMMUNICATIONS_PUBLISHER'])).toBe(
      'COMMUNICATIONS_PUBLISHER'
    );
    expect(resolvePrimaryAuthorityRole(['SERVICE_AGENT'])).toBe('SERVICE_AGENT');
  });

  it('does not infer application approval responsibility from tenant administration', () => {
    expect(
      canAccessAdminNavigationItem(
        {
          ...item('app-access-requests', 'ADMIN.APP_ACCESS_REQUESTS'),
          requiredAnyRoleCodes: ['APP_CATALOG_ADMIN'],
          requiredResponsibilityCodes: ['APP_ACCESS_APPROVER', 'APP_ACCESS_MANAGER'],
        },
        {
          roles: ['TENANT_ADMIN'],
          permissionsLoaded: true,
          hasPermission: vi.fn(() => true),
          resourceRoles: [],
        }
      )
    ).toBe(false);

    expect(
      canAccessAdminNavigationItem(
        {
          ...item('app-access-requests', 'ADMIN.APP_ACCESS_REQUESTS'),
          requiredAnyRoleCodes: ['APP_CATALOG_ADMIN'],
          requiredResponsibilityCodes: ['APP_ACCESS_APPROVER', 'APP_ACCESS_MANAGER'],
        },
        {
          roles: ['APP_CATALOG_ADMIN'],
          permissionsLoaded: true,
          hasPermission: vi.fn(() => true),
          resourceRoles: [],
        }
      )
    ).toBe(true);
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

  it('exposes home composition only through tenant configuration support scope', () => {
    expect(
      canAccessAdminNavigationItem(item('home-composition'), {
        roles: ['PROVIDER_SUPPORT'],
        permissionsLoaded: true,
        hasPermission: vi.fn(() => false),
        supportScopes: ['TENANT_CONFIGURATION_WRITE'],
      })
    ).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('home-composition'), {
        roles: ['PROVIDER_SUPPORT'],
        permissionsLoaded: true,
        hasPermission: vi.fn(() => false),
        supportScopes: ['WORKFORCE_READ'],
      })
    ).toBe(false);
  });

  it('keeps assigned reviewers out of the tenant administration shell', () => {
    const hasPermission = vi.fn(() => false);
    expect(
      canAccessAdminNavigationItem(item('access-reviews'), {
        roles: ['WORKSPACE_MEMBER'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(false);
    expect(
      canAccessAdminNavigationItem(item('access-reviews'), {
        roles: ['TENANT_ADMIN'],
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(true);
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
            resourceKey: 'APP.MAIL',
            resourceSetId: 'set-1',
            resourceSetKey: 'APP_MAIL_CALENDAR',
          },
        ]
      )
    ).toBe('APP_ACCESS_MANAGER');
  });
});
