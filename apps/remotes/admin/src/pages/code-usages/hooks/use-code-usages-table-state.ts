// ----------------------------------------------------------------------

import type { CodeUsageSummary } from '@dwp-frontend/shared-utils';

import { useMemo, useState } from 'react';
import { useCodeUsagesQuery, useAdminResourcesTreeQuery } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * CodeUsages TableState Hook: 조회/필터 상태 관리
 */
export const useCodeUsagesTableState = () => {
  const [keyword, setKeyword] = useState('');
  const [selectedResourceKey, setSelectedResourceKey] = useState<string>('');

  const { data: resourcesTree } = useAdminResourcesTreeQuery();

  // Get all code usages (no filter for resourceKey to show all)
  const { data: allUsages, isLoading, error, refetch } = useCodeUsagesQuery({
    keyword: keyword || undefined,
  });

  // Extract resource options (key, name, type) from resources tree
  const resourceOptions = useMemo(() => {
    if (!resourcesTree) return [];
    const seen = new Set<string>();
    const items: Array<{ resourceKey: string; resourceName: string; resourceType: 'MENU' | 'UI' }> = [];
    const extract = (nodes: typeof resourcesTree) => {
      nodes.forEach((node) => {
        if (node.resourceKey && !seen.has(node.resourceKey)) {
          seen.add(node.resourceKey);
          const displayType: 'MENU' | 'UI' =
            node.resourceType === 'MENU'
              ? 'MENU'
              : node.resourceKey.startsWith('ui.') ||
                  node.resourceType === 'BUTTON' ||
                  node.resourceType === 'API' ||
                  node.resourceType === 'RESOURCE'
                ? 'UI'
                : 'MENU';
          items.push({
            resourceKey: node.resourceKey,
            resourceName: node.resourceName || node.resourceKey,
            resourceType: displayType,
          });
        }
        if (node.children) {
          extract(node.children);
        }
      });
    };
    extract(resourcesTree);
    return items.sort((a, b) => a.resourceKey.localeCompare(b.resourceKey));
  }, [resourcesTree]);

  const resourceKeyOptions = useMemo(() => resourceOptions.map((r) => r.resourceKey), [resourceOptions]);

  // Filter usages by selected resource key
  const filteredUsages = useMemo(() => {
    if (!allUsages?.items) return [];
    if (!selectedResourceKey) return allUsages.items;
    return allUsages.items.filter((usage) => usage.resourceKey === selectedResourceKey);
  }, [allUsages, selectedResourceKey]);

  // Group usages by resourceKey
  const usagesByResource = useMemo(() => {
    if (!allUsages?.items) return new Map<string, CodeUsageSummary[]>();
    const map = new Map<string, CodeUsageSummary[]>();
    allUsages.items.forEach((usage) => {
      const existing = map.get(usage.resourceKey) || [];
      map.set(usage.resourceKey, [...existing, usage]);
    });
    return map;
  }, [allUsages]);

  // Get groups for selected resource key
  const selectedResourceGroups = useMemo(() => {
    if (!selectedResourceKey) return [];
    return filteredUsages.map((usage) => usage.codeGroupKey);
  }, [selectedResourceKey, filteredUsages]);

  return {
    keyword,
    selectedResourceKey,
    setKeyword,
    setSelectedResourceKey,
    resourceKeyOptions,
    resourceOptions,
    filteredUsages,
    usagesByResource,
    selectedResourceGroups,
    isLoading,
    error,
    refetch,
  };
};
