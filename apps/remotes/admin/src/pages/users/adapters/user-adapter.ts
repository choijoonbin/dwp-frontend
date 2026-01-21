// ----------------------------------------------------------------------

import type { UserDetail, UserSummary } from '@dwp-frontend/shared-utils';

import type { UserRowModel, UserDetailModel } from '../types';

// ----------------------------------------------------------------------

/**
 * Convert UserSummary API response to UserRowModel (UI Model for table)
 */
export const toUserRowModel = (user: UserSummary): UserRowModel => ({
    id: user.id,
    userName: user.userName || '',
    email: user.email || null,
    departmentName: user.departmentName || null,
    status: user.status || 'INACTIVE',
    statusLabel: user.status === 'ACTIVE' ? '활성' : '비활성',
    statusColor: user.status === 'ACTIVE' ? 'success' : 'default',
    createdAt: user.createdAt || '',
    lastLoginAt: user.lastLoginAt || null,
    loginType: null, // Will be populated from accounts if available
  });

/**
 * Convert UserDetail API response to UserDetailModel (UI Model for detail view/form)
 */
export const toUserDetailModel = (user: UserDetail): UserDetailModel => ({
    id: user.id,
    userName: user.userName || '',
    email: user.email || null,
    departmentId: user.departmentId || null,
    departmentName: user.departmentName || null,
    status: user.status || 'INACTIVE',
    statusLabel: user.status === 'ACTIVE' ? '활성' : '비활성',
    statusColor: user.status === 'ACTIVE' ? 'success' : 'default',
    createdAt: user.createdAt || '',
    lastLoginAt: user.lastLoginAt || null,
    accounts: user.accounts || [],
  });

/**
 * Convert UserSummary[] to UserRowModel[]
 */
export const toUserRowModels = (users: UserSummary[]): UserRowModel[] => users.map(toUserRowModel);

/**
 * Get login type from accounts (first account's accountType)
 */
export const getLoginType = (accounts?: Array<{ accountType: string }>): string | null => {
  if (!accounts || accounts.length === 0) return null;
  return accounts[0]?.accountType || null;
};
