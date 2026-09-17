import { usePermissions } from '@dwp-frontend/shared-utils';

export function mailUserPermissionProjection(
  isLoaded: boolean,
  hasPermission: (resourceKey: string, permissionCode?: string) => boolean
) {
  const allowed = (permission: 'VIEW' | 'CREATE' | 'UPDATE' | 'SEND' | 'DELETE' | 'DECIDE') =>
    isLoaded && hasPermission('APP.MAIL', permission);
  return {
    isLoaded,
    canView: allowed('VIEW'),
    canCreate: allowed('CREATE'),
    canUpdate: allowed('UPDATE'),
    canSend: allowed('SEND'),
    canDelete: allowed('DELETE'),
    canDecide: allowed('DECIDE'),
  };
}

export function useMailUserPermissions() {
  const { hasPermission, isLoaded } = usePermissions();
  return mailUserPermissionProjection(isLoaded, hasPermission);
}
