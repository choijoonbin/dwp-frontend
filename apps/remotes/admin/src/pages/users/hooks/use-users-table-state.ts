// ----------------------------------------------------------------------

import { useMemo, useState, useCallback } from 'react';
import { useAdminUsersQuery } from '@dwp-frontend/shared-utils';

import { toUserRowModels } from '../adapters/user-adapter';


// ----------------------------------------------------------------------

/**
 * TableState Hook: 조회/목록/선택 상태 관리
 */
export const useUsersTableState = () => {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loginTypeFilter, setLoginTypeFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      page: page + 1,
      size: rowsPerPage,
      keyword: keyword || undefined,
      status: (statusFilter as 'ACTIVE' | 'INACTIVE' | undefined) || undefined,
      departmentId: departmentFilter || undefined,
      // Note: loginType and roleFilter are client-side filters (not in API yet)
    }),
    [page, rowsPerPage, keyword, statusFilter, departmentFilter]
  );

  const { data, isLoading, error, refetch } = useAdminUsersQuery(params);

  // Convert API response to UI Model (UserRowModel[])
  const userRowModels = useMemo(() => {
    if (!data?.items) return [];
    const models = toUserRowModels(data.items);

    // Apply client-side filters
    if (loginTypeFilter) {
      // Filter by loginType (would need accounts data, for now skip)
      // models = models.filter((m) => m.loginType === loginTypeFilter);
    }

    return models;
  }, [data, loginTypeFilter]);

  // Stable callback for keyword change
  const handleKeywordChange = useCallback((newKeyword: string) => {
    setKeyword(newKeyword);
    setPage(0);
  }, []);

  // Stable callback for status filter change
  const handleStatusFilterChange = useCallback((newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(0);
  }, []);

  // Stable callback for login type filter change
  const handleLoginTypeFilterChange = useCallback((newLoginType: string) => {
    setLoginTypeFilter(newLoginType);
    setPage(0);
  }, []);

  // Stable callback for department filter change
  const handleDepartmentFilterChange = useCallback((newDepartment: string) => {
    setDepartmentFilter(newDepartment);
    setPage(0);
  }, []);

  // Stable callback for role filter change
  const handleRoleFilterChange = useCallback((newRole: string) => {
    setRoleFilter(newRole);
    setPage(0);
  }, []);

  // Stable callback for page change
  const handlePageChange = useCallback((_e: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  // Stable callback for rows per page change
  const handleRowsPerPageChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  // Stable callback for user selection
  const handleUserSelect = useCallback((userId: string | null) => {
    setSelectedUserId(userId);
  }, []);

  return {
    // State
    keyword,
    statusFilter,
    loginTypeFilter,
    departmentFilter,
    roleFilter,
    page,
    rowsPerPage,
    selectedUserId,
    // Handlers
    setKeyword: handleKeywordChange,
    setStatusFilter: handleStatusFilterChange,
    setLoginTypeFilter: handleLoginTypeFilterChange,
    setDepartmentFilter: handleDepartmentFilterChange,
    setRoleFilter: handleRoleFilterChange,
    setPage: handlePageChange,
    setRowsPerPage: handleRowsPerPageChange,
    setSelectedUserId: handleUserSelect,
    // Data (UI Models)
    userRowModels,
    // Raw data for compatibility
    usersData: data,
    // Query state
    isLoading,
    error,
    refetch,
  };
};
