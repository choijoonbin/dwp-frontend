import { describe, expect, it } from 'vitest';

import { resolveGlobalSearchPersona } from './global-search-access-policy';

describe('global search persona policy', () => {
  it('keeps tenant search disabled for a roleless durable provider identity', () => {
    expect(
      resolveGlobalSearchPersona({ identityPlane: 'PROVIDER', roles: [], resourceRoles: [] })
    ).toEqual({
      providerAccount: true,
      searchVisible: false,
      tenantSourcesEnabled: false,
      providerSourcesEnabled: false,
    });
  });

  it('enables only provider-owned sources for an authorized provider operator', () => {
    expect(
      resolveGlobalSearchPersona({
        identityPlane: 'PROVIDER',
        roles: ['PROVIDER_ADMIN'],
        resourceRoles: [],
      })
    ).toEqual({
      providerAccount: true,
      searchVisible: true,
      tenantSourcesEnabled: false,
      providerSourcesEnabled: true,
    });
  });

  it('keeps tenant search available for a tenant-only identity', () => {
    expect(
      resolveGlobalSearchPersona({
        identityPlane: 'TENANT',
        roles: ['TENANT_ADMIN'],
        resourceRoles: [],
      })
    ).toMatchObject({
      providerAccount: false,
      searchVisible: true,
      tenantSourcesEnabled: true,
      providerSourcesEnabled: false,
    });
  });

  it('does not enable either search plane before a verified identity exists', () => {
    expect(resolveGlobalSearchPersona(null)).toEqual({
      providerAccount: false,
      searchVisible: false,
      tenantSourcesEnabled: false,
      providerSourcesEnabled: false,
    });
  });

  it('rejects a mixed provider and tenant identity instead of choosing a plane', () => {
    expect(() =>
      resolveGlobalSearchPersona({
        identityPlane: 'PROVIDER',
        roles: ['PROVIDER_SUPPORT', 'TENANT_ADMIN'],
        resourceRoles: [],
      })
    ).toThrow(/roles are mixed/);
  });
});
