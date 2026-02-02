import { lazy, Suspense } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Remote app import path
const SynapseApp = lazy(() => import('../../../remotes/synapsex/src/synapse-app'));

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
 * SynapseModule: Synapse Remote 앱을 로드하는 Host 컴포넌트
 * 메뉴는 Menu API로 전달됨. Host 라우터가 /synapse/* 경로를 처리.
 */
export const SynapseModule = () => (
  <Suspense fallback={<LoadingFallback />}>
    <SynapseApp />
  </Suspense>
);
