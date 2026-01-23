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
  responseType?: 'json' | 'blob' | 'text' | 'arraybuffer';
};

// Global state for agent ID (if needed across apps)
let currentAgentId: string | null = null;

export const setAgentId = (id: string | null) => {
  currentAgentId = id;
};

// Global error handlers (injected by Host app)
type UnauthorizedHandler = (status: number) => void;
let onUnauthorizedHandler: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false; // Prevent infinite loop

/**
 * Set global unauthorized handler (401/403)
 * Should be called once by Host app during initialization
 */
export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onUnauthorizedHandler = handler;
};

/**
 * Handle 401/403 errors globally
 * - 401: Calls onUnauthorizedHandler (logout + redirect)
 * - 403: Calls onUnauthorizedHandler (no logout, just redirect to /403)
 */
const handleAuthError = (status: number): void => {
  // Prevent infinite loop: if already handling, don't handle again
  if (isHandlingUnauthorized) {
    return;
  }

  // Prevent redirect if already on sign-in or 403 page
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (currentPath === '/sign-in' || currentPath === '/403') {
      return;
    }
  }

  if (onUnauthorizedHandler) {
    isHandlingUnauthorized = true;
    try {
      onUnauthorizedHandler(status);
    } finally {
      // Reset flag after a short delay to allow redirect
      setTimeout(() => {
        isHandlingUnauthorized = false;
      }, 100);
    }
  }
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
      const status = res.status;
      // Handle 401/403 globally
      if (status === 401 || status === 403) {
        handleAuthError(status);
      }
      throw new HttpError(`Request failed: ${status} ${res.statusText}`, status);
    }

    // Handle different response types
    let data: T;
    if (config.responseType === 'blob') {
      data = (await res.blob()) as T;
    } else if (config.responseType === 'text') {
      data = (await res.text()) as T;
    } else if (config.responseType === 'arraybuffer') {
      data = (await res.arrayBuffer()) as T;
    } else {
      // Default: json
      data = (await res.json()) as T;
    }
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
      const status = res.status;
      // Handle 401/403 globally
      if (status === 401 || status === 403) {
        handleAuthError(status);
      }
      throw new HttpError(`Request failed: ${status} ${res.statusText}`, status);
    }

    const data = (await res.json()) as T;
    return { data };
  },
  put: async <T, B = unknown>(
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
      method: 'PUT',
      headers,
      credentials: config.withCredentials ? 'include' : 'same-origin',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const status = res.status;
      // Handle 401/403 globally
      if (status === 401 || status === 403) {
        handleAuthError(status);
      }
      throw new HttpError(`Request failed: ${status} ${res.statusText}`, status);
    }

    const data = (await res.json()) as T;
    return { data };
  },
  patch: async <T, B = unknown>(
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
      method: 'PATCH',
      headers,
      credentials: config.withCredentials ? 'include' : 'same-origin',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403) {
        handleAuthError(status);
      }
      throw new HttpError(`Request failed: ${status} ${res.statusText}`, status);
    }

    const data = (await res.json()) as T;
    return { data };
  },
  delete: async <T>(url: string, config: AxiosLikeConfig = {}): Promise<AxiosLikeResponse<T>> => {
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
      method: 'DELETE',
      headers,
      credentials: config.withCredentials ? 'include' : 'same-origin',
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403) {
        handleAuthError(status);
      }
      throw new HttpError(`Request failed: ${status} ${res.statusText}`, status);
    }

    const data = res.status === 204 ? ({} as T) : ((await res.json()) as T);
    return { data };
  },
};

