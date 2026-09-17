import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { HttpError } from '../http-error';
import { axiosInstance, postEventStream } from '../axios-instance';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

import type { ApiResponse } from '../types';
import type { AgentRegistryResolution, AgentRiskTier } from './agent-plan-api';

type AgentSchemas = AgentComponents['schemas'];

export type AskState = AgentSchemas['AskState'];
export type AskPolicyOutcome = AgentSchemas['PolicyOutcome'];
export type AskModelRouteState = AgentSchemas['ModelRouteState'];
export type AskConfidence = AgentSchemas['AnswerConfidence'];
export type AskCitationSourceType = AgentSchemas['CitationSourceType'];
export type AskPersonalization = AgentSchemas['AskPersonalization'];
export type AskPersonalizationState = AgentSchemas['AskPersonalizationState'];
export type AskProgressStage =
  'AUTHORIZING' | 'RETRIEVING' | 'REASONING' | 'VERIFYING' | 'PERSISTING' | 'COMPLETED';

export type AskPageContext = Omit<
  AgentSchemas['AskPageContext'],
  'surface' | 'entityType' | 'entityRef'
> & {
  surface?: string;
  entityType?: string;
  entityRef?: string;
};

export type AskDwpRequest = Omit<
  AgentSchemas['AskRequest'],
  'agentKey' | 'conversationId' | 'pageContext'
> & {
  agentKey?: string;
  conversationId?: string;
  pageContext?: AskPageContext;
  /** Security-scanned attachment identifiers bound to this request. */
  attachmentIds?: string[];
};

export type AskDwpOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (stage: AskProgressStage) => void;
  authority?: ProductSurfaceGovernedMutationAuthority;
};

export type AskPolicyDecision = Omit<AgentSchemas['AskPolicyDecision'], 'mutationAllowed'> & {
  mutationAllowed: false;
};

export type AskCitation = Omit<AgentSchemas['AskCitation'], 'route' | 'occurredAt' | 'excerpt'> & {
  route: string | null;
  occurredAt: string | null;
  excerpt: string | null;
};

export type AskModelRoute = Omit<AgentSchemas['AskModelRoute'], 'provider' | 'model'> & {
  provider: string | null;
  model: string | null;
};

export type AskDwpResponse = Omit<
  AgentSchemas['AskResponse'],
  | 'answer'
  | 'confidence'
  | 'citations'
  | 'policy'
  | 'modelRoute'
  | 'agentRegistry'
  | 'conversationId'
  | 'userMessageId'
  | 'assistantMessageId'
> & {
  answer: string | null;
  confidence: AskConfidence | null;
  citations: AskCitation[];
  policy: AskPolicyDecision;
  modelRoute: AskModelRoute;
  agentRegistry: AgentRegistryResolution;
  conversationId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
};

const STATES: ReadonlySet<AskState> = new Set(['COMPLETED', 'ABSTAINED', 'CONFIGURATION_REQUIRED']);
const OUTCOMES: ReadonlySet<AskPolicyOutcome> = new Set(['ALLOW', 'HANDOFF', 'DENY']);
const MODEL_STATES: ReadonlySet<AskModelRouteState> = new Set([
  'COMPLETED',
  'NOT_INVOKED',
  'CONFIGURATION_REQUIRED',
  'REFUSED',
]);
const GROUNDED_FALLBACK_PROVIDER = 'DWP_GROUNDED_FALLBACK';
const RISK_TIERS: ReadonlySet<AgentRiskTier> = new Set(['L0', 'L1', 'L2', 'L3']);
const PERSONALIZATION_STATES: ReadonlySet<AskPersonalizationState> = new Set([
  'NOT_EVALUATED',
  'NOT_PERMITTED',
  'DISABLED',
  'EMPTY',
  'APPLIED',
  'BYPASSED',
  'UNAVAILABLE',
]);
const PERSONALIZATION_KINDS = new Set([
  'RESPONSE_LENGTH',
  'OUTPUT_FORMAT',
  'TONE',
  'WORKING_STYLE',
]);

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
    [
      'WORK_ITEM',
      'MAIL',
      'CALENDAR',
      'APPROVAL_TASK',
      'APPROVAL_REQUEST',
      'APPROVAL_FORM',
      'APPROVAL_OPERATION',
    ].includes(String(citation.sourceType)) &&
    nonEmptyString(citation.title) &&
    nonEmptyString(citation.sourceSystem) &&
    nullableString(citation.route) &&
    nullableString(citation.occurredAt) &&
    nullableString(citation.excerpt) &&
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

