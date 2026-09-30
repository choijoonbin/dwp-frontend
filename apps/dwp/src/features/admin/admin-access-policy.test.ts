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

type TestResourceRole = NonNullable<
  Parameters<typeof resolvePrimaryAuthorityRole>[1]
>[number];

function identity(
  roles: string[],
  resourceRoles: TestResourceRole[] = [],
  identityPlane: 'TENANT' | 'PROVIDER' = 'TENANT'
) {
  return { identityPlane, roles, resourceRoles } as const;
}

function companyAccess(
  roles: string[],
  grants: readonly string[],
  resourceRoles: TestResourceRole[] = [],
  identityPlane: 'TENANT' | 'PROVIDER' = 'TENANT'
) {
  return {
    identity: identity(roles, resourceRoles, identityPlane),
    permissionsLoaded: true,
    hasPermission: vi.fn((resourceKey: string, permissionCode = 'VIEW') =>
      grants.includes(`${resourceKey}:${permissionCode}`)
    ),
  };
}

describe('control plane access policy', () => {
  it('requires exact shell and leaf permissions for an ordinary tenant identity', () => {
    const customGroupRole = ['CUSTOM_IDENTITY_REVIEWER'];

    expect(
      canEnterCompanyAdministration(
        companyAccess(customGroupRole, ['APP.ADMINISTRATION:VIEW'])
      )
    ).toBe(false);
    expect(
      canEnterCompanyAdministration(
        companyAccess(customGroupRole, ['ADMIN.ACCESS_GOVERNANCE:VIEW'])
      )
    ).toBe(false);
    expect(
      canEnterCompanyAdministration(
        companyAccess(customGroupRole, [
          'APP.ADMINISTRATION:VIEW',
          'ADMIN.ACCESS_GOVERNANCE:VIEW',
        ])
      )
    ).toBe(true);
    expect(canEnterCompanyAdministration(companyAccess(['TENANT_ADMIN'], []))).toBe(false);
  });

  it('never opens company administration for an app configuration responsibility alone', () => {
    expect(
      canEnterCompanyAdministration(
        companyAccess(['WORKSPACE_MEMBER'], [], [
          {
            responsibilityCode: 'APP_CONFIG_ADMIN',
            resourceType: 'APP',
            resourceKey: 'APP.APPROVALS',
            resourceSetId: 'set-1',
            resourceSetKey: 'APP_APPROVALS',
          },
        ])
      )
    ).toBe(false);
  });
  it('recognizes every provider persona exposed by the provider router', () => {
    expect(hasProviderControlPlaneRole(['PROVIDER_OPERATOR'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_SUPPORT'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_AUDITOR'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_TENANT_PROVISIONER'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_RELEASE_APPROVER'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_DATA_APPROVER'])).toBe(true);
    expect(hasProviderControlPlaneRole(['PROVIDER_FUTURE_OPERATIONS'])).toBe(true);
    expect(hasProviderControlPlaneRole([' provider_future_auditor '])).toBe(true);
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
    expect(canEnterTenantControlPlane(identity(['WORKSPACE_MEMBER'], resourceRoles), false)).toBe(
      true
    );
    expect(
      canEnterCompanyAdministration(companyAccess(['WORKSPACE_MEMBER'], [], resourceRoles))
    ).toBe(true);
    expect(
      canAccessAdminNavigationItem(
        {
          ...item('app-governance', 'ADMIN.APP_GOVERNANCE'),
          requiredResponsibilityCodes: ['APP_OWNER'],
        },
        {
          identity: identity(['WORKSPACE_MEMBER'], resourceRoles),
          permissionsLoaded: true,
          hasPermission: vi.fn(() => false),
        }
      )
    ).toBe(true);
    expect(
      canAccessAdminNavigationItem(item('branding'), {
        identity: identity(['WORKSPACE_MEMBER'], resourceRoles),
        permissionsLoaded: true,
        hasPermission: vi.fn(() => false),
      })
    ).toBe(false);
  });

  it('never admits a provider operator to tenant administration', () => {
    expect(
      canEnterTenantControlPlane(identity(['PROVIDER_SUPPORT'], [], 'PROVIDER'), true)
    ).toBe(false);
    expect(
      canEnterCompanyAdministration(
        companyAccess(
          ['PROVIDER_ADMIN'],
          ['APP.ADMINISTRATION:VIEW', 'ADMIN.ACCESS_GOVERNANCE:VIEW'],
          [],
          'PROVIDER'
        )
      )
    ).toBe(false);
    expect(
      canEnterCompanyAdministration(
        companyAccess(
          [],
          ['APP.ADMINISTRATION:VIEW', 'ADMIN.ACCESS_GOVERNANCE:VIEW'],
          [],
          'PROVIDER'
        )
      )
    ).toBe(false);
  });

  it('denies a Provider identity before evaluating an exact tenant permission', () => {
    const access = {
      identity: identity([], [], 'PROVIDER'),
      permissionsLoaded: true,
      hasPermission: vi.fn(() => true),
    };

    expect(canAccessAdminNavigationItem(item('branding'), access)).toBe(false);
    expect(
      canAccessAdminNavigationItem(item('audit-events', 'ADMIN.AUDIT_VIEW', 'VIEW'), {
        ...access,
      })
    ).toBe(false);
  });

  it('does not turn product role names into company administration authority', () => {
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
      expect(
        canEnterCompanyAdministration(
          companyAccess([role], ['APP.ADMINISTRATION:VIEW'])
        )
      ).toBe(false);
      expect(
        canAccessAdminNavigationItem(item('branding', 'ADMIN.PRODUCT_SPECIALIST'), {
          identity: identity([role]),
          permissionsLoaded: true,
          hasPermission: vi.fn(() => false),
        })
      ).toBe(false);
    }

    expect(resolvePrimaryAuthorityRole(['COMMUNICATIONS_PUBLISHER'])).toBe(
      'COMMUNICATIONS_PUBLISHER'
    );
    expect(resolvePrimaryAuthorityRole(['SERVICE_AGENT'])).toBe('SERVICE_AGENT');
  });

  it('uses exact app-governance authority without requiring a built-in role name', () => {
    expect(
      canAccessAdminNavigationItem(
        {
          ...item('app-access-requests', 'ADMIN.APP_ACCESS_REQUESTS', 'VIEW'),
          requiredResponsibilityCodes: ['APP_ACCESS_APPROVER', 'APP_ACCESS_MANAGER'],
        },
        {
          identity: identity(['TENANT_ADMIN']),
          permissionsLoaded: true,
          hasPermission: vi.fn(() => false),
        }
      )
    ).toBe(false);

    expect(
      canAccessAdminNavigationItem(
        {
          ...item('app-access-requests', 'ADMIN.APP_ACCESS_REQUESTS', 'VIEW'),
          requiredResponsibilityCodes: ['APP_ACCESS_APPROVER', 'APP_ACCESS_MANAGER'],
        },
        {
          identity: identity(['CUSTOM_APP_GOVERNANCE_REVIEWER']),
          permissionsLoaded: true,
          hasPermission: vi.fn(
            (resourceKey: string, permissionCode?: string) =>
              resourceKey === 'ADMIN.APP_ACCESS_REQUESTS' && permissionCode === 'VIEW'
          ),
        }
      )
    ).toBe(true);
  });

  it('keeps audit personas out of unscoped tenant administration pages', () => {
    const hasPermission = vi.fn(() => true);
    expect(
      canAccessAdminNavigationItem(item('branding'), {
        identity: identity(['AUDITOR']),
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(false);
    expect(
      canAccessAdminNavigationItem(item('audit-events', 'ADMIN.AUDIT_VIEW', 'VIEW'), {
        identity: identity(['AUDITOR']),
        permissionsLoaded: true,
        hasPermission,
      })
    ).toBe(true);
  });

  it('does not expose workforce pages to a Provider support role', () => {
    const access = {
      identity: identity(['PROVIDER_SUPPORT'], [], 'PROVIDER'),
      permissionsLoaded: true,
      hasPermission: vi.fn(() => false),
    };
    expect(canAccessAdminNavigationItem(item('access'), access)).toBe(false);
    expect(canAccessAdminNavigationItem(item('branding'), access)).toBe(false);
    expect(canAccessAdminNavigationItem(item('access'), access)).toBe(false);
  });

  it('keeps Provider support identities out of home composition', () => {
    expect(
      canAccessAdminNavigationItem(item('home-composition'), {
        identity: identity(['PROVIDER_SUPPORT'], [], 'PROVIDER'),
        permissionsLoaded: true,
        hasPermission: vi.fn(() => false),
      })
    ).toBe(false);
    expect(
      canAccessAdminNavigationItem(item('home-composition'), {
        identity: identity(['PROVIDER_SUPPORT'], [], 'PROVIDER'),
        permissionsLoaded: true,
        hasPermission: vi.fn(() => false),
      })
    ).toBe(false);
  });

  it('does not let a built-in tenant role bypass an exact leaf permission', () => {
    expect(
      canAccessAdminNavigationItem(item('access-reviews', 'ADMIN.ACCESS_REVIEWS', 'VIEW'), {
        identity: identity(['TENANT_ADMIN']),
        permissionsLoaded: true,
        hasPermission: vi.fn(() => false),
      })
    ).toBe(false);
    expect(
      canAccessAdminNavigationItem(item('access-reviews', 'ADMIN.ACCESS_REVIEWS', 'VIEW'), {
        identity: identity(['CUSTOM_ACCESS_REVIEWER']),
        permissionsLoaded: true,
        hasPermission: vi.fn(
          (resourceKey: string, permissionCode?: string) =>
            resourceKey === 'ADMIN.ACCESS_REVIEWS' && permissionCode === 'VIEW'
        ),
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
