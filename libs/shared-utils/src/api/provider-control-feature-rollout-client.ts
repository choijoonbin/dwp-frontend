import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  ProviderFeatureEvaluation,
  ProviderFeatureFlag,
  ProviderFeatureRollout,
  ProviderFeatureValue,
} from './provider-control-contracts';

const BASE = '/api/provider/v1/admin';

export async function listProviderFeatureFlags(): Promise<ProviderFeatureFlag[]> {
  const response = await axiosInstance.get<ApiResponse<ProviderFeatureFlag[]>>(
    `${BASE}/feature-rollouts/flags`
  );
  return response.data.data;
}

export async function createProviderFeatureFlag(request: {
  featureKey: string;
  displayName: string;
  description: string;
  ownerService: string;
  valueType: ProviderFeatureFlag['valueType'];
  defaultValue: ProviderFeatureValue;
  configurationSchema: Record<string, unknown>;
  riskTier: ProviderFeatureFlag['riskTier'];
}): Promise<ProviderFeatureFlag> {
  const response = await axiosInstance.post<ApiResponse<ProviderFeatureFlag>, typeof request>(
    `${BASE}/feature-rollouts/flags`,
    request
  );
  return response.data.data;
}

export async function listProviderFeatureRollouts(
  featureKey?: string
): Promise<ProviderFeatureRollout[]> {
  const search = featureKey ? `?featureKey=${encodeURIComponent(featureKey)}` : '';
  const response = await axiosInstance.get<ApiResponse<ProviderFeatureRollout[]>>(
    `${BASE}/feature-rollouts${search}`
  );
  return response.data.data;
}

export async function createProviderFeatureRollout(
  featureKey: string,
  request: {
    name: string;
    rolloutValue: ProviderFeatureValue;
    targeting: Record<string, unknown>;
    strategy: ProviderFeatureRollout['strategy'];
    justification: string;
    stages: Array<{
      stageName: string;
      exposurePercentage: number;
      minimumObservationMinutes: number;
      healthGate: Record<string, unknown>;
    }>;
  }
): Promise<ProviderFeatureRollout> {
  const response = await axiosInstance.post<ApiResponse<ProviderFeatureRollout>, typeof request>(
    `${BASE}/feature-rollouts/flags/${encodeURIComponent(featureKey)}/revisions`,
    request
  );
  return response.data.data;
}

type ProviderFeatureVersionedReason = { version: number; reason: string };

async function transitionProviderFeatureRollout(
  rollout: ProviderFeatureRollout,
  action: 'submit' | 'activate' | 'pause' | 'resume' | 'rollback',
  reason: string
): Promise<ProviderFeatureRollout> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderFeatureRollout>,
    ProviderFeatureVersionedReason
  >(`${BASE}/feature-rollouts/${rollout.rolloutRevisionId}/${action}`, {
    version: rollout.version,
    reason,
  });
  return response.data.data;
}

export const submitProviderFeatureRollout = (rollout: ProviderFeatureRollout, reason: string) =>
  transitionProviderFeatureRollout(rollout, 'submit', reason);

export const activateProviderFeatureRollout = (rollout: ProviderFeatureRollout, reason: string) =>
  transitionProviderFeatureRollout(rollout, 'activate', reason);

export const pauseProviderFeatureRollout = (rollout: ProviderFeatureRollout, reason: string) =>
  transitionProviderFeatureRollout(rollout, 'pause', reason);

export const resumeProviderFeatureRollout = (rollout: ProviderFeatureRollout, reason: string) =>
  transitionProviderFeatureRollout(rollout, 'resume', reason);

export const rollbackProviderFeatureRollout = (rollout: ProviderFeatureRollout, reason: string) =>
  transitionProviderFeatureRollout(rollout, 'rollback', reason);

export async function decideProviderFeatureRollout(
  rollout: ProviderFeatureRollout,
  decision: 'APPROVED' | 'REJECTED',
  reason: string
): Promise<ProviderFeatureRollout> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderFeatureRollout>,
    { version: number; decision: string; reason: string }
  >(`${BASE}/feature-rollouts/${rollout.rolloutRevisionId}/approval`, {
    version: rollout.version,
    decision,
    reason,
  });
  return response.data.data;
}

export async function advanceProviderFeatureRollout(
  rollout: ProviderFeatureRollout,
  reason: string,
  observedHealth: Record<string, unknown>
): Promise<ProviderFeatureRollout> {
  const response = await axiosInstance.post<
    ApiResponse<ProviderFeatureRollout>,
    { version: number; reason: string; observedHealth: Record<string, unknown> }
  >(`${BASE}/feature-rollouts/${rollout.rolloutRevisionId}/advance`, {
    version: rollout.version,
    reason,
    observedHealth,
  });
  return response.data.data;
}

export async function evaluateProviderFeatureFlag(
  featureKey: string,
  tenantId: string
): Promise<ProviderFeatureEvaluation> {
  const search = new URLSearchParams({ tenantId });
  const response = await axiosInstance.get<ApiResponse<ProviderFeatureEvaluation>>(
    `${BASE}/feature-rollouts/flags/${encodeURIComponent(featureKey)}/evaluate?${search.toString()}`
  );
  return response.data.data;
}
