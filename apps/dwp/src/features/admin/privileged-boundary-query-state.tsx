import { ErrorState, LoadingState } from '@dwp-frontend/design-system';

import type { ReactNode } from 'react';

type BoundaryQuery = {
  data: unknown;
  error: unknown;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
};

export function PrivilegedBoundaryQueryState({
  query,
  title,
  description,
  retryLabel,
  children,
}: {
  query: BoundaryQuery;
  title: string;
  description: string;
  retryLabel: string;
  children: ReactNode;
}) {
  if (query.isLoading) return <LoadingState label={title} size="compact" />;
  if (query.isError && query.data === undefined) {
    return (
      <ErrorState
        title={title}
        description={description}
        retryLabel={retryLabel}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        size="compact"
      />
    );
  }
  return children;
}
