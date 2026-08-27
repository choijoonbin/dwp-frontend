import type { PermissionEffect, PermissionSelection } from '@dwp-frontend/shared-utils';

type PermissionValue = Pick<PermissionSelection, 'resourceId' | 'permissionCode' | 'effect'>;

export type RolePermissionChangeKind = 'ADDED' | 'REMOVED' | 'EFFECT_CHANGED';

export type RolePermissionChange = {
  key: string;
  kind: RolePermissionChangeKind;
  resourceId: number;
  permissionCode: string;
  before: PermissionEffect | null;
  after: PermissionEffect | null;
};

export type RolePermissionDiff = {
  added: RolePermissionChange[];
  removed: RolePermissionChange[];
  effectChanged: RolePermissionChange[];
  denyChanges: RolePermissionChange[];
  changes: RolePermissionChange[];
  hasChanges: boolean;
  requiresConfirmation: boolean;
};

export function rolePermissionKey(resourceId: number, permissionCode: string) {
  return `${resourceId}:${permissionCode}`;
}

export function rolePermissionSelectionMap(values: readonly PermissionValue[]) {
  return new Map(
    values.map((value) => [rolePermissionKey(value.resourceId, value.permissionCode), value.effect])
  );
}

export function rolePermissionSelections(
  selection: ReadonlyMap<string, PermissionEffect>
): PermissionSelection[] {
  return [...selection.entries()]
    .map(([key, effect]) => {
      const [resourceId, permissionCode] = key.split(':');
      return { resourceId: Number(resourceId), permissionCode, effect };
    })
    .sort(
      (left, right) =>
        left.resourceId - right.resourceId ||
        left.permissionCode.localeCompare(right.permissionCode)
    );
}

export function calculateRolePermissionDiff(
  initialValues: readonly PermissionValue[],
  nextValues: readonly PermissionValue[],
  privilegedRole: boolean
): RolePermissionDiff {
  const initial = rolePermissionSelectionMap(initialValues);
  const next = rolePermissionSelectionMap(nextValues);
  const keys = [...new Set([...initial.keys(), ...next.keys()])].sort();
  const changes = keys.flatMap<RolePermissionChange>((key) => {
    const before = initial.get(key) ?? null;
    const after = next.get(key) ?? null;
    if (before === after) return [];
    const [resourceId, permissionCode] = key.split(':');
    return [
      {
        key,
        kind: before === null ? 'ADDED' : after === null ? 'REMOVED' : 'EFFECT_CHANGED',
        resourceId: Number(resourceId),
        permissionCode,
        before,
        after,
      },
    ];
  });
  const added = changes.filter((change) => change.kind === 'ADDED');
  const removed = changes.filter((change) => change.kind === 'REMOVED');
  const effectChanged = changes.filter((change) => change.kind === 'EFFECT_CHANGED');
  const denyChanges = changes.filter(
    (change) => change.after === 'DENY' && change.before !== 'DENY'
  );
  const hasChanges = changes.length > 0;

  return {
    added,
    removed,
    effectChanged,
    denyChanges,
    changes,
    hasChanges,
    requiresConfirmation:
      hasChanges && (privilegedRole || removed.length > 0 || denyChanges.length > 0),
  };
}
