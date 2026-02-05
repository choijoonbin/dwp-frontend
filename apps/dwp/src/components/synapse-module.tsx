import { lazy, Suspense } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

/* eslint-disable import/no-unresolved -- Vite alias @synapse-app (Host vite.config) */
// @ts-expect-error - Remote app import path (alias로 workspace 내 절대경로 해석)
const SynapseApp = lazy(() => import('@synapse-app'));

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
