import { API_URL } from './env';
import { HttpError } from './http-error';
import { getTenantId } from './tenant-util';
import { resolveRequestLocale } from './locale-preference';

type AxiosLikeResponse<T> = { data: T };
type RequestConfig = {
  headers?: Record<string, string>;
};

type CsrfTokenData = {
  token: string;
  headerName: string;
};

type UnauthorizedHandler = (status: number) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let csrfToken: CsrfTokenData | null = null;
let csrfTokenPromise: Promise<CsrfTokenData> | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function resetCsrfToken(): void {
  csrfToken = null;
  csrfTokenPromise = null;
}

function buildHeaders(body: unknown, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Tenant-ID': getTenantId(),
    ...extra,
  };
  if (body !== undefined && !isFormData(body)) headers['Content-Type'] = 'application/json';
  headers['Accept-Language'] = resolveRequestLocale();
  return headers;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isMutation(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
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

async function loadCsrfToken(): Promise<CsrfTokenData> {
  if (csrfToken) return csrfToken;
  if (csrfTokenPromise) return csrfTokenPromise;

  csrfTokenPromise = fetch(API_URL + '/api/auth/csrf', {
    method: 'GET',
    headers: buildHeaders(undefined),
    credentials: 'include',
  })
    .then(async (response) => {
      const payload = await parseBody(response);
      if (!response.ok) {
        throw new HttpError(
          'CSRF token request failed: ' + response.status,
          response.status,
          payload
        );
      }
      const data = (payload as { data?: Partial<CsrfTokenData> } | null)?.data;
      if (!data || typeof data.token !== 'string' || typeof data.headerName !== 'string') {
        throw new HttpError('CSRF token response is invalid.', response.status, payload);
      }
      csrfToken = { token: data.token, headerName: data.headerName };
      return csrfToken;
    })
    .finally(() => {
      csrfTokenPromise = null;
    });

  return csrfTokenPromise;
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  config: RequestConfig = {}
): Promise<AxiosLikeResponse<T>> {
  const headers = buildHeaders(body, config.headers);
  if (isMutation(method)) {
    const csrf = await loadCsrfToken();
    headers[csrf.headerName] = csrf.token;
  }

  const response = await fetch(API_URL + url, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isFormData(body) ? body : JSON.stringify(body),
  });
  const payload = await parseBody(response);

  if (!response.ok) {
    if (response.status === 403 && isMutation(method)) resetCsrfToken();
    if (response.status === 401 || response.status === 403) {
      unauthorizedHandler?.(response.status);
    }
    const record =
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
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
  delete: <T>(url: string, config?: RequestConfig) => request<T>('DELETE', url, undefined, config),
};
