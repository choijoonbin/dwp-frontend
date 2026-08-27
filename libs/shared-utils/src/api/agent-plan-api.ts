import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { HttpError } from '../http-error';
import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

type AgentSchemas = AgentComponents['schemas'];

export type AgentRiskTier = AgentSchemas['RiskTier'];

export type AgentActionHandoffOrigin = Omit<
  AgentSchemas['ActionHandoffOrigin'],
  'conversationId'
> & {
  conversationId: string | null;
};

export type AgentPlanPreviewRequest = AgentSchemas['PlanPreviewRequest'];

export type AgentRegistryResolution = AgentSchemas['AgentRegistryResolution'];

export type AgentPlanStep = AgentSchemas['PlanStep'];

export type AgentPlanPreview = Omit<AgentSchemas['PlanPreviewResponse'], 'handoffOrigin'> & {
  handoffOrigin?: AgentActionHandoffOrigin | null;
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

function isAgentRegistryResolution(value: unknown): value is AgentRegistryResolution {
  if (typeof value !== 'object' || value === null) return false;
  const registry = value as Record<string, unknown>;
  return (
    typeof registry.entryKey === 'string' &&
    /^[A-Z][A-Z0-9_.-]{0,99}$/.test(registry.entryKey) &&
    typeof registry.revision === 'number' &&
    Number.isInteger(registry.revision) &&
    registry.revision >= 0 &&
    isNonEmptyString(registry.artifactVersion) &&
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(registry.riskTier)) &&
    (registry.resolution === 'ACTIVE' || registry.resolution === 'REFERENCE_FALLBACK') &&
    (registry.resolution !== 'ACTIVE' || registry.revision > 0)
  );
}

export function isAgentActionHandoffOrigin(value: unknown): value is AgentActionHandoffOrigin {
  if (typeof value !== 'object' || value === null) return false;
  const origin = value as Record<string, unknown>;
  return (
    origin.appKey === 'APP.ASK' &&
    typeof origin.route === 'string' &&
    /^\/dwaion\/(?:new|conversations\/[0-9a-f-]{36})$/.test(origin.route) &&
    origin.surface === 'action-shelf' &&
    typeof origin.sourceRunId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      origin.sourceRunId
    ) &&
    isNonEmptyString(origin.sourceRequestId) &&
    isNonEmptyString(origin.sourceCorrelationId) &&
    (origin.conversationId === null || typeof origin.conversationId === 'string')
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
    plan.referenceMode === true &&
    isAgentRegistryResolution(plan.agentRegistry) &&
    (plan.handoffOrigin === undefined ||
      plan.handoffOrigin === null ||
      isAgentActionHandoffOrigin(plan.handoffOrigin))
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
