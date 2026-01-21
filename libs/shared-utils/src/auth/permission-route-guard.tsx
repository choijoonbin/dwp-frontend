import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { usePermissions } from './use-permissions';

// ----------------------------------------------------------------------

type PermissionRouteGuardProps = {
  resource: string;
  permission?: 'VIEW' | 'USE' | 'CREATE' | 'UPDATE' | 'DELETE' | 'MANAGE';
  redirectTo?: string;
  children: React.ReactNode;
};

/**
 * PermissionRouteGuard: 권한 기반 라우트 보호
 * 권한이 없으면 redirectTo로 리다이렉트하거나 403 페이지로 이동
 *
 * @example
 * <PermissionRouteGuard resource="menu.admin" redirectTo="/">
 *   <AdminRoutes />
 * </PermissionRouteGuard>
 */
export const PermissionRouteGuard = ({
  resource,
  permission = 'VIEW',
  redirectTo = '/403',
  children,
}: PermissionRouteGuardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, isLoaded } = usePermissions();

  useEffect(() => {
    if (isLoaded && !hasPermission(resource, permission)) {
      // 권한이 없으면 리다이렉트
      navigate(redirectTo, { replace: true });
    }
  }, [isLoaded, hasPermission, resource, permission, navigate, redirectTo]);

  // 권한이 로드되지 않았거나 권한이 없으면 null 반환
  if (!isLoaded) {
    return null; // 또는 로딩 스피너
  }

  if (!hasPermission(resource, permission)) {
    return null;
  }

  return <>{children}</>;
};
