/**
 * Synapse Agent Tools API
 * Case Detail용 Agent Stream, Simulation
 * @see docs/remotes/synapsex/[전달용]CASE_DETAIL_HITL_STREAMING_FE_PROMPT.md
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type CaseSimulationRequest = {
  caseId: string;
  actionId?: string;
};

export type CaseSimulationResponse = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  outcome: 'success' | 'failed';
  message?: string;
  impactedObjects?: string[];
  validations?: Array<{ name: string; passed: boolean; message: string }>;
  riskNotes?: string[];
};

// ----------------------------------------------------------------------
// Simulation API (JSON)
// ----------------------------------------------------------------------

/**
 * Case 기반 Simulation 실행
 * POST /api/synapse/agent-tools/actions/simulate
 * BE 미구현 시 POST /api/synapse/actions/{actionId}/simulate (기존) fallback
 */
export const runCaseSimulation = async (
  params: CaseSimulationRequest
): Promise<ApiResponse<CaseSimulationResponse>> => {
  const { data } = await axiosInstance.post<ApiResponse<CaseSimulationResponse>>(
    '/api/synapse/agent-tools/actions/simulate',
    params
  );
  return data;
};
