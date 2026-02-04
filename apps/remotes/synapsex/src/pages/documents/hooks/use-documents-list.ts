/**
 * Documents 목록 훅 — BE 필터 신뢰 (이중 필터 제거)
 * getFiDocHeaders가 dateFrom, dateTo, bukrs, status, xblnr, amountMin, amountMax를 querystring으로 전달.
 * BE가 해당 필터를 지원한다고 가정. 미지원 시 클라이언트 필터 복원 필요.
 */

import { useMemo, useState } from 'react';
import { useDocumentsListQuery } from '@dwp-frontend/shared-utils';

import type { DocumentFilters } from '../types';

export const useDocumentsList = () => {
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const { data: apiData, isLoading, error, refetch } = useDocumentsListQuery({
    limit: 500,
    page,
    size: pageSize,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    bukrs: filters.bukrs,
    status: filters.status,
    xblnr: filters.xblnr,
    amountMin: filters.amountMin,
    amountMax: filters.amountMax,
  });

  const items = useMemo(() => apiData ?? [], [apiData]);
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedItems = useMemo(
    () => items.slice(page * pageSize, page * pageSize + pageSize),
    [items, page, pageSize]
  );

  const summary = useMemo(() => {
    const totalAmount = items.reduce((s, d) => s + (d.wrbtr ?? 0), 0);
    const flaggedCount = items.filter(
      (d) => d.integrityStatus && d.integrityStatus !== 'pass'
    ).length;
    return {
      totalDocs: totalCount,
      totalAmount,
      flaggedCount,
    };
  }, [items, totalCount]);

  return {
    items: paginatedItems,
    allItems: items,
    isLoading,
    error,
    refetch,
    filters,
    setFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    totalPages,
    summary,
  };
};
