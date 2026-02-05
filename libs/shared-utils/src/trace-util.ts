/**
 * 분산 추적용 요청 ID 생성.
 * REST/SSE 요청에 X-Trace-ID 헤더로 사용.
 */
export function generateTraceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `trace-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
