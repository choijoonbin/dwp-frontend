import { usePermissionsStore } from './permissions-store';

export function usePermissions() {
  const permissions = usePermissionsStore((state) => state.permissions);
  const permissionMap = usePermissionsStore((state) => state.permissionMap);
  const isLoaded = usePermissionsStore((state) => state.isLoaded);
  const hasPermission = usePermissionsStore((state) => state.hasPermission);

  return { permissions, permissionMap, isLoaded, hasPermission };
}
