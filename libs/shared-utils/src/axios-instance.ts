// ----------------------------------------------------------------------

import { NX_API_URL } from './env';
import { HttpError } from './http-error';
import { getTenantId } from './tenant-util';
import { getAccessToken } from './auth/token-storage';

const baseURL = NX_API_URL;

type AxiosLikeResponse<T> = { data: T };

type AxiosLikeConfig = {
  headers?: Record<string, string>;
  withCredentials?: boolean;
};

// Global state for agent ID (if needed across apps)
let currentAgentId: string | null = null;

export const setAgentId = (id: string | null) => {
  currentAgentId = id;
};

/**
 * NOTE:
 * - Workspace에서 axios/@tanstack/react-query 설치가 불가한 환경에서도 앱을 실행할 수 있도록
 *   최소 기능(get)만 제공하는 "axios-like" wrapper 입니다.
 * - 실제 백엔드 연동 표준은 이 파일을 axios 기반으로 교체하는 것입니다.
 */
export const axiosInstance = {
  get: async <T>(url: string, config: AxiosLikeConfig = {}): Promise<AxiosLikeResponse<T>> => {
    const token = getAccessToken();
    const tenantId = getTenantId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      ...(config.headers ?? {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (currentAgentId) {
      headers['X-Agent-ID'] = currentAgentId;
    }

    const res = await fetch(`${baseURL}${url}`, {
      method: 'GET',
      headers,
      credentials: config.withCredentials ? 'include' : 'same-origin',
    });

    if (!res.ok) {
      throw new HttpError(`Request failed: ${res.status} ${res.statusText}`, res.status);
    }

    const data = (await res.json()) as T;
    return { data };
  },
  post: async <T, B = unknown>(
    url: string,
    body: B,
    config: AxiosLikeConfig = {}
  ): Promise<AxiosLikeResponse<T>> => {
    const token = getAccessToken();
    const tenantId = getTenantId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      ...(config.headers ?? {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (currentAgentId) {
      headers['X-Agent-ID'] = currentAgentId;
    }

    const res = await fetch(`${baseURL}${url}`, {
      method: 'POST',
      headers,
      credentials: config.withCredentials ? 'include' : 'same-origin',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new HttpError(`Request failed: ${res.status} ${res.statusText}`, res.status);
    }

    const data = (await res.json()) as T;
    return { data };
  },
};

