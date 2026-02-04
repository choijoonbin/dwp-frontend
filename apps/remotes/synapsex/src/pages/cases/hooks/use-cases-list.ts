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
  if (params?.detectedFrom) apiParams.detectedFrom = params.detectedFrom;
  if (params?.detectedTo) apiParams.detectedTo = params.detectedTo;

  const query = useCasesListQuery(apiParams);

  const { items, totalCount, totalPages } = useMemo(() => {
    if (!query.data) {
      return { items: [], totalCount: 0, totalPages: 1 };
    }
    const rawItems = query.data.items ?? query.data.content ?? query.data.data ?? [];
    const list = rawItems.map(caseListDtoToUi);
    let filtered = list;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(q) ||
          (c.counterparty ?? '').toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q)
      );
    }
    if (filters.severities?.length) {
      filtered = filtered.filter((c) => filters.severities!.includes(c.severity));
    }
    if (filters.statuses?.length) {
      filtered = filtered.filter((c) => filters.statuses!.includes(c.status));
    }
    if (filters.anomalyTypes?.length) {
      filtered = filtered.filter((c) => filters.anomalyTypes!.includes(c.anomalyType));
    }
    const total = query.data.total ?? query.data.totalElements ?? rawItems.length;
    const totalPagesVal = query.data.totalPages ?? (Math.ceil(total / pageSize) || 1);
    return {
      items: filtered,
      totalCount: filters.searchQuery || filters.severities?.length || filters.statuses?.length || filters.anomalyTypes?.length
        ? filtered.length
        : total,
      totalPages: filters.searchQuery || filters.severities?.length || filters.statuses?.length || filters.anomalyTypes?.length
        ? Math.ceil(filtered.length / pageSize) || 1
        : totalPagesVal,
    };
  }, [query.data, filters.searchQuery, filters.severities, filters.statuses, filters.anomalyTypes, pageSize]);

  const filtersApplied = query.data?.filtersApplied;

  const paginatedItems = useMemo(() => {
    const hasClientFilter = filters.searchQuery || filters.severities?.length || filters.statuses?.length || filters.anomalyTypes?.length;
    if (hasClientFilter) {
      const start = page0 * pageSize;
      return items.slice(start, start + pageSize);
    }
    return items;
  }, [items, page0, pageSize, filters.searchQuery, filters.severities, filters.statuses, filters.anomalyTypes]);

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
