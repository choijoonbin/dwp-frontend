import { describe, expect, it } from 'vitest';

import {
  IdentityPlaneContractError,
  canEnterTenantControlPlane,
  isProviderIdentity,
  isTenantIdentity,
  resolveIdentityPlane,
} from './control-plane-access';

describe('durable identity plane contract', () => {
  it('classifies a roleless provider from the durable plane', () => {
    const identity = { identityPlane: 'PROVIDER' as const, roles: [], resourceRoles: [] };

    expect(resolveIdentityPlane(identity)).toBe('PROVIDER');
    expect(isProviderIdentity(identity)).toBe(true);
    expect(isTenantIdentity(identity)).toBe(false);
  });

  it('classifies a tenant from the durable plane instead of role-name inference', () => {
    const identity = {
      identityPlane: 'TENANT' as const,
      roles: ['WORKSPACE_MEMBER', 'CUSTOM_FINANCE_ROLE'],
      resourceRoles: [],
    };

    expect(resolveIdentityPlane(identity)).toBe('TENANT');
    expect(isProviderIdentity(identity)).toBe(false);
    expect(isTenantIdentity(identity)).toBe(true);
  });

  it('uses projected exact authority instead of a built-in tenant role name', () => {
    const customRoleIdentity = {
      identityPlane: 'TENANT' as const,
      roles: ['CUSTOM_GROUP_ADMIN'],
      resourceRoles: [],
    };

    expect(canEnterTenantControlPlane(customRoleIdentity, true)).toBe(true);
    expect(
      canEnterTenantControlPlane(
        { identityPlane: 'TENANT', roles: ['TENANT_ADMIN'], resourceRoles: [] },
        false
      )
    ).toBe(false);
    expect(
      canEnterTenantControlPlane({ identityPlane: 'PROVIDER', roles: [], resourceRoles: [] }, true)
    ).toBe(false);
    expect(canEnterTenantControlPlane(null, true)).toBe(false);
    expect(canEnterTenantControlPlane(undefined, true)).toBe(false);
    expect(
      canEnterTenantControlPlane(
        {
          identityPlane: 'TENANT',
          roles: [],
          resourceRoles: [
            {
              responsibilityCode: 'APP_OWNER',
              resourceType: 'APP',
              resourceKey: 'people',
              resourceSetId: 'set-1',
              resourceSetKey: 'people-owners',
            },
          ],
        },
        false
      )
    ).toBe(true);
  });

  it.each([
    [null, 'identity payload is missing or malformed'],
    [{ roles: [] }, 'missing plane'],
    [{ identityPlane: 'UNKNOWN', roles: [] }, 'unknown plane UNKNOWN'],
    [
      { identityPlane: 'PROVIDER', roles: ['WORKSPACE_MEMBER'] },
      'provider plane carries a tenant role',
    ],
    [
      { identityPlane: 'TENANT', roles: ['PROVIDER_SUPPORT'] },
      'tenant plane carries a provider role',
    ],
    [
      { identityPlane: 'PROVIDER', roles: ['PROVIDER_SUPPORT', 'TENANT_ADMIN'] },
      'provider and tenant roles are mixed',
    ],
    [
      {
        identityPlane: 'PROVIDER',
        roles: [],
        resourceRoles: [{ responsibilityCode: 'APP_OWNER' }],
      },
      'provider plane carries tenant resource roles',
    ],
  ])('rejects an invalid mixed-version identity: %s', (identity, reason) => {
    expect(() => resolveIdentityPlane(identity)).toThrowError(
      new IdentityPlaneContractError(reason)
    );
  });
});
