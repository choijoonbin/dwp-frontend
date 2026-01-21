// ----------------------------------------------------------------------


import { useMemo, useState, useCallback } from 'react';
import { useCodeGroupsQuery } from '@dwp-frontend/shared-utils';


// ----------------------------------------------------------------------

/**
 * CodeGroups TableState Hook: 조회/필터 상태 관리
 */
export const useCodeGroupsTableState = () => {
  const [keyword, setKeyword] = useState('');
  const [tenantScope, setTenantScope] = useState<'COMMON' | 'TENANT' | 'ALL'>('ALL');
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  const { data: groups, isLoading, error, refetch } = useCodeGroupsQuery();

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!groups) return [];

    let filtered = groups;

    // Filter by keyword
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter(
        (group) =>
          group.groupKey.toLowerCase().includes(lowerKeyword) ||
          group.groupName.toLowerCase().includes(lowerKeyword) ||
          (group.description && group.description.toLowerCase().includes(lowerKeyword))
      );
    }

    // Filter by tenantScope
    if (tenantScope !== 'ALL') {
      filtered = filtered.filter((group) => group.tenantScope === tenantScope);
    }

    // Filter by enabled
    if (enabled !== undefined) {
      filtered = filtered.filter((group) => group.enabled === enabled);
    }

    return filtered;
  }, [groups, keyword, tenantScope, enabled]);

  const resetFilters = useCallback(() => {
    setKeyword('');
    setTenantScope('ALL');
    setEnabled(undefined);
  }, []);

  return {
    keyword,
    tenantScope,
    enabled,
    setKeyword,
    setTenantScope,
    setEnabled,
    filteredGroups,
    isLoading,
    error,
    refetch,
    resetFilters,
  };
};
