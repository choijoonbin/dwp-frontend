/**
 * Archive list hook — API 전용 (mock 제거)
 */

import { useMemo } from 'react';
import { useArchiveListQuery, type ArchiveListParams } from '@dwp-frontend/shared-utils';

import { archiveListDtoToUi, type ArchiveListItem } from '../adapters/archive-list-adapter';

export const useArchiveList = (params?: ArchiveListParams) => {
  const query = useArchiveListQuery(params);

  const items: ArchiveListItem[] = useMemo(() => {
    if (!query.data?.items) return [];
    return query.data.items.map(archiveListDtoToUi);
  }, [query.data?.items]);

  const completedCount = items.filter((a) => a.status === 'executed' || a.status === 'completed').length;
  const failedCount = items.filter((a) => a.status === 'failed').length;
  const pendingCount = items.filter((a) => a.status === 'pending').length;

  const linkedCases: Array<{ id: string; caseNumber?: string; title?: string }> = [];

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    completedCount,
    failedCount,
    pendingCount,
    linkedCases,
  };
};
