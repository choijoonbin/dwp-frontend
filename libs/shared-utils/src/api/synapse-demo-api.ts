/**
 * Synapse 시연 데이터 제어 API
 * - POST /api/demo/generate — 시연 시나리오 생성 (BE: camelCase/snake_case 둘 다 수용)
 * - POST /api/synapse/demo/generate-violation — 위반 시나리오 생성
 *
 * /api/demo/generate: Content-Type application/json 필수. base_currency 미사용(전송 제거 권장).
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// POST /api/demo/generate
// ----------------------------------------------------------------------
// BE 허용: scenario_type | scenarioType, total_count | count, intensity, limit_amount_krw | limitAmountKrw, amount_range_min | amountRangeMin, amount_range_max | amountRangeMax

export type DemoScenarioType =
  | 'split_payment'
  | 'weekend_use'
  | 'limit_excess'
  | 'LATE_NIGHT'
  | 'WEEKEND_MEAL'
  | 'OVER_LIMIT'
  | 'NORMAL';

export type DemoIntensity = 'NORMAL' | 'WARNING' | 'VIOLATION';

export type GenerateDemoRequestBody = {
  /** 시나리오 유형. 미지정 시 NORMAL */
  scenario_type: DemoScenarioType;
  /** 생성 건수 1~10. 미지정 시 1 */
  total_count: number;
  /** VIOLATION | NORMAL. 미지정 시 시나리오 유추 */
  intensity: DemoIntensity;
  /** 규정 한도(원). 미지정 시 30000 (선택) */
  limit_amount_krw?: number;
  /** 금액 범위 하한(원). max와 함께 지정 시 구간 랜덤 (선택) */
  amount_range_min?: number;
  /** 금액 범위 상한(원). min과 함께 지정 시 구간 랜덤 (선택) */
  amount_range_max?: number;
};

export type GenerateDemoResponse = {
  message?: string;
  [key: string]: unknown;
};

export const generateDemo = async (
  body: GenerateDemoRequestBody
): Promise<ApiResponse<GenerateDemoResponse>> => {
  const res = await axiosInstance.post<ApiResponse<GenerateDemoResponse>>(
    '/api/demo/generate',
    body,
    { headers: { 'Content-Type': 'application/json' } }
  );
  return res.data;
};

// ----------------------------------------------------------------------
// POST /api/synapse/demo/generate-violation
// ----------------------------------------------------------------------
// Dynamic random: intensity + limitAmountKrw 또는 amountRangeMin/Max 사용.
// VIOLATION → 규정 150%~500% 구간 랜덤, NORMAL → 50%~90% 구간 랜덤.
// amountRangeMin/Max 있으면 해당 구간으로 랜덤(비율 무시). 전표 저장 후 Detect 비동기.

/** BE scenarioType (예: WEEKEND_MEAL, OVER_LIMIT, LATE_NIGHT, PER_CAPITA_LIMIT) */
export type ScenarioType = 'WEEKEND_MEAL' | 'PER_CAPITA_LIMIT' | 'LATE_NIGHT' | 'OVER_LIMIT';

/** 금액 랜덤 강도: 미지정 시 시나리오로 유추 */
export type ViolationIntensity = 'NORMAL' | 'VIOLATION';

export type GenerateViolationRequestBody = {
  /** 시나리오 유형 (BE enum) */
  scenarioType: ScenarioType;
  /** 생성 건수 (1~10 등) */
  count: number;
  /** VIOLATION: 규정 150%~500% 랜덤, NORMAL: 50%~90% 랜덤. 미지정 시 시나리오 유추 */
  intensity?: ViolationIntensity;
  /** 규정 한도(원). 미지정 시 30,000 */
  limitAmountKrw?: number;
  /** 금액 범위 최소(원, 선택). 있으면 amountRangeMax와 함께 사용 시 비율 무시 */
  amountRangeMin?: number;
  /** 금액 범위 최대(원, 선택). amountRangeMin <= amountRangeMax */
  amountRangeMax?: number;
};

export type GenerateViolationResponse = {
  /** 생성된 전표 복합키 목록 (bukrs-belnr-gjahr) */
  createdDocKeys?: string[];
  detectRunStatus?: string;
  createdCaseIds?: string[];
  detectRunId?: string | null;
  generatedCount?: number;
  message?: string;
  [key: string]: unknown;
};

// ----------------------------------------------------------------------
// API
// ----------------------------------------------------------------------

/**
 * 위반 시나리오 데이터 생성
 * 전표 저장 후 Detect는 비동기 실행되며, Thought Chain이 바로 시작되고 케이스 생성 시 WebSocket 알림.
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
