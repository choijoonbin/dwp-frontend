// ----------------------------------------------------------------------

import type { ResourceNode, PermissionMatrixState, RolePermissionResponse, RolePermissionAssignmentPayload } from './types';

/**
 * Convert role permissions response to matrix state
 * Backend GET response format: { permissions: [{ resourceKey, permissionCodes: string[], effect? }] }
 */
export const createMatrixState = (
  permissions: RolePermissionResponse['permissions'],
  defaultEffect: 'ALLOW' | 'DENY' | 'NONE' = 'NONE'
): PermissionMatrixState => {
  const original = new Map<string, Map<string, 'ALLOW' | 'DENY' | 'NONE'>>();
  const current = new Map<string, Map<string, 'ALLOW' | 'DENY' | 'NONE'>>();

  permissions.forEach((perm) => {
    const resourceMap = new Map<string, 'ALLOW' | 'DENY' | 'NONE'>();
    perm.permissionCodes.forEach((code) => {
      const effect = perm.effect || 'ALLOW';
      resourceMap.set(code, effect);
    });
    original.set(perm.resourceKey, resourceMap);
    current.set(perm.resourceKey, new Map(resourceMap)); // Deep copy
  });

  return { original, current };
};

/**
 * Check if matrix state has changes (dirty)
 */
export const isMatrixDirty = (state: PermissionMatrixState): boolean => {
  // Check if any resource was added or removed
  const originalKeys = new Set(state.original.keys());
  const currentKeys = new Set(state.current.keys());
  if (originalKeys.size !== currentKeys.size) return true;

  // Check if any permission was changed
  for (const resourceKey of currentKeys) {
    const originalPerms = state.original.get(resourceKey) || new Map();
    const currentPerms = state.current.get(resourceKey) || new Map();

    // Check if any permission code was added or removed
    const originalCodes = new Set(originalPerms.keys());
    const currentCodes = new Set(currentPerms.keys());
    if (originalCodes.size !== currentCodes.size) return true;

    // Check if any permission effect was changed
    for (const code of currentCodes) {
      const originalEffect = originalPerms.get(code) || 'NONE';
      const currentEffect = currentPerms.get(code) || 'NONE';
      if (originalEffect !== currentEffect) return true;
    }
  }

  return false;
};

/**
 * Change item for preview
 */
export type PermissionChangeItem = {
  resourceKey: string;
  permissionCode: string;
  from: 'ALLOW' | 'DENY' | 'NONE';
  to: 'ALLOW' | 'DENY' | 'NONE';
};

/**
 * Get detailed change list for preview
 */
export const getChangePreview = (
  state: PermissionMatrixState,
  allPermissionCodes: string[]
): PermissionChangeItem[] => {
  const changes: PermissionChangeItem[] = [];
  const allResourceKeys = new Set([...state.original.keys(), ...state.current.keys()]);

  for (const resourceKey of allResourceKeys) {
    const originalPerms = state.original.get(resourceKey) || new Map();
    const currentPerms = state.current.get(resourceKey) || new Map();

    for (const code of allPermissionCodes) {
      const originalEffect = originalPerms.get(code) || 'NONE';
      const currentEffect = currentPerms.get(code) || 'NONE';

      if (originalEffect !== currentEffect) {
        changes.push({
          resourceKey,
          permissionCode: code,
          from: originalEffect,
          to: currentEffect,
        });
      }
    }
  }

  return changes;
};

/**
 * Generate diff payload (only changed permissions)
 * Backend format: { items: [{ resourceKey, permissionCode, effect: "ALLOW"|"DENY"|null }] }
 * effect=null for NONE (deletion)
 */
export const generateDiffPayload = (
  state: PermissionMatrixState,
  allPermissionCodes: string[]
): RolePermissionAssignmentPayload => {
  const items: RolePermissionAssignmentPayload['items'] = [];

  // Get all resource keys (union of original and current)
  const allResourceKeys = new Set([...state.original.keys(), ...state.current.keys()]);

  for (const resourceKey of allResourceKeys) {
    const originalPerms = state.original.get(resourceKey) || new Map();
    const currentPerms = state.current.get(resourceKey) || new Map();

    // Check all permission codes
    for (const permissionCode of allPermissionCodes) {
      const originalEffect = originalPerms.get(permissionCode) || 'NONE';
      const currentEffect = currentPerms.get(permissionCode) || 'NONE';

      if (originalEffect !== currentEffect) {
        // NONE이면 null로 설정 (삭제 의미)
        const effect: 'ALLOW' | 'DENY' | null = currentEffect === 'NONE' ? null : (currentEffect as 'ALLOW' | 'DENY');
        items.push({
          resourceKey,
          permissionCode,
          effect,
        });
      }
    }
  }

  return { items };
};

/**
 * Apply permission to a row (all permission codes for a resource)
 */
export const applyRowPermissions = (
  state: PermissionMatrixState,
  resourceKey: string,
  permissionCodes: string[],
  effect: 'ALLOW' | 'DENY'
): PermissionMatrixState => {
  const newCurrent = new Map(state.current);
  const resourceMap = new Map<string, 'ALLOW' | 'DENY' | 'NONE'>();
  
  permissionCodes.forEach((code) => {
    resourceMap.set(code, effect);
  });
  
  newCurrent.set(resourceKey, resourceMap);
  
  return {
    original: state.original,
    current: newCurrent,
  };
};

/**
 * Apply permission to a column (all resources for a permission code)
 */
