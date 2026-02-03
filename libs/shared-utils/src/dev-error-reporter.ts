/**
 * Dev Error Reporter — Observability
 * API 실패 시 endpoint/params/tenant를 dev panel에 전달
 * @see SynapseX 운영형 UX 마감 - Observability
 */

export type DevErrorPayload = {
  endpoint: string;
  method?: string;
  params?: Record<string, unknown>;
  tenantId?: string;
  status?: number;
  message: string;
  /** BE 응답 헤더 X-Gateway-Request-Id */
  gatewayRequestId?: string;
  /** BE 응답 헤더 X-Trace-Id */
  traceId?: string;
};

let reporter: ((p: DevErrorPayload) => void) | null = null;

export function registerDevErrorReporter(fn: ((p: DevErrorPayload) => void) | null): void {
  reporter = fn;
}

export function reportDevErrorToReporter(payload: DevErrorPayload): void {
  if (typeof window === 'undefined') return;
  reporter?.(payload);
}
