/**
 * Archive list hook — API with mock fallback
 */

import { useMemo } from 'react';
import { useArchiveListQuery, type ArchiveListParams } from '@dwp-frontend/shared-utils';

import { mockCases, mockActions } from '../../../data/mock-data';
import { archiveListDtoToUi, type ArchiveListItem } from '../adapters/archive-list-adapter';

export const useArchiveList = (params?: ArchiveListParams) => {
  const query = useArchiveListQuery(params);

  const items: ArchiveListItem[] = useMemo(() => {
    if (query.data?.items && query.data.items.length > 0) {
      return query.data.items.map(archiveListDtoToUi);
    }
    if (query.isError || !query.data) {
      return mockActions
        .filter((a) => ['executed', 'failed', 'completed'].includes(a.status))
        .map((a) => ({
          id: a.id,
          caseId: a.caseId,
          actionType: a.actionType,
          type: a.type,
          status: a.status,
          description: a.description,
          amount: a.amount,
          createdAt: a.createdAt,
        }));
    }
    return [];
  }, [query.data, query.isError]);

  const completedCount = items.filter((a) => a.status === 'executed' || a.status === 'completed').length;
  const failedCount = items.filter((a) => a.status === 'failed').length;
  const pendingCount = items.filter((a) => a.status === 'pending').length;

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    completedCount,
    failedCount,
    pendingCount,
    linkedCases: mockCases,
  };
};
