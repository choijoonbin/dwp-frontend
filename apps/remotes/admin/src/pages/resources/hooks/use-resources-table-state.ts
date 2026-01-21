// ----------------------------------------------------------------------

import { useMemo, useState, useCallback } from 'react';
import { useAdminResourcesTreeQuery } from '@dwp-frontend/shared-utils';

import { filterResourceTree, toResourceRowModels } from '../adapters/resource-adapter';


// ----------------------------------------------------------------------

/**
 * TableState Hook: 조회/필터 상태 관리
 */
export const useResourcesTableState = () => {
  const [keyword, setKeyword] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const { data: resourcesTree, isLoading, error, refetch } = useAdminResourcesTreeQuery();

  // Filter tree
  const filteredTree = useMemo(() => {
    if (!resourcesTree) return [];
    return filterResourceTree(resourcesTree, keyword, resourceTypeFilter);
  }, [resourcesTree, keyword, resourceTypeFilter]);

  // Convert to UI Models
  const resourceRowModels = useMemo(() => {
    if (!filteredTree) return [];
    return toResourceRowModels(filteredTree);
  }, [filteredTree]);

  // Stable callback for keyword change
  const handleKeywordChange = useCallback((newKeyword: string) => {
    setKeyword(newKeyword);
  }, []);

  // Stable callback for resource type filter change
  const handleResourceTypeFilterChange = useCallback((newType: string) => {
    setResourceTypeFilter(newType);
  }, []);

  // Stable callback for toggle node expansion
  const toggleNode = useCallback((nodeId: string) => {
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

  return {
    // State
    keyword,
    resourceTypeFilter,
    expandedNodes,
    // Handlers
    setKeyword: handleKeywordChange,
    setResourceTypeFilter: handleResourceTypeFilterChange,
    toggleNode,
    // Data
    resourceRowModels,
    resourcesTree,
    filteredTree,
    // Query state
    isLoading,
    error,
    refetch,
  };
};
