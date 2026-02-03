/**
 * Actions list hook — API with mock fallback
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActionsListQuery, type ActionsListParams } from '@dwp-frontend/shared-utils';

import { mockCases, mockActions } from '../../../data/mock-data';
import { actionListDtoToUi, type ActionListItem } from '../adapters/action-list-adapter';

export const useActionsList = (params?: ActionsListParams) => {
  const [searchParams] = useSearchParams();
  const caseIdFilter = searchParams.get('caseId');

  const apiParams: ActionsListParams = {
    page: params?.page ?? 0,
    size: params?.size ?? 50,
  };
  if (params?.status) apiParams.status = params.status;
  if (params?.type) apiParams.type = params.type;
  if (caseIdFilter) apiParams.caseId = Number(caseIdFilter) || undefined;

  const query = useActionsListQuery(apiParams);

  const items: ActionListItem[] = useMemo(() => {
    if (query.data?.items && query.data.items.length > 0) {
      return query.data.items.map(actionListDtoToUi);
    }
    if (query.isError || !query.data) {
      let list = mockActions.map((a) => ({
        id: a.id,
        caseId: a.caseId,
        actionType: a.actionType,
        type: a.type,
        status: a.status,
        createdAt: a.createdAt,
        description: a.description,
        riskLevel: a.riskLevel,
        autonomyMode: a.autonomyMode,
        requiredApproval: a.requiredApproval,
        targetSystem: a.targetSystem,
        amount: a.amount,
        simulation: a.simulation,
      }));
      if (caseIdFilter) {
        list = list.filter((a) => a.caseId === caseIdFilter);
      }
      return list;
    }
    return [];
  }, [query.data, query.isError, caseIdFilter]);

  const pendingCount = items.filter((a) => a.status === 'pending').length;
  const approvedCount = items.filter((a) => a.status === 'approved').length;
  const executedCount = items.filter((a) => a.status === 'executed').length;

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    caseIdFilter,
    linkedCase: caseIdFilter ? mockCases.find((c) => c.id === caseIdFilter) : undefined,
    pendingCount,
    approvedCount,
    executedCount,
  };
};
