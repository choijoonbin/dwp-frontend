import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  workplaceDelegatedPermissionPermits,
  workplaceDelegatedTargetAllowed,
} from './workplace-delegated-target-permission';
import { isWorkplaceGovernanceUuid } from './workplace-admin-governance-model';
import {
  getWorkplaceGovernanceEffectiveDelegatedScopes,
  hasFullTenantAdminRole,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import type {
  WorkplaceGovernanceDelegatedPermission,
  WorkplaceGovernanceEffectiveDelegatedScope,
} from '@dwp-frontend/shared-utils';

export type PermissionCheck = (resourceKey: string, permissionCode: string) => boolean;

export function resolveRoomsCapabilities(hasPermission: PermissionCheck) {
  return {
    canViewWorkplace: hasPermission('APP.WORKPLACE', 'VIEW'),
    canCreateWorkplaceBooking: hasPermission('APP.WORKPLACE', 'CREATE'),
    canUpdateWorkplaceBooking: hasPermission('APP.WORKPLACE', 'UPDATE'),
    canManageWorkplace: hasPermission('APP.WORKPLACE', 'MANAGE'),
    canViewWorkplaceAdmin: hasPermission('ADMIN.WORKPLACE', 'VIEW'),
    canCreateWorkplaceAdmin: hasPermission('ADMIN.WORKPLACE', 'CREATE'),
    canUpdateWorkplaceAdmin: hasPermission('ADMIN.WORKPLACE', 'UPDATE'),
    canManageWorkplaceAdmin: hasPermission('ADMIN.WORKPLACE', 'MANAGE'),
    canViewRooms: hasPermission('APP.ROOMS', 'VIEW'),
    canCreateRoomBooking: hasPermission('APP.ROOMS', 'CREATE'),
    canUpdateRoomBooking: hasPermission('APP.ROOMS', 'UPDATE'),
    canViewRoomsAdmin: hasPermission('ADMIN.ROOMS', 'VIEW'),
    canCreateRoomsAdmin: hasPermission('ADMIN.ROOMS', 'CREATE'),
    canUpdateRoomsAdmin: hasPermission('ADMIN.ROOMS', 'UPDATE'),
    canManageRoomsAdmin: hasPermission('ADMIN.ROOMS', 'MANAGE'),
  };
}

export function useRoomsCapabilities() {
  const { hasPermission, isLoaded } = usePermissions();
  return { isLoaded, ...resolveRoomsCapabilities(hasPermission) };
}

export function resolveWorkplaceGovernanceCapabilities({
  globalAdministrator,
  canViewWorkplaceAdmin,
  canManageWorkplaceAdmin,
  effectiveScopes,
}: {
  globalAdministrator: boolean;
  canViewWorkplaceAdmin: boolean;
  canManageWorkplaceAdmin: boolean;
  effectiveScopes: readonly WorkplaceGovernanceEffectiveDelegatedScope[];
}) {
  const delegatedPermissions = new Set<WorkplaceGovernanceDelegatedPermission>(
    effectiveScopes.flatMap((scope) => scope.permissions)
  );
  const globallyVisible = globalAdministrator && canViewWorkplaceAdmin;
  const globallyManaged = globalAdministrator && canManageWorkplaceAdmin;
  const has = (permission: WorkplaceGovernanceDelegatedPermission) =>
    delegatedPermissions.has(permission);
  const canViewCatalog =
    globallyVisible ||
    effectiveScopes.some((scope) =>
      workplaceDelegatedPermissionPermits(scope.permissions, 'CATALOG_VIEW')
    );
  const allowsTarget = (
    permission: WorkplaceGovernanceDelegatedPermission,
    siteId: string,
    floorId: string | null = null
  ) => {
    if (
      !isWorkplaceGovernanceUuid(siteId) ||
      (floorId !== null && !isWorkplaceGovernanceUuid(floorId))
    )
      return false;
    // Target scope only; consumers retain the existing action capability checks.
    return (
      globallyVisible ||
      workplaceDelegatedTargetAllowed(effectiveScopes, permission, siteId, floorId)
    );
  };

  return {
    globalAdministrator: globallyVisible,
    effectiveScopes,
    allowsTarget,
    canViewAny:
      canViewCatalog ||
      has('ACCESS_MANAGE') ||
      has('POLICY_MANAGE') ||
      has('FLOOR_PLAN_MANAGE') ||
      has('DELEGATION_VIEW'),
    hierarchy: {
      canView: canViewCatalog,
      canManage: globallyManaged || has('CATALOG_MANAGE'),
      canManageCampus: globallyManaged,
    },
    access: {
      canView: globallyVisible || has('ACCESS_MANAGE'),
      canManage: globallyManaged || has('ACCESS_MANAGE'),
    },
    policy: {
      canView: globallyVisible || has('POLICY_MANAGE'),
      canManage: globallyManaged || has('POLICY_MANAGE'),
    },
    floorPlans: {
      canView: globallyVisible || has('FLOOR_PLAN_MANAGE'),
      canManage: globallyManaged || has('FLOOR_PLAN_MANAGE'),
    },
    delegation: {
      canView: globallyVisible || has('DELEGATION_VIEW'),
      canManage: globallyManaged,
      canViewAssignments: globallyVisible,
    },
    experience: { canView: globallyVisible, canManage: globallyManaged },
  };
}

export function useWorkplaceGovernanceCapabilities() {
  const rooms = useRoomsCapabilities();
  const auth = useAuth();
  const globalAdministrator = hasFullTenantAdminRole(auth.user?.roles ?? []);
  const delegatedScopesQuery = useQuery({
    queryKey: [
      'workplace',
      'governance',
      auth.user?.tenantId,
      auth.user?.userId,
      'delegated-scopes',
      'effective',
    ],
    queryFn: getWorkplaceGovernanceEffectiveDelegatedScopes,
    enabled: rooms.isLoaded && rooms.canViewWorkplaceAdmin && !globalAdministrator,
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: 1,
  });
  const [expiryRevision, updateExpiry] = useState(0);
  const rawScopes = useMemo(
    () => (Array.isArray(delegatedScopesQuery.data) ? delegatedScopesQuery.data : []),
    [delegatedScopesQuery.data]
  );
  useEffect(() => {
    const deadlines = rawScopes
      .flatMap((scope) =>
        typeof scope.validUntil === 'string' ? [Date.parse(scope.validUntil)] : []
      )
      .filter((deadline) => Number.isFinite(deadline) && deadline > Date.now());
    if (!deadlines.length) return undefined;
    const timer = window.setTimeout(
      () => updateExpiry((value) => value + 1),
      Math.min(2_147_483_647, Math.max(1, Math.min(...deadlines) - Date.now()))
    );
    return () => window.clearTimeout(timer);
  }, [rawScopes, delegatedScopesQuery.dataUpdatedAt, expiryRevision]);
  const effectiveScopes = delegatedScopesQuery.isError
    ? []
    : rawScopes.filter(
        (scope) =>
          scope.validUntil === null ||
          (typeof scope.validUntil === 'string' &&
            Number.isFinite(Date.parse(scope.validUntil)) &&
            Date.parse(scope.validUntil) > Date.now())
      );
  const capabilities = resolveWorkplaceGovernanceCapabilities({
    globalAdministrator,
    canViewWorkplaceAdmin: rooms.canViewWorkplaceAdmin,
    canManageWorkplaceAdmin: rooms.canManageWorkplaceAdmin,
    effectiveScopes,
  });

  return {
    ...capabilities,
    isLoaded:
      rooms.isLoaded &&
      (globalAdministrator || !rooms.canViewWorkplaceAdmin || !delegatedScopesQuery.isLoading),
    isError: delegatedScopesQuery.isError,
    refetch: delegatedScopesQuery.refetch,
  };
}
