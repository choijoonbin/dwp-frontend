import { axiosInstance } from '../axios-instance';
import {
  parseWorkplacePlanningBookingImpactCommandResult,
  parseWorkplacePlanningCommandResult,
  parseWorkplacePlanningOverview,
  parseWorkplacePlanningScenario,
  parseWorkplacePlanningScenarios,
  parseWorkplacePlanningSources,
} from './workplace-planning-contract';

import type { ApiResponse } from '../types';
import type {
  WorkplacePlanningDraft,
  WorkplacePlanningScenarioState,
  WorkplacePlanningScope,
} from './workplace-planning-contract';

const BASE = '/api/platform/v1/admin/workplace/space-planning';

export type WorkplacePlanningCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
}>;
export type WorkplacePlanningElevatedCommandOptions = WorkplacePlanningCommandOptions &
  Readonly<{ activeAccessMode: 'ELEVATED' }>;

export type WorkplacePlanningCreateScenarioInput = Readonly<{
  name: string;
  description: string | null;
  scope: WorkplacePlanningScope;
  draft: WorkplacePlanningDraft;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplacePlanningUpdateScenarioInput = Readonly<{
  expectedVersion: number;
  name: string;
  description: string | null;
  draft: WorkplacePlanningDraft;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplacePlanningTransitionInput = Readonly<{
  expectedVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplacePlanningApprovalInput = WorkplacePlanningTransitionInput &
  Readonly<{
    decision: 'APPROVE' | 'REJECT';
    approvalAuthorityReference: string;
  }>;

function required(value: string, label: string, maximum = 500) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error(`${label} is invalid.`);
  return normalized;
}

function commandHeaders(
  options: WorkplacePlanningCommandOptions | WorkplacePlanningElevatedCommandOptions
) {
  return {
    'Idempotency-Key': required(options.idempotencyKey, 'Idempotency key', 160),
    ...(options.correlationId
      ? { 'X-Correlation-ID': required(options.correlationId, 'Correlation id', 160) }
      : {}),
    ...('activeAccessMode' in options
      ? { 'X-DWP-Active-Access-Mode': options.activeAccessMode }
      : {}),
    'Cache-Control': 'no-store',
  };
}

function scenarioPath(scenarioId: string) {
  return `${BASE}/scenarios/${encodeURIComponent(required(scenarioId, 'Scenario id', 200))}`;
}

function scopeQuery(scope: WorkplacePlanningScope) {
  const query = new URLSearchParams({
    siteId: required(scope.siteId, 'Site id', 200),
    from: required(scope.from, 'Planning start', 80),
    to: required(scope.to, 'Planning end', 80),
  });
  if (scope.floorId) query.set('floorId', scope.floorId);
  if (scope.neighborhood) query.set('neighborhood', scope.neighborhood);
  if (scope.resourceType) query.set('resourceType', scope.resourceType);
  return query.toString();
}

export async function getWorkplacePlanningOverview(scope: WorkplacePlanningScope) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${BASE}/overview?${scopeQuery(scope)}`,
    { headers: { 'Cache-Control': 'no-store' } }
  );
  return parseWorkplacePlanningOverview(response.data.data);
}

export async function getWorkplacePlanningSources(scope: WorkplacePlanningScope) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${BASE}/sources?${scopeQuery(scope)}`,
    { headers: { 'Cache-Control': 'no-store' } }
  );
  return parseWorkplacePlanningSources(response.data.data);
}

export async function getWorkplacePlanningScenarios(
  filters: {
    siteId?: string;
    state?: WorkplacePlanningScenarioState;
  } = {}
) {
  const query = new URLSearchParams();
  if (filters.siteId) query.set('siteId', required(filters.siteId, 'Site id', 200));
  if (filters.state) query.set('state', filters.state);
  const suffix = query.size ? `?${query.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${BASE}/scenarios${suffix}`, {
    headers: { 'Cache-Control': 'no-store' },
  });
  return parseWorkplacePlanningScenarios(response.data.data);
}

export async function getWorkplacePlanningScenario(scenarioId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(scenarioPath(scenarioId), {
    headers: { 'Cache-Control': 'no-store' },
  });
  return parseWorkplacePlanningScenario(response.data.data);
}

export async function createWorkplacePlanningScenario(
  input: WorkplacePlanningCreateScenarioInput,
  options: WorkplacePlanningCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplacePlanningCreateScenarioInput
  >(`${BASE}/scenarios`, input, { headers: commandHeaders(options) });
  return parseWorkplacePlanningCommandResult(response.data.data);
}

export async function updateWorkplacePlanningScenario(
  scenarioId: string,
  input: WorkplacePlanningUpdateScenarioInput,
  options: WorkplacePlanningCommandOptions
) {
  const response = await axiosInstance.put<
    ApiResponse<unknown>,
    WorkplacePlanningUpdateScenarioInput
  >(scenarioPath(scenarioId), input, { headers: commandHeaders(options) });
  return parseWorkplacePlanningCommandResult(response.data.data);
}

async function scenarioCommand(
  scenarioId: string,
  action: 'preview' | 'submit' | 'publish',
  input: WorkplacePlanningTransitionInput,
  options: WorkplacePlanningCommandOptions | WorkplacePlanningElevatedCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplacePlanningTransitionInput>(
    `${scenarioPath(scenarioId)}:${action}`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplacePlanningCommandResult(response.data.data);
}

export function previewWorkplacePlanningScenario(
  scenarioId: string,
  input: WorkplacePlanningTransitionInput,
  options: WorkplacePlanningCommandOptions
) {
  return scenarioCommand(scenarioId, 'preview', input, options);
}

export function submitWorkplacePlanningScenario(
  scenarioId: string,
  input: WorkplacePlanningTransitionInput,
  options: WorkplacePlanningElevatedCommandOptions
) {
  return scenarioCommand(scenarioId, 'submit', input, options);
}

export async function approveWorkplacePlanningScenario(
  scenarioId: string,
  input: WorkplacePlanningApprovalInput,
  options: WorkplacePlanningElevatedCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplacePlanningApprovalInput>(
    `${scenarioPath(scenarioId)}:approve`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplacePlanningCommandResult(response.data.data);
}

export function publishWorkplacePlanningScenario(
  scenarioId: string,
  input: WorkplacePlanningTransitionInput,
  options: WorkplacePlanningElevatedCommandOptions
) {
  return scenarioCommand(scenarioId, 'publish', input, options);
}

export async function previewWorkplacePlanningBookingImpact(
  scenarioId: string,
  input: WorkplacePlanningTransitionInput,
  options: WorkplacePlanningCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplacePlanningTransitionInput>(
    `${scenarioPath(scenarioId)}/booking-impact:preview`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplacePlanningBookingImpactCommandResult(response.data.data);
}
