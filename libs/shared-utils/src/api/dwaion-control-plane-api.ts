import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
  type ProductSurfaceSecureMutationAuthority,
} from './product-surface-governed-mutation';
import {
  parseDwaionConnectors,
  parseDwaionEvaluationSafety,
  parseDwaionGovernedCommand,
  parseDwaionGovernedCommands,
  parseDwaionIncidents,
  parseDwaionModelsRouting,
  parseDwaionOutcomes,
} from './dwaion-control-plane-parser';
import type {
  DwaionConnectorsSnapshot,
  DwaionEvaluationSafetySnapshot,
  DwaionGovernedCommand,
  DwaionGovernedCommandDecisionRequest,
  DwaionGovernedCommandRequest,
  DwaionGovernedCommandRestartRequest,
  DwaionGovernedCommandTransitionRequest,
  DwaionGovernedCommandsSnapshot,
  DwaionIncidentsSnapshot,
  DwaionModelsRoutingSnapshot,
  DwaionOutcomesSnapshot,
} from './dwaion-control-plane-contract';

const BASE_PATH = '/api/agent/v1/admin/control-plane';

export async function getDwaionModelsRouting(): Promise<DwaionModelsRoutingSnapshot> {
  const response = await axiosInstance.get<ApiResponse<DwaionModelsRoutingSnapshot>>(
    `${BASE_PATH}/models-routing`
  );
  return parseDwaionModelsRouting(response.data.data);
}

export async function getDwaionConnectors(): Promise<DwaionConnectorsSnapshot> {
  const response = await axiosInstance.get<ApiResponse<DwaionConnectorsSnapshot>>(
    `${BASE_PATH}/connectors`
  );
  return parseDwaionConnectors(response.data.data);
}

export async function getDwaionEvaluationSafety(): Promise<DwaionEvaluationSafetySnapshot> {
  const response = await axiosInstance.get<ApiResponse<DwaionEvaluationSafetySnapshot>>(
    `${BASE_PATH}/evaluation-safety`
  );
  return parseDwaionEvaluationSafety(response.data.data);
}

export async function getDwaionIncidents(): Promise<DwaionIncidentsSnapshot> {
  const response = await axiosInstance.get<ApiResponse<DwaionIncidentsSnapshot>>(
    `${BASE_PATH}/incidents`
  );
  return parseDwaionIncidents(response.data.data);
}

export async function getDwaionOutcomes(
  periodDays = 30,
  filters?: { organization?: string; workType?: string }
): Promise<DwaionOutcomesSnapshot> {
  const days = Math.max(1, Math.min(Math.trunc(periodDays), 90));
  const search = new URLSearchParams({ period_days: String(days) });
  if (filters?.organization?.trim()) search.set('organization', filters.organization.trim());
  if (filters?.workType?.trim()) search.set('work_type', filters.workType.trim());
  const response = await axiosInstance.get<ApiResponse<DwaionOutcomesSnapshot>>(
    `${BASE_PATH}/outcomes?${search.toString()}`
  );
  return parseDwaionOutcomes(response.data.data);
}

export async function createDwaionGovernedCommand(
  request: DwaionGovernedCommandRequest,
  authority: ProductSurfaceSecureMutationAuthority
): Promise<DwaionGovernedCommand> {
  const mutationConfig =
    request.kind === 'EMERGENCY_RECOVERY'
      ? productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
      : productSurfaceGovernedMutationConfig(authority);
  const response = await axiosInstance.post<
    ApiResponse<DwaionGovernedCommand>,
    DwaionGovernedCommandRequest
  >(`${BASE_PATH}/commands`, request, mutationConfig);
  return parseDwaionGovernedCommand(response.data.data);
}

export async function getDwaionGovernedCommand(commandId: string): Promise<DwaionGovernedCommand> {
  const response = await axiosInstance.get<ApiResponse<DwaionGovernedCommand>>(
    `${BASE_PATH}/commands/${encodeURIComponent(commandId)}`
  );
  return parseDwaionGovernedCommand(response.data.data);
}

export async function getDwaionGovernedCommands(filters?: {
  state?: DwaionGovernedCommand['state'];
  limit?: number;
}): Promise<DwaionGovernedCommandsSnapshot> {
  const search = new URLSearchParams();
  if (filters?.state) search.set('state', filters.state);
  const limit =
    filters?.limit == null ? undefined : Math.max(1, Math.min(100, Math.trunc(filters.limit)));
  if (limit != null) search.set('limit', String(limit));
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<DwaionGovernedCommandsSnapshot>>(
    `${BASE_PATH}/commands${suffix}`
  );
  return parseDwaionGovernedCommands(response.data.data, filters?.state, limit);
}

export async function decideDwaionGovernedCommand(
  commandId: string,
  request: DwaionGovernedCommandDecisionRequest,
  authority: ProductSurfaceSecureMutationAuthority
): Promise<DwaionGovernedCommand> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionGovernedCommand>,
    DwaionGovernedCommandDecisionRequest
  >(
    `${BASE_PATH}/commands/${encodeURIComponent(commandId)}/decision`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionGovernedCommand(response.data.data);
}

export async function cancelDwaionGovernedCommand(
  commandId: string,
  request: DwaionGovernedCommandTransitionRequest,
  authority: ProductSurfaceSecureMutationAuthority
): Promise<DwaionGovernedCommand> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionGovernedCommand>,
    DwaionGovernedCommandTransitionRequest
  >(
    `${BASE_PATH}/commands/${encodeURIComponent(commandId)}/cancel`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionGovernedCommand(response.data.data);
}

export async function retryDwaionGovernedCommand(
  commandId: string,
  request: DwaionGovernedCommandRestartRequest,
  authority: ProductSurfaceSecureMutationAuthority
): Promise<DwaionGovernedCommand> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionGovernedCommand>,
    DwaionGovernedCommandRestartRequest
  >(
    `${BASE_PATH}/commands/${encodeURIComponent(commandId)}/retry`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionGovernedCommand(response.data.data);
}

export async function rollbackDwaionGovernedCommand(
  commandId: string,
  request: DwaionGovernedCommandRestartRequest,
  authority: ProductSurfaceSecureMutationAuthority
): Promise<DwaionGovernedCommand> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionGovernedCommand>,
    DwaionGovernedCommandRestartRequest
  >(
    `${BASE_PATH}/commands/${encodeURIComponent(commandId)}/rollback`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionGovernedCommand(response.data.data);
}
