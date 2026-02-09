/**
 * Cases list hook — API 전용 (mock 제거), 서버 페이지네이션
 */

import { useMemo } from 'react';
import { useCasesListQuery, type CasesListParams } from '@dwp-frontend/shared-utils';

import { caseListDtoToUi } from '../adapters/case-list-adapter';

export type CasesListFilters = {
  searchQuery?: string;
  severities?: string[];
  statuses?: string[];
  anomalyTypes?: string[];
};

export const useCasesList = (
  params?: CasesListParams & { filters?: CasesListFilters }
) => {
  const pageSize = params?.size ?? 20;
  const page0 = params?.page ?? 0;
  const filters = params?.filters ?? {};

  const apiParams: CasesListParams = {
    page: page0,
    size: pageSize,
  };
  if (params?.q || filters.searchQuery) apiParams.q = (params?.q ?? filters.searchQuery)?.trim() || undefined;
  if (params?.severity)
    apiParams.severity = String(params.severity)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .join(',');
  if (params?.status) apiParams.status = params.status;
  if (params?.caseType) apiParams.caseType = params.caseType;
  if (params?.assignee) apiParams.assignee = params.assignee;
  if (params?.assigneeUserId) apiParams.assigneeUserId = params.assigneeUserId;
  if (params?.slaRisk) apiParams.slaRisk = params.slaRisk;
  if (params?.ids) apiParams.ids = params.ids;
  if (params?.caseKey) apiParams.caseKey = params.caseKey;
  if (params?.range) apiParams.range = params.range;
  if (params?.dateFrom) apiParams.dateFrom = params.dateFrom;
  if (params?.dateTo) apiParams.dateTo = params.dateTo;
  if (params?.detectedFrom) apiParams.detectedFrom = params.detectedFrom;
  if (params?.detectedTo) apiParams.detectedTo = params.detectedTo;

  const query = useCasesListQuery(apiParams);

  const { items, totalCount, totalPages } = useMemo(() => {
    if (!query.data) {
      return { items: [], totalCount: 0, totalPages: 1 };
    }
    const rawItems = query.data.items ?? query.data.content ?? query.data.data ?? [];
    const list = rawItems.map(caseListDtoToUi);
    const total = query.data.total ?? query.data.totalElements ?? rawItems.length;
    const totalPagesVal = query.data.totalPages ?? (Math.ceil(total / pageSize) || 1);
    return {
      items: list,
      totalCount: total,
      totalPages: totalPagesVal,
    };
  }, [query.data, pageSize]);

  const filtersApplied = query.data?.filtersApplied;

  const paginatedItems = items;

  const triageBacklogCount = useMemo(
    () =>
      items.filter(
        (c) =>
          (c.status === 'open' || c.status === 'triage' || c.status === 'in_progress') &&
          (c.severity === 'critical' || c.severity === 'high')
      ).length,
    [items]
  );

  return {
    items: paginatedItems,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    totalCount,
    totalPages,
    page: page0 + 1,
    pageSize,
    triageBacklogCount,
    filtersApplied,
  };
};
