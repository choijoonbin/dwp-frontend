// ----------------------------------------------------------------------

import type { RoleDetail, RoleSummary } from '@dwp-frontend/shared-utils';

import { it, expect, describe } from 'vitest';

import { filterRoles, toRoleRowModel, toRoleRowModels, sortRolesByName, toRoleDetailModel } from '../role-adapter';

// ----------------------------------------------------------------------

describe('role-adapter', () => {
  const mockRoleSummary: RoleSummary = {
    id: '1',
    roleName: 'Admin',
    roleCode: 'ROLE_ADMIN',
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockRoleDetail: RoleDetail = {
    id: '1',
    roleName: 'Admin',
    roleCode: 'ROLE_ADMIN',
    description: 'Administrator role',
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00Z',
  };

  describe('toRoleRowModel', () => {
    it('should convert RoleSummary to RoleRowModel', () => {
      const result = toRoleRowModel(mockRoleSummary);
      expect(result).toEqual({
        id: '1',
        roleName: 'Admin',
        roleCode: 'ROLE_ADMIN',
        status: 'ACTIVE',
        statusLabel: '활성',
        statusColor: 'success',
      });
    });

    it('should handle null/undefined fields with fallback', () => {
      const roleWithNulls: RoleSummary = {
        id: '2',
        roleName: '',
        roleCode: '',
        status: 'INACTIVE' as const,
        createdAt: '2024-01-01T00:00:00Z',
      };
      const result = toRoleRowModel(roleWithNulls);
      expect(result.roleName).toBe('');
      expect(result.roleCode).toBe('');
      expect(result.status).toBe('INACTIVE');
      expect(result.statusLabel).toBe('비활성');
      expect(result.statusColor).toBe('default');
    });

    it('should handle missing status field', () => {
      const roleWithoutStatus = {
        ...mockRoleSummary,
        status: undefined as unknown as 'ACTIVE' | 'INACTIVE',
      };
      const result = toRoleRowModel(roleWithoutStatus);
      expect(result.status).toBe('INACTIVE');
      expect(result.statusLabel).toBe('비활성');
    });
  });

  describe('toRoleDetailModel', () => {
    it('should convert RoleDetail to RoleDetailModel', () => {
      const result = toRoleDetailModel(mockRoleDetail);
      expect(result).toEqual({
        id: '1',
        roleName: 'Admin',
        roleCode: 'ROLE_ADMIN',
        description: 'Administrator role',
        status: 'ACTIVE',
        statusLabel: '활성',
        statusColor: 'success',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: null,
      });
    });

    it('should convert RoleSummary to RoleDetailModel (fallback)', () => {
      const result = toRoleDetailModel(mockRoleSummary);
      expect(result.description).toBeNull();
      expect(result.updatedAt).toBeNull();
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle null description', () => {
      const roleWithNullDesc: RoleDetail = {
        ...mockRoleDetail,
        description: null,
      };
      const result = toRoleDetailModel(roleWithNullDesc);
      expect(result.description).toBeNull();
    });
  });

  describe('toRoleRowModels', () => {
    it('should convert array of RoleSummary to RoleRowModel[]', () => {
      const roles: RoleSummary[] = [
        mockRoleSummary,
        {
          id: '2',
          roleName: 'User',
          roleCode: 'ROLE_USER',
          status: 'INACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const result = toRoleRowModels(roles);
      expect(result).toHaveLength(2);
      expect(result[0]?.roleName).toBe('Admin');
      expect(result[1]?.roleName).toBe('User');
      expect(result[1]?.statusLabel).toBe('비활성');
    });

    it('should handle empty array', () => {
      const result = toRoleRowModels([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterRoles', () => {
    const roles: RoleSummary[] = [
      mockRoleSummary,
      {
        id: '2',
        roleName: 'User Role',
        roleCode: 'ROLE_USER',
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '3',
        roleName: 'Guest',
        roleCode: 'ROLE_GUEST',
        status: 'INACTIVE',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    it('should return all roles when keyword is empty', () => {
      const result = filterRoles(roles, '');
      expect(result).toHaveLength(3);
    });

    it('should filter by roleName', () => {
      const result = filterRoles(roles, 'Admin');
      expect(result).toHaveLength(1);
      expect(result[0]?.roleName).toBe('Admin');
    });

    it('should filter by roleCode', () => {
      const result = filterRoles(roles, 'ROLE_USER');
      expect(result).toHaveLength(1);
      expect(result[0]?.roleCode).toBe('ROLE_USER');
    });

    it('should be case insensitive', () => {
      const result = filterRoles(roles, 'admin');
      expect(result).toHaveLength(1);
      expect(result[0]?.roleName).toBe('Admin');
    });

    it('should handle partial matches', () => {
      const result = filterRoles(roles, 'User');
      expect(result).toHaveLength(1);
      expect(result[0]?.roleName).toBe('User Role');
    });
  });

  describe('sortRolesByName', () => {
    it('should sort roles by roleName (Korean locale)', () => {
      const roles: RoleSummary[] = [
        {
          id: '3',
          roleName: '가스트',
          roleCode: 'ROLE_GUEST',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '1',
          roleName: 'Admin',
          roleCode: 'ROLE_ADMIN',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          roleName: 'User',
          roleCode: 'ROLE_USER',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const result = sortRolesByName(roles);
      expect(result[0]?.roleName).toBe('Admin');
      expect(result[1]?.roleName).toBe('User');
      expect(result[2]?.roleName).toBe('가스트');
    });

    it('should handle empty roleName', () => {
      const roles: RoleSummary[] = [
        {
          id: '1',
          roleName: 'A',
          roleCode: 'ROLE_A',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          roleName: '',
          roleCode: 'ROLE_B',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];
      const result = sortRolesByName(roles);
      expect(result[0]?.roleCode).toBe('ROLE_B'); // Empty string comes first in localeCompare
    });
  });
});
