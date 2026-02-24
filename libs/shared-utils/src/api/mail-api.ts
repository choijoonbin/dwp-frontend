/**
 * Mail / 소명 요청 — mail-service API
 * 감사관이 리스크 확인 후 원클릭으로 담당자에게 소명 요청 메일 발송
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type SendExplanationRequestBody = {
  caseId: string;
  /** 발견된 위반 정황 요약 (선택) */
  summary?: string;
  violationSummary?: string;
};

export type SendExplanationRequestResponse = {
  sent: boolean;
  messageId?: string;
  [key: string]: unknown;
};

/**
 * 소명 요청 메일 발송 — 해당 케이스 번호와 위반 정황이 담긴 메일을 담당자에게 발송
 * BE: POST /api/mail/explanation-request 또는 /api/synapse/mail/explanation-request
 */
export const sendExplanationRequest = async (
  body: SendExplanationRequestBody
): Promise<ApiResponse<SendExplanationRequestResponse>> => {
  const res = await axiosInstance.post<ApiResponse<SendExplanationRequestResponse>>(
    '/api/synapse/mail/explanation-request',
    body
  );
  return res.data;
};
