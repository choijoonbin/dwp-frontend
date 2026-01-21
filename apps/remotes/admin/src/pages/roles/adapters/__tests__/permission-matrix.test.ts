// ----------------------------------------------------------------------

import type { ResourceNode } from '@dwp-frontend/shared-utils';

import { it, expect, describe } from 'vitest';

import { filterTreeNodes, filterResourceTree, flattenResourceTree } from '../permission-matrix';

// ----------------------------------------------------------------------

describe('permission-matrix adapter', () => {
  const mockTree: ResourceNode[] = [
    {
      id: '1',
      resourceName: 'Users',
      resourceKey: 'menu.admin.users',
      resourceType: 'MENU',
      enabled: true,
      createdAt: '2024-01-01',
      children: [
        {
          id: '2',
          resourceName: 'User List',
          resourceKey: 'menu.admin.users.list',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01',
        },
      ],
    },
    {
      id: '3',
      resourceName: 'Roles',
      resourceKey: 'menu.admin.roles',
      resourceType: 'MENU',
      enabled: true,
      createdAt: '2024-01-01',
    },
  ];

  describe('filterResourceTree', () => {
    it('should return all nodes when keyword is empty', () => {
      const result = filterResourceTree(mockTree, '');
      expect(result).toEqual(mockTree);
    });

    it('should filter by resourceName', () => {
      const result = filterResourceTree(mockTree, 'Users');
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
    });

    it('should filter by resourceKey', () => {
      const result = filterResourceTree(mockTree, 'admin.users');
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
    });

    it('should include parent if child matches', () => {
      const result = filterResourceTree(mockTree, 'User List');
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
      expect(result[0]?.children).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      const result = filterResourceTree(mockTree, 'users');
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
    });
  });

  describe('filterTreeNodes', () => {
    it('should filter by search keyword', () => {
      const changedResources = new Set<string>();
      const result = filterTreeNodes(mockTree, 'Users', '', false, changedResources);
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
    });

    it('should filter by resource type', () => {
      const changedResources = new Set<string>();
      const result = filterTreeNodes(mockTree, '', 'MENU', false, changedResources);
      expect(result).toHaveLength(2);
    });

    it('should filter by changed status', () => {
      const changedResources = new Set<string>(['menu.admin.users']);
      const result = filterTreeNodes(mockTree, '', '', true, changedResources);
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
    });

    it('should combine multiple filters', () => {
      const changedResources = new Set<string>(['menu.admin.users']);
      const result = filterTreeNodes(mockTree, 'Users', 'MENU', true, changedResources);
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
    });
  });

  describe('flattenResourceTree', () => {
    it('should flatten tree structure', () => {
      const result = flattenResourceTree(mockTree);
      expect(result).toHaveLength(3); // 2 parents + 1 child
      expect(result.map((r) => r.resourceKey)).toEqual([
        'menu.admin.users',
        'menu.admin.users.list',
        'menu.admin.roles',
      ]);
    });

    it('should handle empty tree', () => {
      const result = flattenResourceTree([]);
      expect(result).toHaveLength(0);
    });

    it('should preserve node order (depth-first)', () => {
      const deepTree: ResourceNode[] = [
        {
          id: '1',
          resourceName: 'A',
          resourceKey: 'a',
          resourceType: 'MENU',
          enabled: true,
          createdAt: '2024-01-01',
          children: [
            {
              id: '2',
              resourceName: 'B',
              resourceKey: 'b',
              resourceType: 'MENU',
              enabled: true,
              createdAt: '2024-01-01',
              children: [
                {
                  id: '3',
                  resourceName: 'C',
                  resourceKey: 'c',
                  resourceType: 'MENU',
                  enabled: true,
                  createdAt: '2024-01-01',
                },
              ],
            },
          ],
        },
      ];
      const result = flattenResourceTree(deepTree);
      expect(result.map((r) => r.resourceKey)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('filterTreeNodes (multi-filter)', () => {
    const complexTree: ResourceNode[] = [
      {
        id: '1',
        resourceName: 'Users Menu',
        resourceKey: 'menu.admin.users',
        resourceType: 'MENU',
        enabled: true,
        createdAt: '2024-01-01',
        children: [
          {
            id: '2',
            resourceName: 'User List',
            resourceKey: 'menu.admin.users.list',
            resourceType: 'MENU',
            enabled: true,
            createdAt: '2024-01-01',
          },
          {
            id: '3',
            resourceName: 'User Create Button',
            resourceKey: 'btn.admin.users.create',
            resourceType: 'BUTTON',
            enabled: true,
            createdAt: '2024-01-01',
          },
        ],
      },
      {
        id: '4',
        resourceName: 'Roles Menu',
        resourceKey: 'menu.admin.roles',
        resourceType: 'MENU',
        enabled: true,
        createdAt: '2024-01-01',
      },
    ];

    it('should filter by resource type', () => {
      const changedResources = new Set<string>();
      const result = filterTreeNodes(complexTree, '', 'BUTTON', false, changedResources);
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.resourceType).toBe('BUTTON');
    });

    it('should filter by changed status', () => {
      const changedResources = new Set<string>(['menu.admin.users.list']);
      const result = filterTreeNodes(complexTree, '', '', true, changedResources);
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
      expect(result[0]?.children).toHaveLength(1);
    });

    it('should combine search keyword and resource type filters', () => {
      const changedResources = new Set<string>();
      const result = filterTreeNodes(complexTree, 'User', 'MENU', false, changedResources);
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children?.[0]?.resourceKey).toBe('menu.admin.users.list');
    });

    it('should include parent if child matches (even if parent does not)', () => {
      const changedResources = new Set<string>(['menu.admin.users.list']);
      const result = filterTreeNodes(complexTree, '', '', true, changedResources);
      // Parent should be included because child matches
      expect(result).toHaveLength(1);
      expect(result[0]?.resourceKey).toBe('menu.admin.users');
    });
  });
});
