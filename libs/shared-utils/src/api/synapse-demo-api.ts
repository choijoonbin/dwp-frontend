/**
 * Synapse 시연 데이터 제어 API
 * POST /api/synapse/demo/generate-violation — 위반 시나리오 데이터 생성
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type GenerateViolationRequestBody = {
  /** 시나리오 식별자 (예: weekend-meal, per-capita-limit, late-night) */
  scenarioKey: string;
};

export type GenerateViolationResponse = {
  generatedCount?: number;
  message?: string;
  [key: string]: unknown;
};

// ----------------------------------------------------------------------
// API
// ----------------------------------------------------------------------

/**
 * 위반 시나리오 데이터 생성
 * 성공 시 알림이 푸시되며 상단 알림 배지가 갱신될 수 있음.
 */
export const generateViolation = async (
  body: GenerateViolationRequestBody
): Promise<ApiResponse<GenerateViolationResponse>> => {
  const res = await axiosInstance.post<ApiResponse<GenerateViolationResponse>>(
    '/api/synapse/demo/generate-violation',
    body
  );
  return res.data;
};
