// ----------------------------------------------------------------------

import { useMemo, useState, useCallback } from 'react';
import { useAdminRolesQuery } from '@dwp-frontend/shared-utils';

import { toRoleRowModels } from '../adapters/role-adapter';


// ----------------------------------------------------------------------

/**
 * TableState Hook: 조회/목록/선택 상태 관리
 * - keyword, filters, sort, page, size
 * - selectedRoleId
 * - Future: rowSelection, expandedRowIds
 */
export const useRoleTableState = () => {
  const [keyword, setKeyword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      size: 1000, // Get all roles for left sidebar
      keyword: keyword || undefined,
    }),
    [keyword]
  );

  const { data: rolesData, isLoading, error, refetch } = useAdminRolesQuery(params);

  // Convert API response to UI Model (RoleRowModel[])
  const roleRowModels = useMemo(() => {
    if (!rolesData?.items) return [];
    return toRoleRowModels(rolesData.items);
  }, [rolesData]);

  // Stable callback for role selection
  const handleRoleSelect = useCallback((roleId: string | null) => {
    setSelectedRoleId(roleId);
  }, []);

  // Stable callback for keyword change
  const handleKeywordChange = useCallback((newKeyword: string) => {
    setKeyword(newKeyword);
    // Clear selection when searching
    if (newKeyword && selectedRoleId) {
      setSelectedRoleId(null);
    }
  }, [selectedRoleId]);

  return {
    // State
    keyword,
    selectedRoleId,
    // Handlers
    setKeyword: handleKeywordChange,
    setSelectedRoleId: handleRoleSelect,
    // Data (UI Models)
    roleRowModels,
    // Raw data for compatibility
    filteredRoles: rolesData?.items || [],
    // Query state
    isLoading,
    error,
    refetch,
  };
};
