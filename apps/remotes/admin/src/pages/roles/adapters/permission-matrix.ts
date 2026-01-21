// ----------------------------------------------------------------------

import type { ResourceNode , PermissionMatrixState, RolePermissionResponse } from '@dwp-frontend/shared-utils';


// ----------------------------------------------------------------------

/**
 * Permission Matrix Model (UI Model for matrix display)
 */
export type PermissionMatrixModel = {
  resourceKey: string;
  resourceName: string;
  resourceType: string;
  permissions: Record<string, 'ALLOW' | 'DENY' | 'NONE'>; // permissionCode -> effect
  isChanged: boolean;
};

/**
 * Convert RolePermissionResponse to PermissionMatrixModel[]
 * Includes sorting by resourceKey (fallback to sortOrder if available)
 */
export const toPermissionMatrixModels = (
  permissions: RolePermissionResponse['permissions'],
  resourcesTree: ResourceNode[] | null | undefined,
  matrixState: PermissionMatrixState
): PermissionMatrixModel[] => {
  if (!resourcesTree || resourcesTree.length === 0) return [];

  // Flatten tree to get all resources
  const allResources: ResourceNode[] = [];
  const flatten = (nodes: ResourceNode[]) => {
    nodes.forEach((node) => {
      allResources.push(node);
      if (node.children) {
        flatten(node.children);
      }
    });
  };
  flatten(resourcesTree);

  // Create a map of resourceKey -> ResourceNode for quick lookup
  const resourceMap = new Map<string, ResourceNode>();
  allResources.forEach((resource) => {
    resourceMap.set(resource.resourceKey, resource);
  });

  // Get changed resources set
  const changedResources = new Set<string>();
  matrixState.original.forEach((originalPerms, resourceKey) => {
    const currentPerms = matrixState.current.get(resourceKey) || new Map();
    const allCodes = new Set([...originalPerms.keys(), ...currentPerms.keys()]);
    for (const code of allCodes) {
      const originalEffect = originalPerms.get(code) || 'NONE';
      const currentEffect = currentPerms.get(code) || 'NONE';
      if (originalEffect !== currentEffect) {
        changedResources.add(resourceKey);
        break;
      }
    }
  });

  // Convert to models
  const models: PermissionMatrixModel[] = allResources.map((resource) => {
    const currentPerms = matrixState.current.get(resource.resourceKey) || new Map();
    const permissionMap: Record<string, 'ALLOW' | 'DENY' | 'NONE'> = {};
    
    // Initialize all permission codes as NONE
    // (permission codes should be passed separately, but for now we'll use currentPerms keys)
    currentPerms.forEach((effect, code) => {
      permissionMap[code] = effect;
    });

    return {
      resourceKey: resource.resourceKey,
      resourceName: resource.resourceName || resource.resourceKey,
      resourceType: resource.resourceType,
      permissions: permissionMap,
      isChanged: changedResources.has(resource.resourceKey),
    };
  });

  // Sort by resourceKey (or sortOrder if available)
  return models.sort((a, b) => {
    const resourceA = resourceMap.get(a.resourceKey);
    const resourceB = resourceMap.get(b.resourceKey);
    const sortOrderA = resourceA?.sortOrder ?? 0;
    const sortOrderB = resourceB?.sortOrder ?? 0;
    if (sortOrderA !== sortOrderB) {
      return sortOrderA - sortOrderB;
    }
    return a.resourceKey.localeCompare(b.resourceKey, 'ko');
  });
};

// ----------------------------------------------------------------------

/**
 * Filter resource tree by keyword (recursive)
 * Preserves tree structure - includes parent if child matches
 */
export const filterResourceTree = (tree: ResourceNode[], keyword: string): ResourceNode[] => {
  if (!keyword) return tree;

  const filterNode = (node: ResourceNode): ResourceNode | null => {
    const matchesKeyword =
      node.resourceName.toLowerCase().includes(keyword.toLowerCase()) ||
      node.resourceKey.toLowerCase().includes(keyword.toLowerCase());

    const filteredChildren = node.children ? node.children.map(filterNode).filter((n): n is ResourceNode => n !== null) : [];

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

/**
 * Filter tree nodes recursively based on search keyword, resource type, and changed status
 * Used in RolePermissionsDialog for tree view filtering
 */
export const filterTreeNodes = (
  nodes: ResourceNode[],
  searchKeyword: string,
  resourceTypeFilter: string,
  onlyChanged: boolean,
  changedResources: Set<string>
): ResourceNode[] => {
  const filterNode = (node: ResourceNode): ResourceNode | null => {
    // Check if node matches filters
    const matchesSearch = !searchKeyword ||
      node.resourceName?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      node.resourceKey.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchesType = !resourceTypeFilter || node.resourceType === resourceTypeFilter;
    const matchesChanged = !onlyChanged || changedResources.has(node.resourceKey);

    const nodeMatches = matchesSearch && matchesType && matchesChanged;

    // Filter children recursively
    const filteredChildren = node.children
      ? node.children.map(filterNode).filter((child): child is ResourceNode => child !== null)
      : [];

    // Include node if it matches or has matching children
    if (nodeMatches || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : node.children,
      };
    }

    return null;
  };

  return nodes.map(filterNode).filter((node): node is ResourceNode => node !== null);
};

/**
 * Flatten resource tree for matrix table display
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
