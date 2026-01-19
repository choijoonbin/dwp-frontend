import { axiosInstance } from '../axios-instance';
import { getTenantId } from '../tenant-util';

import type { ApiResponse } from '../types';

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