function isPersonalization(value: unknown): value is AskPersonalization {
  if (typeof value !== 'object' || value === null) return false;
  const personalization = value as Record<string, unknown>;
  const state = personalization.state;
  const appliedKinds = personalization.appliedKinds;
  if (
    typeof state !== 'string' ||
    !PERSONALIZATION_STATES.has(state as AskPersonalizationState) ||
    !Array.isArray(appliedKinds) ||
    appliedKinds.length > 4 ||
    new Set(appliedKinds).size !== appliedKinds.length ||
    !appliedKinds.every((kind) => PERSONALIZATION_KINDS.has(String(kind)))
  ) {
    return false;
  }
  return state === 'APPLIED' ? appliedKinds.length > 0 : appliedKinds.length === 0;
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
    !(response.personalization === undefined || isPersonalization(response.personalization)) ||
    !nonEmptyString(response.statusCode) ||
    !nonEmptyString(response.completedAt) ||
    Number.isNaN(Date.parse(response.completedAt)) ||
    !nullableString(response.conversationId) ||
    !nullableString(response.userMessageId) ||
    !nullableString(response.assistantMessageId)
  ) {
    return false;
  }

  const completed = response.state === 'COMPLETED';
  const fallbackUsed =
    isModelRoute(response.modelRoute) &&
    response.modelRoute.provider === GROUNDED_FALLBACK_PROVIDER;
  const expectedCompletedStatus = fallbackUsed ? 'ANSWER_GROUNDED_FALLBACK' : 'ANSWER_GROUNDED';
  return completed
    ? nonEmptyString(response.answer) &&
        response.confidence !== null &&
        response.citations.length > 0 &&
        response.policy.outcome === 'ALLOW' &&
        response.policy.modelAllowed &&
        response.modelRoute.state === 'COMPLETED' &&
        response.statusCode === expectedCompletedStatus
    : response.answer === null && response.confidence === null && response.citations.length === 0;
}

export async function askDwp(
  request: AskDwpRequest,
  options: AskDwpOptions = {}
): Promise<AskDwpResponse> {
  const governed = options.authority
    ? productSurfaceGovernedMutationConfig(options.authority)
    : undefined;
  const response = await axiosInstance.post<ApiResponse<unknown>, AskDwpRequest>(
    '/api/agent/v1/ask',
    {
      ...request,
      agentKey: request.agentKey ?? 'DWP_ASSISTANT',
    },
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 60_000,
      ...governed,
    }
  );
  if (!isAskResponse(response.data.data)) {
    throw new HttpError('Ask runtime response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function askDwpStream(
  request: AskDwpRequest,
  options: AskDwpOptions = {}
): Promise<AskDwpResponse> {
  let result: AskDwpResponse | null = null;
  const governed = options.authority
    ? productSurfaceGovernedMutationConfig(options.authority)
    : undefined;
  await postEventStream(
    '/api/agent/v1/ask/stream',
    { ...request, agentKey: request.agentKey ?? 'DWP_ASSISTANT' },
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 60_000,
      ...governed,
      onMessage: ({ event, data }) => {
        const record =
          typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;
        if (event === 'progress' && record && typeof record.stage === 'string') {
          options.onProgress?.(record.stage as AskProgressStage);
          return;
        }
        if (event === 'error') {
          throw new HttpError(
            typeof record?.code === 'string' ? record.code : 'Ask stream failed.',
            502,
            data
          );
        }
        if (event !== 'result' || !record) return;
        const candidate = record.data;
        if (!isAskResponse(candidate)) {
          throw new HttpError('Ask runtime stream response is invalid.', 502, data);
        }
        result = candidate;
      },
    }
  );
  if (!result) throw new HttpError('Ask runtime stream completed without a result.', 502);
  return result;
}
