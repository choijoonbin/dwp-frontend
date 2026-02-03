/**
 * Cases list hook — API with mock fallback
 */

import { useMemo } from 'react';
import { useCasesListQuery, type CasesListParams } from '@dwp-frontend/shared-utils';

import { mockCases } from '../../../data/mock-data';
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

  const apiParams: CasesListParams = {
    page: page0,
    size: pageSize,
  };
  if (params?.severity) apiParams.severity = params.severity;
  if (params?.status) apiParams.status = params.status;
  if (params?.caseType) apiParams.caseType = params.caseType;

  const query = useCasesListQuery(apiParams);
  const filters = params?.filters ?? {};

  const { items: rawItems, fromApi } = useMemo(() => {
    if (query.data?.items && query.data.items.length > 0) {
      const list = query.data.items.map(caseListDtoToUi);
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        return {
          items: list.filter(
            (c) =>
              c.caseNumber.toLowerCase().includes(q) ||
              c.counterparty.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q)
          ),
          fromApi: true,
        };
      }
      return { items: list, fromApi: true };
    }
    if (query.isError || !query.data) {
      let list = mockCases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        severity: c.severity,
        status: c.status,
        anomalyType: c.anomalyType,
        companyCode: c.companyCode,
        counterparty: c.counterparty,
        counterpartyId: c.counterpartyId,
        amount: c.amount,
        currency: c.currency,
        detectedAt: c.detectedAt,
        createdAt: c.createdAt,
        slaDue: c.slaDue,
        assignee: c.assignee,
        confidence: c.confidence,
        fiDocId: c.fiDocId,
        docNumber: c.docNumber,
        docType: c.docType,
        description: c.description,
      }));
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        list = list.filter(
          (c) =>
            c.caseNumber.toLowerCase().includes(q) ||
            c.counterparty.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)
        );
      }
      if (filters.severities?.length) {
        list = list.filter((c) => filters.severities!.includes(c.severity));
      }
      if (filters.statuses?.length) {
        list = list.filter((c) => filters.statuses!.includes(c.status));
      }
      if (filters.anomalyTypes?.length) {
        list = list.filter((c) => filters.anomalyTypes!.includes(c.anomalyType));
      }
      return { items: list, fromApi: false };
    }
    return { items: [], fromApi: false };
  }, [query.data, query.isError, filters.searchQuery, filters.severities, filters.statuses, filters.anomalyTypes]);

  const items = useMemo(() => {
    if (fromApi) return rawItems;
    const start = page0 * pageSize;
    return rawItems.slice(start, start + pageSize);
  }, [rawItems, fromApi, page0, pageSize]);

  const totalCount = fromApi ? (query.data?.total ?? rawItems.length) : rawItems.length;
  const totalPages = fromApi
    ? (query.data?.totalPages ?? 1)
    : Math.ceil(totalCount / pageSize) || 1;

  const triageBacklogCount = useMemo(
    () =>
      rawItems.filter(
        (c) =>
          (c.status === 'open' || c.status === 'triage' || c.status === 'in_progress') &&
          (c.severity === 'critical' || c.severity === 'high')
      ).length,
    [rawItems]
  );

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    totalCount,
    totalPages,
    page: page0 + 1,
    pageSize,
    triageBacklogCount,
  };
};
