import { lazy, Suspense } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

// Lazy load Admin Remote components
// Note: TypeScript may not resolve this path at compile time, but it works at runtime.
// In production, this would be loaded via Module Federation.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Remote app import path
 
const AdminApp = lazy(() => import('../../../remotes/admin/src/admin-app'));

// ----------------------------------------------------------------------

const LoadingFallback = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 400,
    }}
  >
    <CircularProgress />
  </Box>
);

/**
 * AdminModule: Admin Remote 앱을 로드하는 Host 컴포넌트
 * Admin Remote는 독립적으로 실행되지만, Host에서도 접근 가능하도록 구성
 * Host의 라우터가 /admin/* 경로를 처리하므로, 여기서는 AdminApp만 렌더링
 */
export const AdminModule = () => (
  <Suspense fallback={<LoadingFallback />}>
    <AdminApp />
  </Suspense>
);
