// ----------------------------------------------------------------------

import type { ResourceNode, RolePermissionResponse } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

type PermissionValue = 'ALLOW' | 'DENY' | null;

/**
 * Convert RolePermissionResponse to Map<resourceKey, Map<permissionCode, PermissionValue>>
 * Used for quick lookup in permission matrix with ALLOW/DENY/null support
 */
export const toPermissionMap = (
  permissions: RolePermissionResponse['permissions'] | undefined
): Map<string, Map<string, PermissionValue>> => {
  const map = new Map<string, Map<string, PermissionValue>>();
  if (!permissions || !Array.isArray(permissions)) {
    return map;
  }
  permissions.forEach((perm) => {
    if (perm?.resourceKey && perm?.permissionCodes) {
      const codeMap = new Map<string, PermissionValue>();
      perm.permissionCodes.forEach((code) => {
        // Default to ALLOW if effect is not specified
        codeMap.set(code, perm.effect || 'ALLOW');
      });
      map.set(perm.resourceKey, codeMap);
    }
  });
  return map;
};

/**
 * Convert permission map to RolePermissionAssignmentPayload format
 * Supports ALLOW/DENY/null (null means removal)
 */
export const toPermissionAssignmentPayload = (
  permissionMap: Map<string, Map<string, PermissionValue>>
): Array<{ resourceKey: string; permissionCode: string; effect: 'ALLOW' | 'DENY' | null }> => {
  const payload: Array<{ resourceKey: string; permissionCode: string; effect: 'ALLOW' | 'DENY' | null }> = [];
  permissionMap.forEach((codeMap, resourceKey) => {
    codeMap.forEach((effect, permissionCode) => {
      payload.push({
        resourceKey,
        permissionCode,
        effect,
      });
    });
  });
  return payload;
};

/**
 * Flatten resource tree to flat list (for matrix display)
 */
export const flattenResourceTree = (nodes: ResourceNode[]): ResourceNode[] => {
  const result: ResourceNode[] = [];

  const flatten = (nodeList: ResourceNode[]) => {
    nodeList.forEach((node) => {
      result.push(node);
      if (node.children) {
        flatten(node.children);
      }
    });
  };

  flatten(nodes);
  return result;
};

/**
 * Filter resource tree by keyword (preserves tree structure)
 */
export const filterResourceTreeByKeyword = (tree: ResourceNode[], keyword: string): ResourceNode[] => {
  if (!keyword) return tree;

  const filterNode = (node: ResourceNode): ResourceNode | null => {
    const matchesKeyword =
      (node.resourceName || '').toLowerCase().includes(keyword.toLowerCase()) ||
      node.resourceKey.toLowerCase().includes(keyword.toLowerCase());

    const filteredChildren = node.children
      ? node.children.map(filterNode).filter((n): n is ResourceNode => n !== null)
      : [];

    if (matchesKeyword) {
      return { ...node, children: filteredChildren.length > 0 ? filteredChildren : undefined };
    }

    if (filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }

    return null;
  };

  return tree.map(filterNode).filter((n): n is ResourceNode => n !== null);
};
