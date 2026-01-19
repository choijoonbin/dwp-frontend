import { getTenantId } from '../tenant-util';
import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { MenuNode } from '../auth/types';

// ----------------------------------------------------------------------

export type LoginRequest = {
  username: string;
  password: string;
  tenantId: string;
};

export type LoginResponseData =
  | {
      accessToken: string;
      refreshToken?: string;
      tokenType?: 'Bearer';
    }
  | {
      token: string;
    }
  | string;

export type PermissionDTO = {
  resourceKey: string;
  resourceType: 'MENU' | 'BUTTON' | 'API' | 'RESOURCE';
  permissionCode: 'VIEW' | 'USE' | 'CREATE' | 'UPDATE' | 'DELETE' | 'MANAGE';
  effect: 'ALLOW' | 'DENY';
};

export type UserInfo = {
  id: string;
  username: string;
  email?: string;
  [key: string]: unknown;
};

/**
 * NOTE: dwp-auth-server의 실제 로그인 엔드포인트에 맞춰 path를 조정해야 합니다.
 * 기본값은 Gateway 기준 `/api/auth/login` 입니다.
 */
const DEFAULT_LOGIN_PATH = '/api/auth/login';

export const login = async (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => {
  // tenantId가 제공되지 않으면 자동으로 가져옴
  const tenantId = payload.tenantId || getTenantId();
  
  const requestBody: LoginRequest = {
    username: payload.username,
    password: payload.password,
    tenantId,
  };

  const res = await axiosInstance.post<ApiResponse<LoginResponseData>, LoginRequest>(
    DEFAULT_LOGIN_PATH,
    requestBody,
    { withCredentials: true }
  );
  return res.data;
};

/**
 * Get current user information
 */
export const getMe = async (): Promise<ApiResponse<UserInfo>> => {
  const res = await axiosInstance.get<ApiResponse<UserInfo>>('/api/auth/me');
  return res.data;
};/**
 * Get user permissions
 */
export const getPermissions = async (): Promise<ApiResponse<PermissionDTO[]>> => {
  const res = await axiosInstance.get<ApiResponse<PermissionDTO[]>>('/api/auth/permissions');
  return res.data;
};

/**
 * Menu tree API response structure
 */
export type MenuTreeResponse = {
  menus: MenuNode[];
  groups?: Array<{
    groupCode: string;
    groupName: string;
    menus: MenuNode[];
  }>;
};

/**
 * Get menu tree (with permissions applied)
 */
export const getMenuTree = async (): Promise<ApiResponse<MenuTreeResponse>> => {
  const res = await axiosInstance.get<ApiResponse<MenuTreeResponse>>('/api/auth/menus/tree');
  return res.data;
};