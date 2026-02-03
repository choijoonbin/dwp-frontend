/**
 * Documents 목록 훅 — API + FE 필터
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
    ...filters,
  });

  const filteredItems = useMemo(() => {
    const items = apiData ?? [];
    let result = [...items];

    if (filters.dateFrom) {
      result = result.filter((d) => d.budat >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      result = result.filter((d) => d.budat <= filters.dateTo!);
    }
    if (filters.bukrs) {
      result = result.filter((d) => d.bukrs === filters.bukrs);
    }
    if (filters.status) {
      result = result.filter(
        (d) =>
          d.statusCode === filters.status ||
          d.integrityStatus === filters.status
      );
    }
    if (filters.xblnr) {
      const q = filters.xblnr.toLowerCase();
      result = result.filter(
        (d) => d.xblnr?.toLowerCase().includes(q)
      );
    }
    if (filters.amountMin != null) {
      result = result.filter((d) => (d.wrbtr ?? 0) >= filters.amountMin!);
    }
    if (filters.amountMax != null) {
      result = result.filter((d) => (d.wrbtr ?? 0) <= filters.amountMax!);
    }

    return result;
  }, [apiData, filters]);

  const totalCount = filteredItems.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedItems = useMemo(
    () =>
      filteredItems.slice(page * pageSize, page * pageSize + pageSize),
    [filteredItems, page, pageSize]
  );

  const summary = useMemo(() => {
    const totalAmount = filteredItems.reduce((s, d) => s + (d.wrbtr ?? 0), 0);
    const flaggedCount = filteredItems.filter(
      (d) => d.integrityStatus && d.integrityStatus !== 'pass'
    ).length;
    return {
      totalDocs: totalCount,
      totalAmount,
      flaggedCount,
    };
  }, [filteredItems, totalCount]);

  return {
    items: paginatedItems,
    allItems: filteredItems,
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
