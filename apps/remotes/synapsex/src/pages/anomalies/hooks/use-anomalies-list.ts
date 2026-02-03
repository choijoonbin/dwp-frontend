/**
 * Anomalies list hook — API 전용 (mock 제거)
 */

import { useMemo } from 'react';
import {
  useAnomaliesListQuery,
  type AnomaliesListParams,
  useCompanyCodeCatalogQuery,
} from '@dwp-frontend/shared-utils';

import { anomalyListDtoToUi } from '../adapters/anomaly-list-adapter';

export type AnomaliesListFilters = {
  searchQuery?: string;
  severity?: string;
  anomalyType?: string;
  companyCode?: string;
};

export const useAnomaliesList = (
  params?: AnomaliesListParams & { filters?: AnomaliesListFilters }
) => {
  const pageSize = params?.size ?? 20;
  const page0 = params?.page ?? 0;
  const filters = params?.filters ?? {};

  const apiParams: AnomaliesListParams = {
    page: page0,
    size: pageSize,
  };
  if (params?.severity ?? filters.severity) apiParams.severity = params?.severity ?? filters.severity;
  if (params?.anomalyType ?? filters.anomalyType) apiParams.anomalyType = params?.anomalyType ?? filters.anomalyType;
  if (params?.detectedFrom) apiParams.detectedFrom = params.detectedFrom;
  if (params?.detectedTo) apiParams.detectedTo = params.detectedTo;

  const query = useAnomaliesListQuery(apiParams);
  const { data: catalogData } = useCompanyCodeCatalogQuery({ enabled: true });
  const companyCodes = (catalogData ?? []).map((c) => ({ code: c.bukrs, name: c.bukrs }));

  const { items, totalCount, totalPages, kpi } = useMemo(() => {
    if (!query.data) {
      return {
        items: [],
        totalCount: 0,
        totalPages: 1,
        kpi: {
          bySev: { critical: 0, high: 0, medium: 0, low: 0 },
          highRisk: 0,
          avgConfidence: 0,
          totalExposure: 0,
          currency: 'USD',
        },
      };
    }
    let list = (query.data.items ?? []).map(anomalyListDtoToUi);
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.caseNumber.toLowerCase().includes(q) ||
          (a.anomalyType ?? '').toLowerCase().includes(q) ||
          (a.docKey ?? '').toLowerCase().includes(q)
      );
    }
    if (filters.companyCode) {
      list = list.filter((a) => a.companyCode === filters.companyCode);
    }
    const total = query.data.total ?? query.data.items?.length ?? 0;
    const totalPagesVal = query.data.totalPages ?? (Math.ceil(total / pageSize) || 1);

    const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
    list.forEach((a) => {
      const s = a.severity as keyof typeof bySev;
      if (bySev[s] !== undefined) bySev[s] += 1;
    });
    const highRisk = list.filter(
      (a) => (a.severity === 'critical' || a.severity === 'high') && a.confidence > 70
    ).length;
    const avgConfidence = list.length ? list.reduce((s, a) => s + a.confidence, 0) / list.length / 100 : 0;
    const totalExposure = list.reduce((s, a) => s + (a.amount ?? 0), 0);

    return {
      items: list,
      totalCount: filters.searchQuery || filters.companyCode ? list.length : total,
      totalPages: filters.searchQuery || filters.companyCode ? Math.ceil(list.length / pageSize) || 1 : totalPagesVal,
      kpi: {
        bySev,
        highRisk,
        avgConfidence,
        totalExposure,
        currency: 'USD',
      },
    };
  }, [query.data, filters.searchQuery, filters.companyCode, pageSize]);

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    totalCount,
    totalPages,
    page: page0 + 1,
    pageSize,
    kpi,
    companyCodes,
  };
};
