// ----------------------------------------------------------------------

import { useState, useCallback } from 'react';


// ----------------------------------------------------------------------

/**
 * Hook for managing role permissions state (dirty tracking, filters, etc.)
 */
export const useRolePermissionsState = () => {
  const [dirty, setDirty] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const handleSearchChange = useCallback((keyword: string) => {
    setSearchKeyword(keyword);
  }, []);

  const handleResourceTypeFilterChange = useCallback((type: string) => {
    setResourceTypeFilter(type);
  }, []);

  const handleOnlyChangedToggle = useCallback((value: boolean) => {
    setOnlyChanged(value);
  }, []);

  const handleToggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const markDirty = useCallback(() => {
    setDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setDirty(false);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchKeyword('');
    setResourceTypeFilter('');
    setOnlyChanged(false);
  }, []);

  return {
    dirty,
    searchKeyword,
    resourceTypeFilter,
    onlyChanged,
    expandedNodes,
    handleSearchChange,
    handleResourceTypeFilterChange,
    handleOnlyChangedToggle,
    handleToggleNode,
    markDirty,
    markClean,
    resetFilters,
  };
};
