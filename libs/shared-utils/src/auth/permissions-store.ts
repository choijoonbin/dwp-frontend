import { create } from 'zustand';

import type { PermissionDTO } from '../api/auth-api';

// ----------------------------------------------------------------------

export type PermissionsState = {
  permissions: PermissionDTO[];
  permissionMap: Map<string, Set<string>>; // resourceKey -> Set<permissionCode>
  isLoaded: boolean;
  actions: {
    setPermissions: (permissions: PermissionDTO[]) => void;
    clearPermissions: () => void;
    hasPermission: (resourceKey: string, permissionCode?: string) => boolean;
    canViewMenu: (resourceKey: string) => boolean;
    canUseButton: (resourceKey: string) => boolean;
  };
};

/**
 * Build permission map from permissions array
 * resourceKey -> Set<permissionCode>
 */
const buildPermissionMap = (permissions: PermissionDTO[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();

  permissions.forEach((perm) => {
    // Only process ALLOW permissions (DENY is for future use)
    if (perm.effect !== 'ALLOW') {
      return;
    }

    if (!map.has(perm.resourceKey)) {
      map.set(perm.resourceKey, new Set());
    }
    map.get(perm.resourceKey)!.add(perm.permissionCode);
  });

  return map;
};

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  permissions: [],
  permissionMap: new Map(),
  isLoaded: false,

  actions: {
    setPermissions: (permissions: PermissionDTO[]) => {
      const permissionMap = buildPermissionMap(permissions);
      set({ permissions, permissionMap, isLoaded: true });
    },

    clearPermissions: () => {
      set({
        permissions: [],
        permissionMap: new Map(),
        isLoaded: false,
      });
    },

    hasPermission: (resourceKey: string, permissionCode: string = 'VIEW') => {
      const { permissionMap } = get();
      const codes = permissionMap.get(resourceKey);
      if (!codes) {
        return false;
      }
      return codes.has(permissionCode);
    },

    canViewMenu: (resourceKey: string) => get().actions.hasPermission(resourceKey, 'VIEW'),

    canUseButton: (resourceKey: string) => get().actions.hasPermission(resourceKey, 'USE'),
  },
}));
