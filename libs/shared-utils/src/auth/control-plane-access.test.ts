import { describe, expect, it } from 'vitest';

import {
  IdentityPlaneContractError,
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
