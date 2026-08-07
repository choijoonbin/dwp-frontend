import { API_URL } from './env';
import { HttpError } from './http-error';
import { getTenantId } from './tenant-util';
import { getAccessToken } from './auth/token-storage';

type AxiosLikeResponse<T> = { data: T };
type RequestConfig = {
  headers?: Record<string, string>;
  withCredentials?: boolean;
};

type UnauthorizedHandler = (status: number) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function buildHeaders(body: unknown, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Tenant-ID': getTenantId(),
    ...extra,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getAccessToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (typeof navigator !== 'undefined' && navigator.language) {
    headers['Accept-Language'] = navigator.language;
  }
  return headers;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  config: RequestConfig = {}
): Promise<AxiosLikeResponse<T>> {
  const response = await fetch(API_URL + url, {
    method,
    headers: buildHeaders(body, config.headers),
    credentials: config.withCredentials ? 'include' : 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      unauthorizedHandler?.(response.status);
    }
    const record = typeof payload === 'object' && payload !== null
      ? payload as Record<string, unknown>
      : null;
    const message =
      (typeof record?.message === 'string' && record.message) ||
      (typeof record?.error === 'string' && record.error) ||
      'Request failed: ' + response.status;
    throw new HttpError(message, response.status, payload);
  }

  return { data: payload as T };
}

export const axiosInstance = {
  get: <T>(url: string, config?: RequestConfig) => request<T>('GET', url, undefined, config),
  post: <T, B = unknown>(url: string, body: B, config?: RequestConfig) =>
    request<T>('POST', url, body, config),
  put: <T, B = unknown>(url: string, body: B, config?: RequestConfig) =>
    request<T>('PUT', url, body, config),
  patch: <T, B = unknown>(url: string, body: B, config?: RequestConfig) =>
    request<T>('PATCH', url, body, config),
  delete: <T>(url: string, config?: RequestConfig) =>
    request<T>('DELETE', url, undefined, config),
};
