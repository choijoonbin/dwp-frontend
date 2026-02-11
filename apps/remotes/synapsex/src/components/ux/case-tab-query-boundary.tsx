/**
 * Case 탭 공통: 쿼리 로딩/에러/빈 상태 경계
 * 로딩 → 스켈레톤, 에러 → TabErrorState, 빈 상태 → emptyContent, 그 외 → children
 */

import type { ReactNode } from 'react';

import { getErrorMessage } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { TabErrorState } from './tab-error-state';
import { TabContentSkeleton } from './tab-content-skeleton';

export type CaseTabQueryBoundaryProps = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  errorTitle: string;
  skeletonCards?: number;
  empty?: boolean;
  emptyContent?: ReactNode;
  children: ReactNode;
};

export const CaseTabQueryBoundary = ({
  isLoading,
  isError,
  error,
  onRetry,
  errorTitle,
  skeletonCards = 2,
  empty = false,
  emptyContent,
  children,
}: CaseTabQueryBoundaryProps) => {
  if (isLoading) return <TabContentSkeleton cards={skeletonCards} />;
  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <TabErrorState
          title={errorTitle}
          message={getErrorMessage(error)}
          onRetry={onRetry}
        />
      </Box>
    );
  }
  if (empty && emptyContent) return <>{emptyContent}</>;
  return <>{children}</>;
};
