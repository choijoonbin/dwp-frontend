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
  effectiveRoles?: string[];
  effectiveAccess?: IdentityEffectiveAccess[];
  lastSignInAt?: string | null;
  activeSessionCount?: number;
  roleManagement: {
    allowed: boolean;
    reason:
      | 'ALLOWED'
      | 'SELF'
      | 'IDENTITY_INACTIVE'
      | 'PROTECTED_ROLE'
      | 'ROLE_ASSIGNMENT_REQUIRES_TENANT_ADMIN';
  };
  accessRevision: number;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type IdentityEffectiveAccess = {
  roleId: number;
  roleCode: string;
  roleName: string;
  privileged: boolean;
  sourceType: 'DIRECT' | 'GROUP' | 'APP_ACCESS_REQUEST' | 'ADMIN_DIRECT' | 'ACCESS_PACKAGE';
  sourceId: string;
  sourceKey?: string | null;
  sourceName?: string | null;
  assignmentType: string;
  scopeType: string;
  scopeRef?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  assignedAt?: string | null;
};

export type IdentityRole = {
  code: string;
  name: string;
  description?: string | null;
  roleFamily: 'WORKSPACE' | 'PEOPLE' | 'AUDIT' | string;
  assignmentClass: 'BASELINE' | 'DELEGATED' | string;
  privileged: boolean;
  assignmentMode: 'DIRECT' | string;
  conflictsWith: string[];
  status: string;
};

export type ReplaceIdentityRolesRequest = {
  roleCodes: string[];
  justification: string;
  accessRevision: number;
  version: number;
};

const IDENTITY_PAGE_SIZE = 100;
const MAX_IDENTITY_PAGES = 10_000;

async function getIdentityUsersPage(
  query: string,
  page: number,
  signal?: AbortSignal
): Promise<PageResult<IdentityUserAccess>> {
  const search = new URLSearchParams({ page: String(page), size: String(IDENTITY_PAGE_SIZE) });
  if (query.trim()) search.set('query', query.trim());
  const response = await axiosInstance.get<ApiResponse<PageResult<IdentityUserAccess>>>(
    `/api/auth/admin/identity/users?${search.toString()}`,
    signal ? { signal } : undefined
  );
  return response.data.data;
}

function assertIdentityPage(
  page: PageResult<IdentityUserAccess>,
  expectedPage: number,
  first: PageResult<IdentityUserAccess>
): void {
  if (
    page.page !== expectedPage ||
    page.size !== first.size ||
    page.totalElements !== first.totalElements ||
    page.totalPages !== first.totalPages ||
    page.content.length > page.size
  ) {
    throw new Error('IDENTITY_DIRECTORY_PAGINATION_CHANGED');
  }
}

export async function listIdentityUsers(
  query = '',
  signal?: AbortSignal
): Promise<PageResult<IdentityUserAccess>> {
  const first = await getIdentityUsersPage(query, 0, signal);
  if (
    first.page !== 0 ||
    first.size < 1 ||
    first.totalElements < 0 ||
    first.totalPages < 0 ||
    first.totalPages > MAX_IDENTITY_PAGES ||
    first.content.length > first.size
  ) {
    throw new Error('IDENTITY_DIRECTORY_PAGINATION_INVALID');
  }

  const content = [...first.content];
  for (let pageNumber = 1; pageNumber < first.totalPages; pageNumber += 1) {
    const page = await getIdentityUsersPage(query, pageNumber, signal);
    assertIdentityPage(page, pageNumber, first);
    content.push(...page.content);
  }

  if (content.length !== first.totalElements) {
    throw new Error('IDENTITY_DIRECTORY_COVERAGE_INCOMPLETE');
  }
  if (new Set(content.map((user) => user.userId)).size !== content.length) {
    throw new Error('IDENTITY_DIRECTORY_DUPLICATE_PRINCIPAL');
  }

  return { ...first, content };
}

export async function listIdentityRoles(): Promise<IdentityRole[]> {
  const response = await axiosInstance.get<ApiResponse<IdentityRole[]>>(
    '/api/auth/admin/identity/roles'
  );
  return response.data.data;
}

export async function replaceIdentityUserRoles(
  user: IdentityUserAccess,
  roleCodes: string[],
  justification: string
): Promise<IdentityUserAccess> {
  const request: ReplaceIdentityRolesRequest = {
    roleCodes,
    justification,
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
