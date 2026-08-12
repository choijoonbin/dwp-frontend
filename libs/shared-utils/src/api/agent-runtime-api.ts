import { HttpError } from '../http-error';
import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { AgentRegistryResolution, AgentRiskTier } from './agent-plan-api';

export type AskState = 'COMPLETED' | 'ABSTAINED' | 'CONFIGURATION_REQUIRED';
export type AskPolicyOutcome = 'ALLOW' | 'HANDOFF' | 'DENY';
export type AskModelRouteState = 'COMPLETED' | 'NOT_INVOKED' | 'CONFIGURATION_REQUIRED' | 'REFUSED';
export type AskConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type AskCitationSourceType = 'WORK_ITEM' | 'MAIL' | 'CALENDAR';

export type AskDwpRequest = {
  requestId: string;
  query: string;
  locale: string;
  agentKey?: string;
};

export type AskPolicyDecision = {
  outcome: AskPolicyOutcome;
  riskTier: AgentRiskTier;
  code: string;
  explanation: string;
  modelAllowed: boolean;
  mutationAllowed: false;
};

export type AskCitation = {
  sourceId: string;
  sourceType: AskCitationSourceType;
  title: string;
  sourceSystem: string;
  route: string | null;
  occurredAt: string | null;
};

export type AskModelRoute = {
  state: AskModelRouteState;
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
};

export type AskDwpResponse = {
  runId: string;
  auditId: string;
  requestId: string;
  correlationId: string;
  state: AskState;
  answer: string | null;
  confidence: AskConfidence | null;
  citations: AskCitation[];
  sourceCount: number;
  policy: AskPolicyDecision;
  modelRoute: AskModelRoute;
  agentRegistry: AgentRegistryResolution;
  statusCode: string;
  completedAt: string;
};

const STATES: ReadonlySet<AskState> = new Set(['COMPLETED', 'ABSTAINED', 'CONFIGURATION_REQUIRED']);
const OUTCOMES: ReadonlySet<AskPolicyOutcome> = new Set(['ALLOW', 'HANDOFF', 'DENY']);
const MODEL_STATES: ReadonlySet<AskModelRouteState> = new Set([
  'COMPLETED',
  'NOT_INVOKED',
  'CONFIGURATION_REQUIRED',
  'REFUSED',
]);
const RISK_TIERS: ReadonlySet<AgentRiskTier> = new Set(['L0', 'L1', 'L2', 'L3']);

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isCitation(value: unknown): value is AskCitation {
  if (typeof value !== 'object' || value === null) return false;
  const citation = value as Record<string, unknown>;
  return (
    typeof citation.sourceId === 'string' &&
    /^src-[0-9]{2}$/.test(citation.sourceId) &&
    ['WORK_ITEM', 'MAIL', 'CALENDAR'].includes(String(citation.sourceType)) &&
    nonEmptyString(citation.title) &&
    nonEmptyString(citation.sourceSystem) &&
    nullableString(citation.route) &&
    nullableString(citation.occurredAt) &&
    (citation.occurredAt === null || !Number.isNaN(Date.parse(citation.occurredAt)))
  );
}

function isPolicy(value: unknown): value is AskPolicyDecision {
  if (typeof value !== 'object' || value === null) return false;
  const policy = value as Record<string, unknown>;
  return (
    typeof policy.outcome === 'string' &&
    OUTCOMES.has(policy.outcome as AskPolicyOutcome) &&
    typeof policy.riskTier === 'string' &&
    RISK_TIERS.has(policy.riskTier as AgentRiskTier) &&
    nonEmptyString(policy.code) &&
    nonEmptyString(policy.explanation) &&
    typeof policy.modelAllowed === 'boolean' &&
    policy.mutationAllowed === false &&
    (policy.outcome === 'ALLOW' || policy.modelAllowed === false)
  );
}

function isModelRoute(value: unknown): value is AskModelRoute {
  if (typeof value !== 'object' || value === null) return false;
  const route = value as Record<string, unknown>;
  return (
    typeof route.state === 'string' &&
    MODEL_STATES.has(route.state as AskModelRouteState) &&
    nullableString(route.provider) &&
    nullableString(route.model) &&
    nonnegativeInteger(route.inputTokens) &&
    nonnegativeInteger(route.outputTokens) &&
    nonnegativeInteger(route.totalTokens) &&
    route.totalTokens >= route.inputTokens + route.outputTokens &&
    nonnegativeInteger(route.latencyMs) &&
    (route.state !== 'COMPLETED' || (nonEmptyString(route.provider) && nonEmptyString(route.model)))
  );
}

function isRegistry(value: unknown): value is AgentRegistryResolution {
  if (typeof value !== 'object' || value === null) return false;
  const registry = value as Record<string, unknown>;
  return (
    typeof registry.entryKey === 'string' &&
    /^[A-Z][A-Z0-9_.-]{0,99}$/.test(registry.entryKey) &&
    nonnegativeInteger(registry.revision) &&
    nonEmptyString(registry.artifactVersion) &&
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(registry.riskTier)) &&
    (registry.resolution === 'ACTIVE' || registry.resolution === 'REFERENCE_FALLBACK') &&
    (registry.resolution !== 'ACTIVE' || registry.revision > 0)
  );
}

function isAskResponse(value: unknown): value is AskDwpResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Record<string, unknown>;
  if (
    !nonEmptyString(response.runId) ||
    !nonEmptyString(response.auditId) ||
    !nonEmptyString(response.requestId) ||
    !nonEmptyString(response.correlationId) ||
    typeof response.state !== 'string' ||
    !STATES.has(response.state as AskState) ||
    !nullableString(response.answer) ||
    !(
      response.confidence === null ||
      ['LOW', 'MEDIUM', 'HIGH'].includes(String(response.confidence))
    ) ||
    !Array.isArray(response.citations) ||
    !response.citations.every(isCitation) ||
    !nonnegativeInteger(response.sourceCount) ||
    response.citations.length > response.sourceCount ||
    !isPolicy(response.policy) ||
    !isModelRoute(response.modelRoute) ||
    !isRegistry(response.agentRegistry) ||
    !nonEmptyString(response.statusCode) ||
    !nonEmptyString(response.completedAt) ||
    Number.isNaN(Date.parse(response.completedAt))
  ) {
    return false;
  }

  const completed = response.state === 'COMPLETED';
  return completed
    ? nonEmptyString(response.answer) &&
        response.confidence !== null &&
        response.citations.length > 0 &&
        response.policy.outcome === 'ALLOW' &&
        response.policy.modelAllowed &&
        response.modelRoute.state === 'COMPLETED' &&
        response.statusCode === 'ANSWER_GROUNDED'
    : response.answer === null && response.confidence === null && response.citations.length === 0;
}

export async function askDwp(request: AskDwpRequest): Promise<AskDwpResponse> {
  const response = await axiosInstance.post<ApiResponse<unknown>, AskDwpRequest>(
    '/api/agent/v1/ask',
    {
      ...request,
      agentKey: request.agentKey ?? 'DWP_ASSISTANT',
    }
  );
  if (!isAskResponse(response.data.data)) {
    throw new HttpError('Ask runtime response is invalid.', 502, response.data);
  }
  return response.data.data;
}
