// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

/**
 * Flatten menu tree for parent selection
 */
export const flattenMenuTree = (nodes: AdminMenuNode[], excludeId?: string): AdminMenuNode[] => {
  const result: AdminMenuNode[] = [];

  const flatten = (nodeList: AdminMenuNode[]) => {
    nodeList.forEach((node) => {
      if (!excludeId || node.id !== excludeId) {
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        flatten(node.children);
      }
    });
  };

  flatten(nodes);
  return result;
};

/**
 * Find menu node by ID in tree
 */
export const findMenuNodeById = (nodes: AdminMenuNode[], menuId: string): AdminMenuNode | null => {
  for (const node of nodes) {
    if (node.id === menuId) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findMenuNodeById(node.children, menuId);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Get siblings of a menu node (for reordering)
 */
export const getMenuSiblings = (nodes: AdminMenuNode[], menuId: string): AdminMenuNode[] => {
  const findParent = (nodeList: AdminMenuNode[], targetId: string): AdminMenuNode[] | null => {
    for (const node of nodeList) {
      if (node.children && node.children.some((child) => child.id === targetId)) {
        return node.children;
      }
      if (node.children && node.children.length > 0) {
        const found = findParent(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const siblings = findParent(nodes, menuId);
  return siblings || nodes;
};
