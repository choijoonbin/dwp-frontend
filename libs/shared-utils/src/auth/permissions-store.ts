import { create } from 'zustand';

import type { PermissionDTO } from '../api/auth-api';

type PermissionsState = {
  permissions: PermissionDTO[];
  permissionMap: Map<string, Set<string>>;
  isLoaded: boolean;
  setPermissions: (permissions: PermissionDTO[]) => void;
  clearPermissions: () => void;
  hasPermission: (resourceKey: string, permissionCode?: string) => boolean;
};

function toPermissionMap(permissions: PermissionDTO[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const permission of permissions) {
    if (permission.effect !== 'ALLOW') continue;
    const codes = map.get(permission.resourceKey) || new Set<string>();
    codes.add(permission.permissionCode);
    map.set(permission.resourceKey, codes);
  }
  return map;
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  permissions: [],
  permissionMap: new Map(),
  isLoaded: false,
  setPermissions: (permissions) =>
    set({ permissions, permissionMap: toPermissionMap(permissions), isLoaded: true }),
  clearPermissions: () => set({ permissions: [], permissionMap: new Map(), isLoaded: false }),
  hasPermission: (resourceKey, permissionCode = 'VIEW') =>
    get().permissionMap.get(resourceKey)?.has(permissionCode) ?? false,
}));
