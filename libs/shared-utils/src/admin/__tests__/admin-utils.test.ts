import { describe, it, expect } from 'vitest';

import type { ResourceNode, RolePermissionResponse } from '../types';

// ----------------------------------------------------------------------

/**
 * Build resource tree from flat list
 * Sorts by sortOrder, then by resourceName
 */
const buildResourceTree = (resources: ResourceNode[]): ResourceNode[] => {
  const resourceMap = new Map<string, ResourceNode>();
  const rootNodes: ResourceNode[] = [];

  // Create map
  resources.forEach((resource) => {
    resourceMap.set(resource.id, { ...resource, children: [] });
  });

  // Build tree
  resources.forEach((resource) => {
    const node = resourceMap.get(resource.id)!;
    if (resource.parentId && resourceMap.has(resource.parentId)) {
      const parent = resourceMap.get(resource.parentId)!;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  // Sort function
  const sortNodes = (nodes: ResourceNode[]): ResourceNode[] => nodes
      .sort((a, b) => {
        // Sort by sortOrder first
        const aOrder = a.sortOrder ?? 999999;
        const bOrder = b.sortOrder ?? 999999;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        // Then by resourceName
        return a.resourceName.localeCompare(b.resourceName);
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }));

  return sortNodes(rootNodes);
};

/**
 * Merge role permissions with resources
 * Creates a view that shows which permissions are granted for each resource
 */
const mergeRolePermissions = (
  resources: ResourceNode[],
  rolePermissions: RolePermissionResponse
): Array<{ resourceKey: string; resourceName: string; permissions: Record<string, boolean> }> => {
  const permissionMap = new Map<string, Set<string>>();
  rolePermissions.permissions.forEach((perm: { resourceKey: string; permissionCodes: string[] }) => {
    permissionMap.set(perm.resourceKey, new Set(perm.permissionCodes));
  });

  const flattenResources = (nodes: ResourceNode[]): ResourceNode[] => {
    const result: ResourceNode[] = [];
    nodes.forEach((node) => {
      result.push(node);
      if (node.children) {
        result.push(...flattenResources(node.children));
      }
    });
    return result;
  };

  const allResources = flattenResources(resources);

  return allResources.map((resource) => {
    const grantedCodes = permissionMap.get(resource.resourceKey) || new Set<string>();
    const permissions: Record<string, boolean> = {};
    ['VIEW', 'USE', 'EDIT', 'DELETE', 'APPROVE', 'EXECUTE'].forEach((code) => {
      permissions[code] = grantedCodes.has(code);
    });

    return {
      resourceKey: resource.resourceKey,
      resourceName: resource.resourceName,
      permissions,
    };
  });
};

// ----------------------------------------------------------------------

describe('Admin Utils', () => {
  describe('buildResourceTree', () => {
    it('should build tree structure from flat list', () => {
      const resources: ResourceNode[] = [
        {
          id: '1',
          resourceName: 'Parent',
          resourceKey: 'menu.parent',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          parentId: null,
          sortOrder: 1,
        },
        {
          id: '2',
          resourceName: 'Child',
          resourceKey: 'menu.parent.child',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          parentId: '1',
          sortOrder: 1,
        },
        {
          id: '3',
          resourceName: 'Root',
          resourceKey: 'menu.root',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          parentId: null,
          sortOrder: 0,
        },
      ];

      const tree = buildResourceTree(resources);

      expect(tree).toHaveLength(2);
      expect(tree[0].resourceKey).toBe('menu.root'); // sortOrder 0 comes first
      expect(tree[1].resourceKey).toBe('menu.parent');
      expect(tree[1].children).toHaveLength(1);
      expect(tree[1].children![0].resourceKey).toBe('menu.parent.child');
    });

    it('should sort by sortOrder first, then by resourceName', () => {
      const resources: ResourceNode[] = [
        {
          id: '1',
          resourceName: 'B Resource',
          resourceKey: 'menu.b',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          parentId: null,
          sortOrder: 2,
        },
        {
          id: '2',
          resourceName: 'A Resource',
          resourceKey: 'menu.a',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          parentId: null,
          sortOrder: 2,
        },
        {
          id: '3',
          resourceName: 'First Resource',
          resourceKey: 'menu.first',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          parentId: null,
          sortOrder: 1,
        },
      ];

      const tree = buildResourceTree(resources);

      expect(tree[0].resourceKey).toBe('menu.first'); // sortOrder 1
      expect(tree[1].resourceKey).toBe('menu.a'); // sortOrder 2, alphabetical
      expect(tree[2].resourceKey).toBe('menu.b');
    });

    it('should handle null parentId as root', () => {
      const resources: ResourceNode[] = [
        {
          id: '1',
          resourceName: 'Root',
          resourceKey: 'menu.root',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          parentId: null,
          sortOrder: 1,
        },
      ];

      const tree = buildResourceTree(resources);

      expect(tree).toHaveLength(1);
      expect(tree[0].resourceKey).toBe('menu.root');
    });
  });

  describe('mergeRolePermissions', () => {
    it('should merge role permissions with resources', () => {
      const resources: ResourceNode[] = [
        {
          id: '1',
          resourceName: 'Menu 1',
          resourceKey: 'menu.one',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          sortOrder: 1,
        },
        {
          id: '2',
          resourceName: 'Menu 2',
          resourceKey: 'menu.two',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          sortOrder: 2,
        },
      ];

      const rolePermissions: RolePermissionResponse = {
        permissions: [
          {
            resourceKey: 'menu.one',
            permissionCodes: ['VIEW', 'USE'],
          },
          {
            resourceKey: 'menu.two',
            permissionCodes: ['VIEW', 'EDIT', 'DELETE'],
          },
        ],
      };

      const merged = mergeRolePermissions(resources, rolePermissions);

      expect(merged).toHaveLength(2);
      expect(merged[0].resourceKey).toBe('menu.one');
      expect(merged[0].permissions.VIEW).toBe(true);
      expect(merged[0].permissions.USE).toBe(true);
      expect(merged[0].permissions.EDIT).toBe(false);
      expect(merged[1].resourceKey).toBe('menu.two');
      expect(merged[1].permissions.VIEW).toBe(true);
      expect(merged[1].permissions.EDIT).toBe(true);
      expect(merged[1].permissions.DELETE).toBe(true);
    });

    it('should handle resources without permissions', () => {
      const resources: ResourceNode[] = [
        {
          id: '1',
          resourceName: 'Menu 1',
          resourceKey: 'menu.one',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          sortOrder: 1,
        },
      ];

      const rolePermissions: RolePermissionResponse = {
        permissions: [],
      };

      const merged = mergeRolePermissions(resources, rolePermissions);

      expect(merged).toHaveLength(1);
      expect(merged[0].permissions.VIEW).toBe(false);
      expect(merged[0].permissions.USE).toBe(false);
    });

    it('should handle nested resources', () => {
      const resources: ResourceNode[] = [
        {
          id: '1',
          resourceName: 'Parent',
          resourceKey: 'menu.parent',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01T00:00:00Z',
          parentId: null,
          sortOrder: 1,
          children: [
            {
              id: '2',
              resourceName: 'Child',
              resourceKey: 'menu.parent.child',
              resourceType: 'MENU',
              enabled: true,
              createdAt: '2024-01-01T00:00:00Z',
              parentId: '1',
              sortOrder: 1,
            },
          ],
        },
      ];

      const rolePermissions: RolePermissionResponse = {
        permissions: [
          {
            resourceKey: 'menu.parent',
            permissionCodes: ['VIEW'],
          },
          {
            resourceKey: 'menu.parent.child',
            permissionCodes: ['VIEW', 'USE'],
          },
        ],
      };

      const merged = mergeRolePermissions(resources, rolePermissions);

      expect(merged).toHaveLength(2);
      expect(merged[0].resourceKey).toBe('menu.parent');
      expect(merged[1].resourceKey).toBe('menu.parent.child');
      expect(merged[1].permissions.VIEW).toBe(true);
      expect(merged[1].permissions.USE).toBe(true);
    });
  });
});
