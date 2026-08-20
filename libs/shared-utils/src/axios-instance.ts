import { API_URL } from './env';
import { HttpError } from './http-error';
import { getTenantId } from './tenant-util';
import { resolveRequestLocale } from './locale-preference';

type AxiosLikeResponse<T> = { data: T };
type RequestConfig = {
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob';
  timeoutMs?: number;
  signal?: AbortSignal;
  keepalive?: boolean;
};

export type EventStreamMessage = {
  event: string;
  data: unknown;
};

export type EventStreamConfig = {
  signal?: AbortSignal;
  timeoutMs?: number;
  onMessage: (message: EventStreamMessage) => void;
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
  if (body !== undefined && !isFormData(body) && !isBlob(body)) {
    headers['Content-Type'] = 'application/json';
  }
  if (isBlob(body) && !headers['Content-Type']) {
    headers['Content-Type'] = body.type || 'application/octet-stream';
  }
  headers['Accept-Language'] = resolveRequestLocale();
  return headers;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isMutation(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

async function parseBody(response: Response, responseType: 'json' | 'blob' = 'json') {
  if (response.status === 204) return undefined;
  if (responseType === 'blob') return response.blob();
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function loadCsrfToken(keepalive = false): Promise<CsrfTokenData> {
  if (csrfToken) return csrfToken;
  if (csrfTokenPromise) return csrfTokenPromise;

  csrfTokenPromise = fetch(API_URL + '/api/auth/csrf', {
    method: 'GET',
    headers: buildHeaders(undefined),
    credentials: 'include',
    keepalive,
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
  config: RequestConfig = {},
  allowCsrfRetry = true
): Promise<AxiosLikeResponse<T>> {
  const headers = buildHeaders(body, config.headers);
  if (isMutation(method)) {
    const csrf = await loadCsrfToken(config.keepalive);
    headers[csrf.headerName] = csrf.token;
  }

  const controller = config.timeoutMs || config.signal ? new AbortController() : undefined;
  const abortFromCaller = () => controller?.abort(config.signal?.reason);
  if (config.signal?.aborted) abortFromCaller();
  else config.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout =
    controller && config.timeoutMs
      ? globalThis.setTimeout(() => controller.abort('request-timeout'), config.timeoutMs)
      : undefined;
  let response: Response;
  try {
    response = await fetch(API_URL + url, {
      method,
      headers,
      credentials: 'include',
      body:
        body === undefined
          ? undefined
          : isFormData(body) || isBlob(body)
            ? body
            : JSON.stringify(body),
      signal: controller?.signal,
      keepalive: config.keepalive,
    });
  } finally {
    if (timeout !== undefined) globalThis.clearTimeout(timeout);
    config.signal?.removeEventListener('abort', abortFromCaller);
  }
  const payload = await parseBody(response, response.ok ? config.responseType : 'json');

  if (!response.ok) {
    const csrfRejected = response.status === 403 && isMutation(method) && payload === undefined;
    if (csrfRejected) {
      resetCsrfToken();
      if (allowCsrfRetry) return request<T>(method, url, body, config, false);
    }
    if (response.status === 401) {
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

export async function postEventStream<B>(
  url: string,
  body: B,
  config: EventStreamConfig
): Promise<void> {
  return streamRequest('POST', url, body, config, true);
}

export async function getEventStream(url: string, config: EventStreamConfig): Promise<void> {
  return streamRequest('GET', url, undefined, config, false);
}

async function streamRequest<B>(
  method: 'GET' | 'POST',
  url: string,
  body: B | undefined,
  config: EventStreamConfig,
  allowCsrfRetry: boolean
): Promise<void> {
  const headers = buildHeaders(body, { Accept: 'text/event-stream' });
  if (isMutation(method)) {
    const csrf = await loadCsrfToken();
    headers[csrf.headerName] = csrf.token;
  }
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(config.signal?.reason);
  if (config.signal?.aborted) abortFromCaller();
  else config.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = config.timeoutMs
    ? globalThis.setTimeout(() => controller.abort('request-timeout'), config.timeoutMs)
    : undefined;

  try {
    const response = await fetch(API_URL + url, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = await parseBody(response);
      if (response.status === 403 && payload === undefined && allowCsrfRetry) {
        resetCsrfToken();
        return streamRequest(method, url, body, config, false);
      }
      if (response.status === 401) unauthorizedHandler?.(response.status);
      throw new HttpError(
        `Event stream request failed: ${response.status}`,
        response.status,
        payload
      );
    }
    if (!response.body) throw new HttpError('Event stream response body is missing.', 502);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n');
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      frames.filter(Boolean).forEach((frame) => config.onMessage(parseEventFrame(frame)));
      if (done) break;
    }
    if (buffer.trim()) config.onMessage(parseEventFrame(buffer));
  } finally {
    if (timeout !== undefined) globalThis.clearTimeout(timeout);
    config.signal?.removeEventListener('abort', abortFromCaller);
  }
}

function parseEventFrame(frame: string): EventStreamMessage {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  const raw = data.join('\n');
  try {
    return { event, data: raw ? JSON.parse(raw) : null };
  } catch {
    throw new HttpError('Event stream payload is invalid.', 502, raw);
  }
}
