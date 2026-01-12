import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------

export type LoginRequest = {
  email: string;
  password: string;
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

export const login = async (payload: LoginRequest) => {
  const res = await axiosInstance.post<ApiResponse<LoginResponseData>, LoginRequest>(
    DEFAULT_LOGIN_PATH,
    payload,
    { withCredentials: true }
  );
  return res.data;
};

