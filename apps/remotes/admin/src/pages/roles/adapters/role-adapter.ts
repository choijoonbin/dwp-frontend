// ----------------------------------------------------------------------

import type { RoleDetail, RoleSummary } from '@dwp-frontend/shared-utils';

import type { RoleRowModel, RoleDetailModel } from '../types';

// ----------------------------------------------------------------------

/**
 * Convert RoleSummary API response to RoleRowModel (UI Model for table)
 */
export const toRoleRowModel = (role: RoleSummary): RoleRowModel => ({
    id: role.id,
    roleName: role.roleName || '',
    roleCode: role.roleCode || '',
    status: role.status || 'INACTIVE',
    statusLabel: role.status === 'ACTIVE' ? '활성' : '비활성',
    statusColor: role.status === 'ACTIVE' ? 'success' : 'default',
    memberCount: role.memberCount ?? 0,
    departmentCount: role.departmentCount ?? 0,
    updatedAt: role.createdAt, // Use createdAt as fallback for updatedAt
  });

/**
 * Convert RoleDetail API response to RoleDetailModel (UI Model for detail view/form)
 */
export const toRoleDetailModel = (role: RoleDetail | RoleSummary): RoleDetailModel => {
  const description = 'description' in role && role.description ? String(role.description) : null;
  const createdAt = 'createdAt' in role && role.createdAt ? String(role.createdAt) : '';
  const updatedAt = 'updatedAt' in role && role.updatedAt ? String(role.updatedAt) : null;

  return {
    id: role.id,
    roleName: role.roleName || '',
    roleCode: role.roleCode || '',
    description,
    status: role.status || 'INACTIVE',
    statusLabel: role.status === 'ACTIVE' ? '활성' : '비활성',
    statusColor: role.status === 'ACTIVE' ? 'success' : 'default',
    createdAt,
    updatedAt,
  };
};

/**
 * Convert RoleSummary[] to RoleRowModel[]
 */
export const toRoleRowModels = (roles: RoleSummary[]): RoleRowModel[] => roles.map(toRoleRowModel);

/**
 * Filter roles by keyword (roleName or roleCode)
 */
export const filterRoles = (roles: RoleSummary[], keyword: string): RoleSummary[] => {
  if (!keyword) return roles;

  const lowerKeyword = keyword.toLowerCase();
  return roles.filter(
    (role) =>
      (role.roleName || '').toLowerCase().includes(lowerKeyword) ||
      (role.roleCode || '').toLowerCase().includes(lowerKeyword)
  );
};

/**
 * Sort roles by roleName (ascending)
 */
export const sortRolesByName = (roles: RoleSummary[]): RoleSummary[] => [...roles].sort((a, b) => (a.roleName || '').localeCompare(b.roleName || '', 'ko'));

/**
 * Sort roles by roleCode (ascending)
 */
export const sortRolesByCode = (roles: RoleSummary[]): RoleSummary[] => [...roles].sort((a, b) => (a.roleCode || '').localeCompare(b.roleCode || '', 'ko'));

/**
 * Sort roles by status (ACTIVE first)
 */
export const sortRolesByStatus = (roles: RoleSummary[]): RoleSummary[] => [...roles].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return 0;
  });
