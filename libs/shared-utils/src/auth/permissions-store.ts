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
      if (codes?.has(permissionCode)) {
        return true;
      }
      // 메뉴관리: VIEW만 있어도 동일 리소스 CREATE/UPDATE/DELETE 허용 (백엔드가 세분화 권한 미부여 시 admin 사용자 편의)
      if (resourceKey === 'menu.admin.menus' && ['CREATE', 'UPDATE', 'DELETE'].includes(permissionCode)) {
        if (codes?.has('VIEW')) return true;
      }
      // Aura 확장(확장하여 계속 작업하기): 워크벤치(menu.command-center) VIEW가 있으면 ai-workspace VIEW 허용 (미니 챗봇 사용자 동일 권한)
      if (resourceKey === 'menu.ai-workspace' && permissionCode === 'VIEW') {
        if (permissionMap.get('menu.command-center')?.has('VIEW')) return true;
      }
      return false;
    },

    canViewMenu: (resourceKey: string) => get().actions.hasPermission(resourceKey, 'VIEW'),

    canUseButton: (resourceKey: string) => get().actions.hasPermission(resourceKey, 'USE'),
  },
}));
