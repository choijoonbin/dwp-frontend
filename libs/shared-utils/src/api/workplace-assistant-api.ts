import { axiosInstance } from '../axios-instance';
import {
  parseWorkplaceAssistantAuditEvents,
  parseWorkplaceAssistantCommandResult,
  parseWorkplaceAssistantExecution,
  parseWorkplaceAssistantFeedbackReceipt,
  parseWorkplaceAssistantGovernance,
  parseWorkplaceAssistantGovernanceCommandResult,
  parseWorkplaceAssistantRequest,
} from './workplace-assistant-parser';

import type { ApiResponse } from '../types';
import type {
  WorkplaceAssistantConfirmInput,
  WorkplaceAssistantCreateInput,
  WorkplaceAssistantFeedbackInput,
  WorkplaceAssistantGovernanceInput,
  WorkplaceAssistantValidateInput,
} from './workplace-assistant-contract';

const USER_BASE = '/api/platform/v1/workplace/assistant';
const ADMIN_BASE = '/api/platform/v1/admin/workplace/assistant';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type WorkplaceAssistantCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode?: 'ELEVATED';
}>;

function requestId(value: string) {
  if (!UUID.test(value)) throw new Error('A valid Workplace Assistant request id is required.');
  return encodeURIComponent(value);
}

function commandHeaders(options: WorkplaceAssistantCommandOptions, elevated = false) {
  if (!options.idempotencyKey.trim() || options.idempotencyKey.length > 160) {
    throw new Error('A valid Workplace Assistant idempotency key is required.');
  }
  if (elevated && options.activeAccessMode !== 'ELEVATED') {
    throw new Error('Elevated access is required for Workplace Assistant governance.');
  }
  return {
    'Idempotency-Key': options.idempotencyKey,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
    ...(options.activeAccessMode ? { 'X-DWP-Active-Access-Mode': options.activeAccessMode } : {}),
  };
}

export async function createWorkplaceAssistantRequest(
  input: WorkplaceAssistantCreateInput,
  options: WorkplaceAssistantCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceAssistantCreateInput>(
    `${USER_BASE}/requests`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceAssistantCommandResult(response.data.data);
}

export async function getWorkplaceAssistantRequest(id: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${USER_BASE}/requests/${requestId(id)}`
  );
  return parseWorkplaceAssistantRequest(response.data.data);
}

export async function validateWorkplaceAssistantRequest(
  id: string,
  input: WorkplaceAssistantValidateInput,
  options: WorkplaceAssistantCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceAssistantValidateInput>(
    `${USER_BASE}/requests/${requestId(id)}:validate`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceAssistantCommandResult(response.data.data);
}

export async function confirmWorkplaceAssistantRequest(
  id: string,
  input: WorkplaceAssistantConfirmInput,
  options: WorkplaceAssistantCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceAssistantConfirmInput>(
    `${USER_BASE}/requests/${requestId(id)}:confirm`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceAssistantCommandResult(response.data.data);
}

export async function getWorkplaceAssistantExecution(id: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${USER_BASE}/requests/${requestId(id)}/execution`
  );
  return parseWorkplaceAssistantExecution(response.data.data);
}

export async function submitWorkplaceAssistantFeedback(
  id: string,
  input: WorkplaceAssistantFeedbackInput,
  options: WorkplaceAssistantCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceAssistantFeedbackInput>(
    `${USER_BASE}/requests/${requestId(id)}:feedback`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceAssistantFeedbackReceipt(response.data.data);
}

export async function getWorkplaceAssistantGovernance() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ADMIN_BASE}/governance`);
  return parseWorkplaceAssistantGovernance(response.data.data);
}

export async function updateWorkplaceAssistantGovernance(
  input: WorkplaceAssistantGovernanceInput,
  options: WorkplaceAssistantCommandOptions
) {
  const response = await axiosInstance.put<ApiResponse<unknown>, WorkplaceAssistantGovernanceInput>(
    `${ADMIN_BASE}/governance`,
    input,
    { headers: commandHeaders(options, true) }
  );
  return parseWorkplaceAssistantGovernanceCommandResult(response.data.data);
}

export async function getWorkplaceAssistantAuditEvents(options?: {
  requestId?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (options?.requestId) query.set('requestId', requestId(options.requestId));
  if (options?.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500) {
      throw new Error('Workplace Assistant audit limit must be between 1 and 500.');
    }
    query.set('limit', String(options.limit));
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/audit-events${suffix}`
  );
  return parseWorkplaceAssistantAuditEvents(response.data.data);
}
