/**
 * Actions list hook — API 전용 (mock 제거)
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCasesListQuery,
  useActionsListQuery,
  type ActionsListParams,
} from '@dwp-frontend/shared-utils';

import { actionListDtoToUi, type ActionListItem } from '../adapters/action-list-adapter';

export const useActionsList = (params?: ActionsListParams) => {
  const [searchParams] = useSearchParams();
  const caseIdFilter = searchParams.get('caseId');
  const assigneeFilter = searchParams.get('assignee');
  const statusFilter = searchParams.get('status');
  const actionStatusFilter = searchParams.get('actionStatus');
  const requiresApprovalFilter = searchParams.get('requiresApproval');
  const focusActionId = searchParams.get('focus');

  const apiParams: ActionsListParams = {
    page: params?.page ?? 0,
    size: params?.size ?? 50,
  };
  if (params?.status ?? statusFilter) apiParams.status = params?.status ?? statusFilter ?? undefined;
  if (params?.actionStatus ?? actionStatusFilter)
    apiParams.actionStatus = params?.actionStatus ?? actionStatusFilter ?? undefined;
  if (params?.requiresApproval !== undefined)
    apiParams.requiresApproval = params.requiresApproval;
  else if (requiresApprovalFilter === 'true') apiParams.requiresApproval = true;
  if (params?.type) apiParams.type = params.type;
  if (caseIdFilter) apiParams.caseId = caseIdFilter;
  if (params?.assignee ?? assigneeFilter) apiParams.assignee = params?.assignee ?? assigneeFilter ?? undefined;
  if (params?.focus ?? focusActionId) apiParams.focus = params?.focus ?? focusActionId ?? undefined;

  const query = useActionsListQuery(apiParams);
  const casesQuery = useCasesListQuery({ size: 500 });

  const items: ActionListItem[] = useMemo(() => {
    if (!query.data?.items) return [];
    return query.data.items.map(actionListDtoToUi);
  }, [query.data?.items]);

  const linkedCase = useMemo(() => {
    if (!caseIdFilter || !casesQuery.data?.items) return undefined;
    const cases = casesQuery.data.items;
    const found = cases.find((item) => String(item.caseId) === caseIdFilter);
    return found
      ? {
          id: String(found.caseId),
          caseNumber: `CS-${found.caseId}`,
          title: found.reasonTextShort ?? `Case ${found.caseId}`,
        }
      : undefined;
  }, [caseIdFilter, casesQuery.data?.items]);

  const pendingCount = items.filter((a) => a.status === 'pending').length;
  const approvedCount = items.filter((a) => a.status === 'approved').length;
  const executedCount = items.filter((a) => a.status === 'executed').length;

  const filtersApplied = query.data?.filtersApplied;

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    caseIdFilter,
    assigneeFilter,
    statusFilter,
    actionStatusFilter: actionStatusFilter ?? undefined,
    requiresApprovalFilter: requiresApprovalFilter === 'true',
    focusActionId: focusActionId ?? undefined,
    linkedCase,
    pendingCount,
    approvedCount,
    executedCount,
    casesForDropdown: casesQuery.data?.items ?? [],
    filtersApplied,
  };
};
