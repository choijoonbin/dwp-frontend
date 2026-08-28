import { describe, expect, it } from 'vitest';

import { effectivePermissionRowId, effectiveRoleRowId } from './role-governance-effective-model';

describe('role governance effective-access row identity', () => {
  it('keeps the same inherited role at different scopes as separate evidence rows', () => {
    const base = {
      roleId: 100,
      roleCode: 'SERVICE_AGENT',
      source: 'GROUP',
      sourceGroupId: 10,
      sourceGroupName: 'Service operators',
      validTo: null,
    };

    expect(effectiveRoleRowId({ ...base, scopeType: 'ORG_UNIT', scopeRef: 'org-42' })).not.toBe(
      effectiveRoleRowId({ ...base, scopeType: 'RESOURCE', scopeRef: 'service-42' })
    );
  });

  it('keeps matching resource keys in different resource types as separate permission rows', () => {
    const base = {
      resourceKey: 'SHARED',
      permissionCode: 'VIEW',
      effect: 'ALLOW' as const,
      grantedByRoles: ['SERVICE_AGENT'],
    };

    expect(effectivePermissionRowId({ ...base, resourceType: 'APP' })).not.toBe(
      effectivePermissionRowId({ ...base, resourceType: 'API' })
    );
  });
});
