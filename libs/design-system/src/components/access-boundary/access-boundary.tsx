import { cloneElement, isValidElement } from 'react';
import { usePermissions } from '@dwp-frontend/shared-utils';

type PermissionCode =
  | 'VIEW'
  | 'USE'
  | 'EDIT'
  | 'APPROVE'
  | 'EXECUTE'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'MANAGE';

export type AccessBoundaryProps = {
  resource: string;
  permission?: PermissionCode;
  denied?: React.ReactNode;
  behavior?: 'hide' | 'disable';
  children: React.ReactNode;
};

export function AccessBoundary({
  resource,
  permission = 'VIEW',
  denied = null,
  behavior = 'hide',
  children,
}: AccessBoundaryProps) {
  const { hasPermission, isLoaded } = usePermissions();

  if (!isLoaded) return null;
  if (hasPermission(resource, permission)) return <>{children}</>;

  if (behavior === 'disable' && isValidElement<{ disabled?: boolean }>(children)) {
    return cloneElement(children, { disabled: true });
  }

  return <>{denied}</>;
}
