import { describe, expect, it, vi } from 'vitest';

import {
  assignmentSourceLabel,
  assignmentTypeLabel,
  permissionCodeLabel,
  resourceTypeLabel,
  roleScopeLabel,
  roleStatusLabel,
  roleTypeLabel,
} from './role-governance-display';

const t = vi.fn((key: string) => key) as never;

describe('role governance presentation', () => {
  it('maps known governance values to localized keys', () => {
    expect(roleTypeLabel('SYSTEM', t)).toBe('roleGovernance.roleTypes.SYSTEM');
    expect(roleStatusLabel('ACTIVE', t)).toBe('roleGovernance.statuses.ACTIVE');
    expect(roleScopeLabel('TENANT', t)).toBe('roleGovernance.scopes.TENANT');
  });

  it('fails closed for unknown role and permission values', () => {
    const values = [
      roleTypeLabel('FUTURE_ROLE', t),
      roleStatusLabel('FUTURE_STATUS', t),
      roleScopeLabel('FUTURE_SCOPE', t),
      assignmentSourceLabel('FUTURE_SOURCE', t),
      assignmentTypeLabel('FUTURE_ASSIGNMENT', t),
      permissionCodeLabel('FUTURE_PERMISSION', t),
      resourceTypeLabel('FUTURE_RESOURCE', t),
    ];
    expect(values.every((value) => value.endsWith('.UNKNOWN'))).toBe(true);
    expect(values.join(' ')).not.toContain('FUTURE_');
  });
});
