import { API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { axiosInstance, resetCsrfToken } from '../axios-instance';

import type { ApiResponse } from '../types';

export type LoginRequest = {
  username: string;
  password: string;
  tenantId: string;
};

export type PermissionDTO = {
  resourceType: string;
  resourceKey: string;
  permissionCode: string;
  effect: 'ALLOW' | 'DENY';
};

export type LoginResponseData = {
  expiresIn?: number;
  userId?: string;
  tenantId?: string;
  permissions?: PermissionDTO[];
};

export type MeResponse = {
  userId: number;
  displayName: string;
  email?: string | null;
  tenantId: number;
  tenantCode: string;
  roles: string[];
};

export type AuthSessionData = {
  sessionId: string;
  current: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  startedAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  expiresAt: string;
};

export type SessionRotationData = {
  rotated: boolean;
  idleExpiresAt: string;
  expiresAt: string;
};

export async function login(
  payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }
): Promise<ApiResponse<LoginResponseData>> {
  const response = await axiosInstance.post<ApiResponse<LoginResponseData>, LoginRequest>(
    '/api/auth/login',
    {
      username: payload.username,
      password: payload.password,
      tenantId: payload.tenantId || getTenantId(),
    }
  );
  return response.data;
}

export async function getMe(): Promise<ApiResponse<MeResponse>> {
  return (await axiosInstance.get<ApiResponse<MeResponse>>('/api/auth/me')).data;
}

export async function getPermissions(): Promise<ApiResponse<PermissionDTO[]>> {
  return (await axiosInstance.get<ApiResponse<PermissionDTO[]>>('/api/auth/permissions')).data;
}

export async function getAuthSessions(): Promise<ApiResponse<AuthSessionData[]>> {
  return (await axiosInstance.get<ApiResponse<AuthSessionData[]>>('/api/auth/sessions')).data;
}

export async function rotateBrowserSession(): Promise<ApiResponse<SessionRotationData>> {
  return (
    await axiosInstance.post<ApiResponse<SessionRotationData>, undefined>(
      '/api/auth/session/refresh',
      undefined
    )
  ).data;
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>('/api/auth/sessions/' + sessionId);
}

export async function logoutOtherSessions(): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, undefined>(
    '/api/auth/sessions/logout-others',
    undefined
  );
}

export async function logout(): Promise<void> {
  try {
    await axiosInstance.post<ApiResponse<void>, undefined>('/api/auth/logout', undefined);
  } finally {
    resetCsrfToken();
  }
}

export type OidcCallbackParams = {
  code: string;
  state: string;
  providerKey?: string;
  tenantId?: string;
};

export async function getOidcCallback(
  params: OidcCallbackParams
): Promise<ApiResponse<LoginResponseData>> {
  const search = new URLSearchParams({ code: params.code, state: params.state });
  if (params.providerKey) search.set('providerKey', params.providerKey);
  if (params.tenantId) search.set('tenantId', params.tenantId);
  return (
    await axiosInstance.get<ApiResponse<LoginResponseData>>(
      '/api/auth/oidc/callback?' + search.toString()
    )
  ).data;
}

export function buildOidcLoginUrl(providerKey: string): string {
  const search = new URLSearchParams({
    providerKey,
    tenantId: getTenantId(),
  });
  return API_URL + '/api/auth/oidc/login?' + search.toString();
}
