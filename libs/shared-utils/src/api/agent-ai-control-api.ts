import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const BASE_PATH = '/api/agent/v1/admin/ai-control';

export type AIExternalDataState = 'VERIFIED' | 'STALE' | 'UNAVAILABLE' | 'UNVERIFIED';
export type AIBudgetEnforcementMode = 'ALERT_ONLY' | 'ENFORCED';
export type AIEvaluationGateStatus = 'NOT_REQUIRED' | 'PENDING' | 'PASSED' | 'FAILED' | 'STALE';
export type AIEvaluationEvidenceState = 'VERIFIED' | 'STALE' | 'UNAVAILABLE';
export type AIMeasurementFreshness = 'CURRENT' | 'STALE' | 'UNAVAILABLE';
export type AIRuntimeControlState =
  'ENABLED' | 'EMERGENCY_DISABLED' | 'POLICY_NOT_CONFIGURED' | 'CONTROL_UNAVAILABLE';

export type AIModelRoutePolicy = {
  provider: string;
  model: string;
  region?: string | null;
  availabilityState: AIExternalDataState;
  availabilityObservedAt?: string | null;
};

export type TenantAIExecutionPolicy = {
  emergencyDisabled: boolean;
  allowedModelRoutes: AIModelRoutePolicy[];
  allowedToolKeys: string[];
  allowedKnowledgeSources: string[];
  maxOutputTokensPerRequest: number;
  budgetEnforcementMode: AIBudgetEnforcementMode;
  periodTokenLimit?: number | null;
  alertThresholdPercent: number;
  requireEvaluationPass: boolean;
  evaluationGateStatus: AIEvaluationGateStatus;
  evaluationEvidenceState: AIEvaluationEvidenceState;
  evaluationObservedAt?: string | null;
  evaluationPolicyVersion?: number | null;
  policyVersion: number;
  updatedAt: string;
};

export type AIUsageObservation = {
  periodStart: string;
  periodEnd: string;
  measuredInputTokens: number;
  measuredOutputTokens: number;
  measuredTotalTokens: number;
  reservedTokens: number;
  unmeasuredReservedTokens: number;
  measurementFreshness: AIMeasurementFreshness;
  measurementObservedAt?: string | null;
  estimatedCostMinor?: number | null;
  billedCostMinor?: number | null;
  currency?: string | null;
  providerUsageState: AIExternalDataState;
  providerPricingState: AIExternalDataState;
  providerBillingState: AIExternalDataState;
};

export type AIControlOverview = {
  controlScope: 'ASK_RUNTIME';
  enforcementActivationState: 'DISABLED' | 'ENABLED';
  runtimeControlState: AIRuntimeControlState;
  toolEnforcementState: 'NOT_CONNECTED';
  policy?: TenantAIExecutionPolicy | null;
  usage: AIUsageObservation;
  warnings: string[];
};

export type EditableAIExecutionPolicy = {
  allowedModelRoutes: AIModelRoutePolicy[];
  allowedToolKeys: string[];
  allowedKnowledgeSources: string[];
  maxOutputTokensPerRequest: number;
  budgetEnforcementMode: AIBudgetEnforcementMode;
  periodTokenLimit?: number | null;
  alertThresholdPercent: number;
  requireEvaluationPass: boolean;
  evaluationGateStatus: 'NOT_REQUIRED' | 'PENDING';
  evaluationObservedAt?: null;
  evaluationPolicyVersion?: null;
  changeReason: string;
};

export type BootstrapAIExecutionPolicyRequest = EditableAIExecutionPolicy & {
  idempotencyKey: string;
  expectedExistingCount: 0;
};

export type UpdateAIExecutionPolicyRequest = EditableAIExecutionPolicy & {
  expectedVersion: number;
};

export type SetAIEmergencyDisableRequest = {
  disabled: boolean;
  expectedVersion: number;
  changeReason: string;
};

export async function getAIControlOverview(): Promise<AIControlOverview> {
  const response = await axiosInstance.get<ApiResponse<AIControlOverview>>(BASE_PATH);
  return response.data.data;
}

export async function bootstrapAIExecutionPolicy(
  request: BootstrapAIExecutionPolicyRequest,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<AIControlOverview> {
  const response = await axiosInstance.post<
    ApiResponse<AIControlOverview>,
    BootstrapAIExecutionPolicyRequest
  >(`${BASE_PATH}/bootstrap`, request, productSurfaceGovernedMutationConfig(authority));
  return response.data.data;
}

export async function updateAIExecutionPolicy(
  request: UpdateAIExecutionPolicyRequest,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<AIControlOverview> {
  const response = await axiosInstance.put<
    ApiResponse<AIControlOverview>,
    UpdateAIExecutionPolicyRequest
  >(`${BASE_PATH}/policy`, request, productSurfaceGovernedMutationConfig(authority));
  return response.data.data;
}

export async function setAIEmergencyDisable(
  request: SetAIEmergencyDisableRequest,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<AIControlOverview> {
  const response = await axiosInstance.post<
    ApiResponse<AIControlOverview>,
    SetAIEmergencyDisableRequest
  >(`${BASE_PATH}/emergency`, request, productSurfaceGovernedMutationConfig(authority));
  return response.data.data;
}
