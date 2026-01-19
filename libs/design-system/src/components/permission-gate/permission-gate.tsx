import React from 'react';
import { usePermissions } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

type PermissionGateProps = {
  resource: string;
  permission?: 'VIEW' | 'USE' | 'CREATE' | 'UPDATE' | 'DELETE' | 'MANAGE';
  fallback?: React.ReactNode;
  mode?: 'hide' | 'disable';
  children: React.ReactNode;
};

/**
 * PermissionGate: 권한 기반으로 children을 표시하거나 비활성화합니다.
 *
 * @example
 * <PermissionGate resource="btn.mail.send" permission="USE">
 *   <Button>Send</Button>
 * </PermissionGate>
 *
 * @example
 * <PermissionGate resource="menu.admin" mode="disable" fallback={<Button disabled>No Access</Button>}>
 *   <Button>Admin</Button>
 * </PermissionGate>
 */
export const PermissionGate = ({
  resource,
  permission = 'VIEW',
  fallback = null,
  mode = 'hide',
  children,
}: PermissionGateProps) => {
  const { hasPermission, isLoaded } = usePermissions();

  // 권한이 로드되지 않았으면 아무것도 표시하지 않음
  if (!isLoaded) {
    return null;
  }

  const hasAccess = hasPermission(resource, permission);

  if (!hasAccess) {
    if (mode === 'disable' && React.isValidElement(children)) {
      // children을 disabled 상태로 복제
      const child = children as React.ReactElement<{ disabled?: boolean }>;
      return React.cloneElement(child, { ...child.props, disabled: true });
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
