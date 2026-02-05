// ----------------------------------------------------------------------

import type { DetectRunStatus, DetectRunSummary } from '@dwp-frontend/shared-utils';

import { useMemo, useState, useCallback } from 'react';
import { useDetectRunsQuery } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

const toNum = (v: unknown): number =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

/** API 응답(content) → UI DetectRunSummary 변환. countsJson에서 created/updated/suppressed 추출 */
function toDetectRunSummary(raw: Record<string, unknown>): DetectRunSummary {
  const counts = (raw.countsJson as Record<string, unknown> | undefined) ?? {};
  const created = toNum(counts.caseCreated) || toNum(counts.created_count);
  const updated = toNum(counts.caseUpdated) || toNum(counts.updated_count);
  const suppressed = toNum(counts.suppressed_count);

  const startedAt = raw.startedAt as string | undefined;
  const completedAt = raw.completedAt as string | undefined;
  let durationMs: number | undefined;
  if (startedAt && completedAt) {
    durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  }

  return {
    runId: raw.runId as string | number,
    startedAt: startedAt ?? '',
    status: (raw.status as DetectRunSummary['status']) ?? 'COMPLETED',
    windowFrom: raw.windowFrom as string | undefined,
    windowTo: raw.windowTo as string | undefined,
    durationMs,
    createdCount: created,
    updatedCount: updated,
    suppressedCount: suppressed,
    message: raw.message as string | undefined,
  };
}

const formatDateLocal = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export type BatchFilters = {
  from: string;
  to: string;
  status: DetectRunStatus | '';
};

export const useBatchTableState = () => {
  const getDefaultRange = useCallback(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { now, from };
  }, []);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState<BatchFilters>(() => {
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

  const query = useDetectRunsQuery(params);

  const updateFilter = useCallback(<K extends keyof BatchFilters>(key: K, value: BatchFilters[K]) => {
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

  const items = useMemo(() => {
    const raw = query.data?.items ?? query.data?.content ?? [];
    return raw.map((r: Record<string, unknown>) => toDetectRunSummary(r));
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
