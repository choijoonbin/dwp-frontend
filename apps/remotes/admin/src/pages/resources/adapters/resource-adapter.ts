// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import type { ResourceRowModel } from '../types';

// ----------------------------------------------------------------------

/**
 * Convert ResourceNode API response to ResourceRowModel (UI Model)
 */
export const toResourceRowModel = (node: ResourceNode): ResourceRowModel => ({
    id: node.id,
    resourceName: node.resourceName || '',
    resourceKey: node.resourceKey || '',
    resourceType: node.resourceType || 'RESOURCE',
    path: node.path || null,
    parentId: node.parentId || null,
    sortOrder: node.sortOrder || null,
    enabled: node.enabled ?? true,
    trackingEnabled: node.trackingEnabled ?? false,
    eventActions: node.eventActions || [],
    children: node.children ? node.children.map(toResourceRowModel) : undefined,
  });

/**
 * Convert ResourceNode[] to ResourceRowModel[]
 */
export const toResourceRowModels = (nodes: ResourceNode[]): ResourceRowModel[] => nodes.map(toResourceRowModel);

/**
 * Filter resource tree by keyword and resourceType
 */
export const filterResourceTree = (
  tree: ResourceNode[],
  keyword: string,
  resourceType: string
): ResourceNode[] => {
  if (!keyword && !resourceType) return tree;

  const filterNode = (node: ResourceNode): ResourceNode | null => {
    const matchesKeyword =
      !keyword ||
      node.resourceName.toLowerCase().includes(keyword.toLowerCase()) ||
      node.resourceKey.toLowerCase().includes(keyword.toLowerCase());
    const matchesType = !resourceType || node.resourceType === resourceType;

    const filteredChildren = node.children
      ? node.children.map(filterNode).filter((n): n is ResourceNode => n !== null)
      : [];

    if (matchesKeyword && matchesType) {
      return { ...node, children: filteredChildren.length > 0 ? filteredChildren : undefined };
    }

    if (filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }

    return null;
  };

  return tree.map(filterNode).filter((n): n is ResourceNode => n !== null);
};

/**
 * Flatten tree for parent selection dropdown
 */
export const flattenResourceTree = (
  nodes: ResourceNode[],
  excludeId?: string,
  result: ResourceNode[] = []
): ResourceNode[] => {
  nodes.forEach((node) => {
    if (!excludeId || node.id !== excludeId) {
      result.push(node);
    }
    if (node.children) {
      flattenResourceTree(node.children, excludeId, result);
    }
  });
  return result;
};
