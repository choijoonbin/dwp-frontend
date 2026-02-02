// ----------------------------------------------------------------------

import type { UserDetail, UserSummary } from '@dwp-frontend/shared-utils';

import type { UserRowModel, UserDetailModel } from '../types';

// ----------------------------------------------------------------------

/**
 * Convert UserSummary API response to UserRowModel (UI Model for table)
 * BE 목록 응답: comUserId(long) 사용. id 없을 수 있음 → comUserId를 id로 매핑.
 * 로그인 유형: items[].providerType (예: LOCAL, OIDC) → 그리드 "로그인 유형" 컬럼에 매핑.
 */
const normalizeStatus = (status: UserSummary['status']): 'ACTIVE' | 'INACTIVE' =>
  status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';

export const toUserRowModel = (user: UserSummary): UserRowModel => ({
  id: user.id ?? String(user.comUserId ?? ''),
  userName: user.userName || '',
  email: user.email || null,
  departmentName: user.departmentName || null,
  status: normalizeStatus(user.status),
  statusLabel: user.status === 'ACTIVE' ? '활성' : '비활성',
  statusColor: user.status === 'ACTIVE' ? 'success' : 'default',
  createdAt: user.createdAt || '',
  lastLoginAt: user.lastLoginAt || null,
  loginType: user.providerType ?? null,
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
