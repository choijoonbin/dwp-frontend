/**
 * ApiResponse unwrap 및 Contract Validation 유틸
 *
 * @see docs/reference/SYNAPSEX_CONTRACT_AND_VERIFICATION_SPEC.md
 *
 * - unwrapApiResponse: status !== SUCCESS/OK 시 표준 에러 throw
 * - reportContractMismatch: 개발 모드에서 schema mismatch 시 console/Sentry
 */

import type { ApiResponse } from '../types';

const SUCCESS_STATUSES = ['SUCCESS', 'OK'] as const;

/**
 * ApiResponse unwrap — status가 SUCCESS/OK가 아니면 throw
 * 에러 메시지: res.message || 'API request failed'
 */
export function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (SUCCESS_STATUSES.includes(res.status as (typeof SUCCESS_STATUSES)[number])) {
    return res.data;
  }
  const message = res.message || 'API request failed';
  const err = new Error(message);
  (err as Error & { errorCode?: string }).errorCode = res.errorCode;
  throw err;
}

/**
 * 개발 모드에서 schema mismatch 보고
 * - console.error로 항상 출력
 * - Sentry 등이 있으면 captureException 호출 (선택)
 *
 * 사용 예 (zod 등):
 *   if (import.meta.env?.DEV) {
 *     const parsed = schema.safeParse(data);
 *     if (!parsed.success) {
 *       reportContractMismatch('CaseList', parsed.error, data);
 *     }
 *   }
 */
export function reportContractMismatch(
  endpointOrSchema: string,
  error: unknown,
  rawData?: unknown
): void {
  const msg = `[Contract] ${endpointOrSchema} schema mismatch`;
  console.error(msg, error, rawData);

  // Sentry 등이 전역에 있으면 호출 (선택)
  const win = typeof window !== 'undefined' ? (window as unknown as { Sentry?: { captureException: (e: unknown) => void } }) : null;
  if (win?.Sentry) {
    win.Sentry.captureException(error);
  }
}
