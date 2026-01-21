// ----------------------------------------------------------------------

import type { AuditLogListParams } from '@dwp-frontend/shared-utils';

import { useMemo, useState, useCallback } from 'react';
import { useAdminAuditLogsQuery } from '@dwp-frontend/shared-utils';

import type { AuditLogTableState } from '../types';

// ----------------------------------------------------------------------

/**
 * AuditLogs TableState Hook: 조회/필터 상태 관리
 */
export const useAuditLogsTableState = () => {
  const formatDateTimeLocal = (date: Date) => {
    // Returns YYYY-MM-DDTHH:mm in local time (avoids UTC shift in toISOString)
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState<AuditLogTableState>({
    from: formatDateTimeLocal(defaultFrom),
    to: formatDateTimeLocal(now),
    actor: '',
    action: '',
    keyword: '',
  });

  // Build query params
  const params = useMemo<AuditLogListParams>(() => {
    // Convert datetime-local (YYYY-MM-DDTHH:mm[:ss]) to ISO string (UTC)
    const convertToISO = (datetimeLocal: string): string => {
      if (!datetimeLocal) return '';
      const withSeconds = datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal;
      return new Date(withSeconds).toISOString().slice(0, 19);
    };

    return {
      page: page + 1,
      size: rowsPerPage,
      from: filters.from ? convertToISO(filters.from) : convertToISO(formatDateTimeLocal(defaultFrom)),
      to: filters.to ? convertToISO(filters.to) : convertToISO(formatDateTimeLocal(now)),
      actor: filters.actor || undefined,
      action: filters.action || undefined,
      keyword: filters.keyword || undefined,
    };
  }, [page, rowsPerPage, filters]);

  const { data, isLoading, error, refetch } = useAdminAuditLogsQuery(params);

  const updateFilter = useCallback(<K extends keyof AuditLogTableState>(key: K, value: AuditLogTableState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0); // Reset to first page when filter changes
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      from: formatDateTimeLocal(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), // 7 days ago
      to: formatDateTimeLocal(new Date()),
      actor: '',
      action: '',
      keyword: '',
    });
    setPage(0);
  }, []);

  return {
    page,
    rowsPerPage,
    filters,
    setPage,
    setRowsPerPage,
    updateFilter,
    resetFilters,
    data,
    isLoading,
    error,
    refetch,
    params, // For export
  };
};
