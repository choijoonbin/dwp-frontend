import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResult, PlatformAuditEvent } from './platform-admin-api';

export type IdentityUserAccess = {
  userId: number;
  displayName: string;
  email?: string | null;
  status: string;
  mfaEnabled: boolean;
  roles: string[];
  accessRevision: number;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type IdentityRole = {
  code: string;
  name: string;
  description?: string | null;
  status: string;
};

export type ReplaceIdentityRolesRequest = {
  roleCodes: string[];
  accessRevision: number;
  version: number;
};

export async function listIdentityUsers(query = ''): Promise<PageResult<IdentityUserAccess>> {
  const search = new URLSearchParams({ page: '0', size: '100' });
  if (query.trim()) search.set('query', query.trim());
  const response = await axiosInstance.get<ApiResponse<PageResult<IdentityUserAccess>>>(
    `/api/auth/admin/identity/users?${search.toString()}`
  );
  return response.data.data;
}

export async function listIdentityRoles(): Promise<IdentityRole[]> {
  const response = await axiosInstance.get<ApiResponse<IdentityRole[]>>(
    '/api/auth/admin/identity/roles'
  );
  return response.data.data;
}

export async function replaceIdentityUserRoles(
  user: IdentityUserAccess,
  roleCodes: string[]
): Promise<IdentityUserAccess> {
  const request: ReplaceIdentityRolesRequest = {
    roleCodes,
    accessRevision: user.accessRevision,
    version: user.version,
  };
  const response = await axiosInstance.put<
    ApiResponse<IdentityUserAccess>,
    ReplaceIdentityRolesRequest
  >(`/api/auth/admin/identity/users/${user.userId}/roles`, request);
  return response.data.data;
}

export async function listIdentityAuditEvents(): Promise<PageResult<PlatformAuditEvent>> {
  const response = await axiosInstance.get<ApiResponse<PageResult<PlatformAuditEvent>>>(
    '/api/auth/admin/identity/audit-events?page=0&size=100'
  );
  return response.data.data;
}
