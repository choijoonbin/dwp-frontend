// ----------------------------------------------------------------------


import { useMemo, useState, useCallback } from 'react';
import { useCodesByGroupQuery } from '@dwp-frontend/shared-utils';


// ----------------------------------------------------------------------

/**
 * Codes TableState Hook: 조회/필터 상태 관리
 */
export const useCodesTableState = (groupKey: string) => {
  const [keyword, setKeyword] = useState('');
  const [tenantScope, setTenantScope] = useState<'COMMON' | 'TENANT' | 'ALL'>('ALL');
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  const { data: codes, isLoading, error, refetch } = useCodesByGroupQuery(groupKey);

  // Filter codes
  const filteredCodes = useMemo(() => {
    if (!codes) return [];

    let filtered = codes;

    // Filter by keyword
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter(
        (code) =>
          code.codeKey.toLowerCase().includes(lowerKeyword) ||
          code.codeName.toLowerCase().includes(lowerKeyword) ||
          (code.codeValue && code.codeValue.toLowerCase().includes(lowerKeyword)) ||
          (code.description && code.description.toLowerCase().includes(lowerKeyword))
      );
    }

    // Filter by tenantScope
    if (tenantScope !== 'ALL') {
      filtered = filtered.filter((code) => code.tenantScope === tenantScope);
    }

    // Filter by enabled
    if (enabled !== undefined) {
      filtered = filtered.filter((code) => code.enabled === enabled);
    }

    return filtered;
  }, [codes, keyword, tenantScope, enabled]);

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
    filteredCodes,
    isLoading,
    error,
    refetch,
    resetFilters,
  };
};
