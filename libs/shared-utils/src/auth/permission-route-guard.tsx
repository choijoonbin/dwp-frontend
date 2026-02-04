import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { usePermissions } from './use-permissions';
import { usePermissionsStore } from './permissions-store';

// ----------------------------------------------------------------------

const LOAD_TIMEOUT_MS = 5000;

type PermissionRouteGuardProps = {
  resource: string;
  permission?:
    | 'VIEW'
    | 'USE'
    | 'EDIT'
    | 'APPROVE'
    | 'EXECUTE'
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'MANAGE';
  redirectTo?: string;
  children: React.ReactNode;
};

/**
 * PermissionRouteGuard: 권한 기반 라우트 보호
 * 권한이 없으면 redirectTo로 리다이렉트하거나 403 페이지로 이동
 * 권한 미로드 시 로딩 표시, LOAD_TIMEOUT_MS 초과 시 fail-open(빈 권한으로 진행)
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
  const { hasPermission, isLoaded } = usePermissions();
  const [timedOut, setTimedOut] = useState(false);

  // 권한 API 미구현(404 등) 시 무한 대기 방지: LOAD_TIMEOUT_MS 후 fail-open
  useEffect(() => {
    if (isLoaded) return () => {};
    const t = setTimeout(() => {
      setTimedOut(true);
      usePermissionsStore.getState().actions.setPermissions([]);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isLoaded]);

  const effectiveLoaded = isLoaded || timedOut;

  useEffect(() => {
    if (effectiveLoaded && !hasPermission(resource, permission)) {
      navigate(redirectTo, { replace: true });
    }
  }, [effectiveLoaded, hasPermission, resource, permission, navigate, redirectTo]);

  if (!effectiveLoaded) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
        }}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!hasPermission(resource, permission)) {
    return null;
  }

  return <>{children}</>;
};
