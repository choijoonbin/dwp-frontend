/**
 * Anomalies list hook — API with mock fallback
 */

import { useMemo } from 'react';
import { useAnomaliesListQuery, type AnomaliesListParams } from '@dwp-frontend/shared-utils';

import { mockCases, mockCompanyCodes } from '../../../data/mock-data';
import { anomalyListDtoToUi, type AnomalyListItem } from '../adapters/anomaly-list-adapter';

export type AnomaliesListFilters = {
  searchQuery?: string;
  severity?: string;
  anomalyType?: string;
  companyCode?: string;
};

export const useAnomaliesList = (
  params?: AnomaliesListParams & { filters?: AnomaliesListFilters }
) => {
  const apiParams: AnomaliesListParams = {
    page: params?.page ?? 0,
    size: params?.size ?? 20,
  };
  if (params?.severity) apiParams.severity = params.severity;
  if (params?.anomalyType) apiParams.anomalyType = params.anomalyType;

  const query = useAnomaliesListQuery(apiParams);
  const filters = params?.filters ?? {};

  const items: AnomalyListItem[] = useMemo(() => {
    if (query.data?.items && query.data.items.length > 0) {
      return query.data.items.map(anomalyListDtoToUi);
    }
    if (query.isError || !query.data) {
      return mockCases.map((c) => ({
        id: c.id,
        anomalyType: c.anomalyType,
        severity: c.severity,
        score: c.confidence,
        detectedAt: c.detectedAt,
        caseNumber: c.caseNumber,
        counterparty: c.counterparty,
        docNumber: c.docNumber,
        amount: c.amount,
        currency: c.currency,
        confidence: c.confidence,
        slaDue: c.slaDue,
        assignee: c.assignee,
        companyCode: c.companyCode,
      }));
    }
    return [];
  }, [query.data, query.isError]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.caseNumber.toLowerCase().includes(q) ||
          a.counterparty.toLowerCase().includes(q) ||
          a.docNumber.toLowerCase().includes(q) ||
          a.anomalyType.toLowerCase().includes(q)
      );
    }
    if (filters.severity && filters.severity !== 'all') {
      list = list.filter((a) => a.severity === filters.severity);
    }
    if (filters.anomalyType && filters.anomalyType !== 'all') {
      list = list.filter((a) => a.anomalyType === filters.anomalyType);
    }
    if (filters.companyCode && filters.companyCode !== 'all') {
      list = list.filter((a) => a.companyCode === filters.companyCode);
    }
    return list;
  }, [items, filters.searchQuery, filters.severity, filters.anomalyType, filters.companyCode]);

  const kpi = useMemo(() => {
    const bySev = filteredItems.reduce(
      (acc, r) => {
        acc[r.severity] = (acc[r.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const highRisk = (bySev.critical || 0) + (bySev.high || 0);
    const avgConfidence =
      filteredItems.length > 0
        ? filteredItems.reduce((s, r) => s + r.confidence, 0) / filteredItems.length
        : 0;
    const totalExposure = filteredItems.reduce((s, r) => s + r.amount, 0);
    const currency = filteredItems[0]?.currency || 'USD';
    return { bySev, highRisk, avgConfidence, totalExposure, currency };
  }, [filteredItems]);

  return {
    items: filteredItems,
    kpi,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    companyCodes: mockCompanyCodes,
  };
};
