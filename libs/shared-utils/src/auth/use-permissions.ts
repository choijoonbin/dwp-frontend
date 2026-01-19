import { usePermissionsStore } from './permissions-store';

// ----------------------------------------------------------------------

/**
 * Hook to check permissions
 * @example
 * const { hasPermission, canViewMenu, canUseButton } = usePermissions();
 * if (hasPermission('menu.admin', 'VIEW')) { ... }
 */
export const usePermissions = () => {
  const { permissions, permissionMap, isLoaded, actions } = usePermissionsStore();

  return {
    permissions,
    permissionMap,
    isLoaded,
    hasPermission: actions.hasPermission,
    canViewMenu: actions.canViewMenu,
    canUseButton: actions.canUseButton,
  };
};
