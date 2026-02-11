/**
 * SSE/Stream fetch 요청에 사용하는 헤더를 한 곳에서 정의합니다.
 *
 * fetch()에서는 Connection, Keep-Alive 등 일부 헤더를 클라이언트가 설정할 수 없습니다
 * (restricted header name). 브라우저가 keep-alive를 자동 처리하므로,
 * 스트림 요청 시 Connection 헤더를 넣지 않는 것이 표준적인 방식입니다.
 *
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name
 */

import { generateTraceId } from '../trace-util';

export type StreamHeadersOptions = {
  tenantId: string;
  token?: string | null;
  /** 미지정 시 generateTraceId() 사용 */
  traceId?: string;
  /** POST + JSON body 사용 시 */
  contentType?: 'application/json';
  agentId?: string;
  userId?: string;
  lastEventId?: string;
};

/**
 * SSE/Stream GET 또는 POST 요청에 쓸 헤더 객체를 반환합니다.
 * 필요한 키만 포함하며, Connection 등 restricted header는 포함하지 않습니다.
 */
export function buildStreamRequestHeaders(options: StreamHeadersOptions): Record<string, string> {
  const {
    tenantId,
    token,
    traceId = generateTraceId(),
    contentType,
    agentId,
    userId,
    lastEventId,
  } = options;

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'X-Tenant-ID': tenantId,
    'X-Trace-ID': traceId,
  };

  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (agentId) {
    headers['X-Agent-ID'] = agentId;
  }
  if (userId) {
    headers['X-User-ID'] = userId;
  }
  if (lastEventId) {
    headers['Last-Event-ID'] = lastEventId;
  }

  return headers;
}
