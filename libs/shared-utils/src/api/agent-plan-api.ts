import { HttpError } from '../http-error';
import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type AgentRiskTier = 'L0' | 'L1' | 'L2' | 'L3';

export type AgentPlanPreviewRequest = {
  requestId: string;
  intent: string;
  action: string;
  target: string;
  sourceReferences: string[];
};

export type AgentPlanStep = {
  id: string;
  title: string;
  tool: string;
  description: string;
};

export type AgentPlanPreview = {
  runId: string;
  auditId: string;
  planHash: string;
  correlationId: string;
  state: 'REVIEW';
  riskTier: AgentRiskTier;
  approvalRequired: boolean;
  mutationAllowed: boolean;
  summary: string;
  steps: AgentPlanStep[];
  sourceReferences: string[];
  referenceMode: boolean;
};

const RISK_TIERS: ReadonlySet<AgentRiskTier> = new Set(['L0', 'L1', 'L2', 'L3']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlanStep(value: unknown): value is AgentPlanStep {
  if (typeof value !== 'object' || value === null) return false;
  const step = value as Record<string, unknown>;
  return (
    isNonEmptyString(step.id) &&
    isNonEmptyString(step.title) &&
    isNonEmptyString(step.tool) &&
    isNonEmptyString(step.description)
  );
}

function isGovernedPlanPreview(value: unknown): value is AgentPlanPreview {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Record<string, unknown>;
  const riskTier = plan.riskTier;
  const elevatedRisk = riskTier === 'L2' || riskTier === 'L3';

  return (
    isNonEmptyString(plan.runId) &&
    isNonEmptyString(plan.auditId) &&
    typeof plan.planHash === 'string' &&
    /^[a-f0-9]{64}$/.test(plan.planHash) &&
    isNonEmptyString(plan.correlationId) &&
    plan.state === 'REVIEW' &&
    typeof riskTier === 'string' &&
    RISK_TIERS.has(riskTier as AgentRiskTier) &&
    typeof plan.approvalRequired === 'boolean' &&
    (!elevatedRisk || plan.approvalRequired) &&
    plan.mutationAllowed === false &&
    isNonEmptyString(plan.summary) &&
    Array.isArray(plan.steps) &&
    plan.steps.length > 0 &&
    plan.steps.every(isPlanStep) &&
    Array.isArray(plan.sourceReferences) &&
    plan.sourceReferences.every(isNonEmptyString) &&
    plan.referenceMode === true
  );
}

export async function previewAgentPlan(
  request: AgentPlanPreviewRequest
): Promise<AgentPlanPreview> {
  const response = await axiosInstance.post<ApiResponse<unknown>, AgentPlanPreviewRequest>(
    '/api/agent/v1/plans/preview',
    request
  );
  if (!isGovernedPlanPreview(response.data.data)) {
    throw new HttpError('Agent plan preview response is invalid.', 502, response.data);
  }
  return response.data.data;
}
