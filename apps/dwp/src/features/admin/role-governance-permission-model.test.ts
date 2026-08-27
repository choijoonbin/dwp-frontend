import { describe, expect, it } from 'vitest';

import {
  calculateRolePermissionDiff,
  rolePermissionSelectionMap,
  rolePermissionSelections,
} from './role-governance-permission-model';

describe('role governance permission diff', () => {
  const initial = [
    { resourceId: 1, permissionCode: 'VIEW', effect: 'ALLOW' as const },
    { resourceId: 1, permissionCode: 'UPDATE', effect: 'ALLOW' as const },
    { resourceId: 2, permissionCode: 'VIEW', effect: 'DENY' as const },
  ];

  it('separates additions, removals, and effect changes', () => {
    const diff = calculateRolePermissionDiff(
      initial,
      [
        { resourceId: 1, permissionCode: 'VIEW', effect: 'DENY' },
        { resourceId: 2, permissionCode: 'VIEW', effect: 'DENY' },
        { resourceId: 3, permissionCode: 'CREATE', effect: 'ALLOW' },
      ],
      false
    );

    expect(diff.added.map((change) => change.key)).toEqual(['3:CREATE']);
    expect(diff.removed.map((change) => change.key)).toEqual(['1:UPDATE']);
    expect(diff.effectChanged.map((change) => change.key)).toEqual(['1:VIEW']);
    expect(diff.denyChanges.map((change) => change.key)).toEqual(['1:VIEW']);
    expect(diff.requiresConfirmation).toBe(true);
  });

  it('allows a standard-role ALLOW addition without a destructive confirmation', () => {
    const next = [
      ...initial,
      { resourceId: 3, permissionCode: 'CREATE', effect: 'ALLOW' as const },
    ];
    expect(calculateRolePermissionDiff(initial, next, false)).toMatchObject({
      hasChanges: true,
      requiresConfirmation: false,
    });
  });

  it('requires confirmation for every permission change on a privileged role', () => {
    const next = [
      ...initial,
      { resourceId: 3, permissionCode: 'CREATE', effect: 'ALLOW' as const },
    ];
    expect(calculateRolePermissionDiff(initial, next, true).requiresConfirmation).toBe(true);
  });

  it('confirms a new deny but treats changing deny to allow as risk-reducing', () => {
    const denyAdded = calculateRolePermissionDiff(
      initial,
      [...initial, { resourceId: 3, permissionCode: 'DELETE', effect: 'DENY' }],
      false
    );
    expect(denyAdded.denyChanges.map((change) => change.key)).toEqual(['3:DELETE']);
    expect(denyAdded.requiresConfirmation).toBe(true);

    const denyRelaxed = calculateRolePermissionDiff(
      initial,
      initial.map((value) =>
        value.resourceId === 2 && value.permissionCode === 'VIEW'
          ? { ...value, effect: 'ALLOW' as const }
          : value
      ),
      false
    );
    expect(denyRelaxed.effectChanged.map((change) => change.key)).toEqual(['2:VIEW']);
    expect(denyRelaxed.requiresConfirmation).toBe(false);
  });

  it('detects no-op saves and emits a stable request order', () => {
    const selection = rolePermissionSelectionMap([...initial].reverse());
    expect(
      calculateRolePermissionDiff(initial, rolePermissionSelections(selection), false)
    ).toMatchObject({
      hasChanges: false,
      requiresConfirmation: false,
    });
    expect(
      rolePermissionSelections(selection).map(
        (value) => `${value.resourceId}:${value.permissionCode}`
      )
    ).toEqual(['1:UPDATE', '1:VIEW', '2:VIEW']);
  });
});