export const applyColumnPermissions = (
  state: PermissionMatrixState,
  permissionCode: string,
  resourceKeys: string[],
  effect: 'ALLOW' | 'DENY'
): PermissionMatrixState => {
  const newCurrent = new Map(state.current);
  
  resourceKeys.forEach((resourceKey) => {
    const resourceMap = newCurrent.get(resourceKey) || new Map();
    resourceMap.set(permissionCode, effect);
    newCurrent.set(resourceKey, resourceMap);
  });
  
  return {
    original: state.original,
    current: newCurrent,
  };
};

/**
 * Apply permission to all resources and codes
 */
export const applyAllPermissions = (
  state: PermissionMatrixState,
  resourceKeys: string[],
  permissionCodes: string[],
  effect: 'ALLOW' | 'DENY'
): PermissionMatrixState => {
  const newCurrent = new Map(state.current);
  
  resourceKeys.forEach((resourceKey) => {
    const resourceMap = new Map<string, 'ALLOW' | 'DENY' | 'NONE'>();
    permissionCodes.forEach((code) => {
      resourceMap.set(code, effect);
    });
    newCurrent.set(resourceKey, resourceMap);
  });
  
  return {
    original: state.original,
    current: newCurrent,
  };
};

/**
 * Apply permission to a resource and all its children (recursive)
 */
export const applyToResourceAndChildren = (
  state: PermissionMatrixState,
  resourceKey: string,
  permissionCodes: string[],
  effect: 'ALLOW' | 'DENY',
  resourceTree: ResourceNode[]
): PermissionMatrixState => {
  const newCurrent = new Map(state.current);
  
  // Find all child resource keys recursively
  const getAllChildren = (
    parentKey: string,
    tree: ResourceNode[],
    result: string[] = []
  ): string[] => {
    for (const node of tree) {
      if (node.resourceKey === parentKey && node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          result.push(child.resourceKey);
          if (child.children && child.children.length > 0) {
            getAllChildren(child.resourceKey, child.children, result);
          }
        });
      } else if (node.children && node.children.length > 0) {
        getAllChildren(parentKey, node.children, result);
      }
    }
    return result;
  };
  
  const childKeys = getAllChildren(resourceKey, resourceTree);
  const allKeys = [resourceKey, ...childKeys];
  
  // Apply to parent and all children
  allKeys.forEach((key) => {
    const resourceMap = newCurrent.get(key) || new Map<string, 'ALLOW' | 'DENY' | 'NONE'>();
    permissionCodes.forEach((code) => {
      resourceMap.set(code, effect);
    });
    newCurrent.set(key, resourceMap);
  });
  
  return {
    original: state.original,
    current: newCurrent,
  };
};

/**
 * Reset matrix state to original
 */
export const resetMatrixState = (state: PermissionMatrixState): PermissionMatrixState => {
  const newCurrent = new Map<string, Map<string, 'ALLOW' | 'DENY' | 'NONE'>>();
  
  state.original.forEach((resourceMap, resourceKey) => {
    newCurrent.set(resourceKey, new Map(resourceMap)); // Deep copy
  });
  
  return {
    original: state.original,
    current: newCurrent,
  };
};

/**
 * Cycle permission effect state: NONE → ALLOW → DENY → NONE
 * Pure function for state cycling
 */
export const cycleState = (current: 'ALLOW' | 'DENY' | 'NONE'): 'ALLOW' | 'DENY' | 'NONE' => {
  if (current === 'NONE') return 'ALLOW';
  if (current === 'ALLOW') return 'DENY';
  return 'NONE';
};

/**
 * Toggle permission effect (ALLOW -> DENY -> NONE -> ALLOW)
 */
export const togglePermissionEffect = (
  state: PermissionMatrixState,
  resourceKey: string,
  permissionCode: string
): PermissionMatrixState => {
  const newCurrent = new Map(state.current);
  const resourceMap = newCurrent.get(resourceKey) || new Map();
  const currentEffect = resourceMap.get(permissionCode) || 'NONE';
  const nextEffect = cycleState(currentEffect);
  
  resourceMap.set(permissionCode, nextEffect);
  newCurrent.set(resourceKey, resourceMap);
  
  return {
    original: state.original,
    current: newCurrent,
  };
};

/**
 * Set permission effect directly
 */
export const setPermissionEffect = (
  state: PermissionMatrixState,
  resourceKey: string,
  permissionCode: string,
  effect: 'ALLOW' | 'DENY' | 'NONE'
): PermissionMatrixState => {
  const newCurrent = new Map(state.current);
  const resourceMap = newCurrent.get(resourceKey) || new Map();
  
  if (effect === 'NONE') {
    resourceMap.delete(permissionCode);
  } else {
    resourceMap.set(permissionCode, effect);
  }
  
  if (resourceMap.size === 0) {
    newCurrent.delete(resourceKey);
  } else {
    newCurrent.set(resourceKey, resourceMap);
  }
  
  return {
    original: state.original,
    current: newCurrent,
  };
};

/**
 * Get changed resources (for "onlyChanged" filter)
 */
export const getChangedResources = (state: PermissionMatrixState): Set<string> => {
  const changed = new Set<string>();
  const allResourceKeys = new Set([...state.original.keys(), ...state.current.keys()]);
  
  for (const resourceKey of allResourceKeys) {
    const originalPerms = state.original.get(resourceKey) || new Map();
    const currentPerms = state.current.get(resourceKey) || new Map();
    
    // Check if any permission changed
    const allCodes = new Set([...originalPerms.keys(), ...currentPerms.keys()]);
    for (const code of allCodes) {
      const originalEffect = originalPerms.get(code) || 'NONE';
      const currentEffect = currentPerms.get(code) || 'NONE';
      if (originalEffect !== currentEffect) {
        changed.add(resourceKey);
        break;
      }
    }
  }
  
  return changed;
};
