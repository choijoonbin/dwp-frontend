// ----------------------------------------------------------------------

import type { IngestRunStatus, IngestRunSummary } from '@dwp-frontend/shared-utils';

import { useMemo, useState, useCallback } from 'react';
import { useIngestRunsQuery } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

const formatDateLocal = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export type IngestFilters = {
  from: string;
  to: string;
  status: IngestRunStatus | '';
};

export const useIngestTableState = () => {
  const getDefaultRange = useCallback(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { now, from };
  }, []);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState<IngestFilters>(() => {
    const { now, from } = getDefaultRange();
    return {
      from: formatDateLocal(from),
      to: formatDateLocal(now),
      status: '',
    };
  });

  const params = useMemo(
    () => ({
      page,
      size: rowsPerPage,
      sort: 'startedAt,desc',
      from: filters.from ? new Date(filters.from).toISOString().slice(0, 19) : undefined,
      to: filters.to ? new Date(filters.to).toISOString().slice(0, 19) : undefined,
      status: filters.status || undefined,
    }),
    [page, rowsPerPage, filters]
  );

  const query = useIngestRunsQuery(params);

  const updateFilter = useCallback(<K extends keyof IngestFilters>(key: K, value: IngestFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  const resetFilters = useCallback(() => {
    const { now, from } = getDefaultRange();
    setFilters({
      from: formatDateLocal(from),
      to: formatDateLocal(now),
      status: '',
    });
    setPage(0);
  }, [getDefaultRange]);

  const items: IngestRunSummary[] = useMemo(() => {
    const raw = query.data?.items ?? query.data?.content ?? [];
    return raw;
  }, [query.data]);
  const total = query.data?.total ?? query.data?.totalElements ?? items.length;
  const totalPages = query.data?.totalPages ?? (Math.ceil(total / rowsPerPage) || 1);

  return {
    page,
    rowsPerPage,
    filters,
    setPage,
    setRowsPerPage,
    updateFilter,
    resetFilters,
    data: query.data,
    items,
    total,
    totalPages,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    params,
  };
};
