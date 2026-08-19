import { useQuery } from '@tanstack/react-query';
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
  const canViewCatalog = globallyVisible || has('CATALOG_VIEW') || has('CATALOG_MANAGE');

  return {
    globalAdministrator: globallyVisible,
    effectiveScopes,
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
  };
}

export function useWorkplaceGovernanceCapabilities() {
  const rooms = useRoomsCapabilities();
  const auth = useAuth();
  const globalAdministrator = hasFullTenantAdminRole(auth.user?.roles ?? []);
  const delegatedScopesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'delegated-scopes', 'effective'],
    queryFn: getWorkplaceGovernanceEffectiveDelegatedScopes,
    enabled: rooms.isLoaded && rooms.canViewWorkplaceAdmin && !globalAdministrator,
    staleTime: 10_000,
    retry: 1,
  });
  const capabilities = resolveWorkplaceGovernanceCapabilities({
    globalAdministrator,
    canViewWorkplaceAdmin: rooms.canViewWorkplaceAdmin,
    canManageWorkplaceAdmin: rooms.canManageWorkplaceAdmin,
    effectiveScopes: delegatedScopesQuery.data ?? [],
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
