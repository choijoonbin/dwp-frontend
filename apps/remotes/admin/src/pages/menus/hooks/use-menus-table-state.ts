// ----------------------------------------------------------------------


import { useState, useCallback } from 'react';
import { useAdminMenusTreeQuery } from '@dwp-frontend/shared-utils';


// ----------------------------------------------------------------------

/**
 * TableState Hook: 메뉴 트리 조회 및 상태 관리
 */
export const useMenusTableState = () => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const { data: menusTree, isLoading, error, refetch } = useAdminMenusTreeQuery();

  // Toggle node expansion
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
    menusTree: menusTree || [],
    expandedNodes,
    isLoading,
    error,
    refetch,
    toggleNode,
  };
};
