import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';
import { assertAgentRevision, assertAgentUuid } from './agent-governed-api';
import {
  parseDwaionRoutineCapabilities,
  parseDwaionRoutineHealth,
  parseDwaionRoutineRollback,
  parseDwaionRoutineRun,
  parseDwaionRoutineVersions,
} from './agent-routine-execution-parser';
import { productSurfaceGovernedMutationConfig } from './product-surface-governed-mutation';

import type { ApiResponse } from '../types';
import type {
  DwaionRoutineExecutionRun,
  DwaionRoutineHealth,
  DwaionRoutineHighRiskCommand,
  DwaionRoutineRollbackReceipt,
  DwaionRoutineRunCommand,
  DwaionRoutineRuntimeCapabilities,
  DwaionRoutineVersionSnapshot,
  DwaionRoutineWebhookCommand,
} from './agent-routine-execution-contract';

export type * from './agent-routine-execution-contract';

const ROUTINE_BASE = '/api/agent/v1/routines';
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

export async function getDwaionRoutineRuntimeCapabilities(
  signal?: AbortSignal
): Promise<DwaionRoutineRuntimeCapabilities> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ROUTINE_BASE}/capabilities`, {
    signal,
  });
  return parseDwaionRoutineCapabilities(response.data.data);
}

export async function getDwaionRoutineRuns(
  routineId: string,
  limit = 30,
  signal?: AbortSignal
): Promise<DwaionRoutineExecutionRun[]> {
  assertAgentUuid(routineId, 'Routine identifier');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new TypeError('Routine run limit must be between 1 and 100.');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/runs?limit=${limit}`,
    { signal }
  );
  if (!Array.isArray(response.data.data))
    throw new HttpError('Routine execution list response is invalid.', 502, response.data);
  return response.data.data.map(parseDwaionRoutineRun);
}

export async function getDwaionRoutineRun(
  routineId: string,
  routineRunId: string,
  signal?: AbortSignal
): Promise<DwaionRoutineExecutionRun> {
  assertAgentUuid(routineId, 'Routine identifier');
  assertAgentUuid(routineRunId, 'Routine run identifier');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/runs/${encodeURIComponent(routineRunId)}`,
    { signal }
  );
  return parseDwaionRoutineRun(response.data.data);
}

export async function triggerDwaionRoutineRun(
  routineId: string,
  command: DwaionRoutineHighRiskCommand
): Promise<DwaionRoutineExecutionRun> {
  validateCommand(routineId, command);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/runs`,
    commandBody(command),
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  return parseDwaionRoutineRun(response.data.data);
}

export async function commandDwaionRoutineRun(
  routineId: string,
  routineRunId: string,
  command: DwaionRoutineRunCommand
): Promise<DwaionRoutineExecutionRun> {
  validateCommand(routineId, command);
  assertAgentUuid(routineRunId, 'Routine run identifier');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/runs/${encodeURIComponent(routineRunId)}/commands`,
    { ...commandBody(command), action: command.action },
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  return parseDwaionRoutineRun(response.data.data);
}

export async function triggerDwaionRoutineWebhook(
  routineId: string,
  command: DwaionRoutineWebhookCommand
): Promise<DwaionRoutineExecutionRun> {
  validateCommand(routineId, command);
  assertAgentUuid(command.eventId, 'Routine webhook event identifier');
  if (!/^[A-Z][A-Z0-9_.-]{1,63}$/u.test(command.eventType))
    throw new TypeError('Routine webhook event type is invalid.');
  if (
    !Number.isFinite(Date.parse(command.occurredAt)) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/u.test(command.occurredAt)
  )
    throw new TypeError('Routine webhook occurrence time is invalid.');
  if (command.payload !== undefined && !isJsonObject(command.payload))
    throw new TypeError('Routine webhook payload is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/webhook-events`,
    {
      ...commandBody(command),
      eventId: command.eventId,
      eventType: command.eventType,
      occurredAt: command.occurredAt,
      payload: command.payload ?? {},
    },
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  return parseDwaionRoutineRun(response.data.data);
}

export async function getDwaionRoutineVersions(
  routineId: string,
  signal?: AbortSignal
): Promise<DwaionRoutineVersionSnapshot[]> {
  assertAgentUuid(routineId, 'Routine identifier');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/versions`,
    { signal }
  );
  return parseDwaionRoutineVersions(response.data.data);
}

export async function rollbackDwaionRoutineVersion(
  routineId: string,
  targetRevision: number,
  command: DwaionRoutineHighRiskCommand
): Promise<DwaionRoutineRollbackReceipt> {
  validateCommand(routineId, command);
  assertAgentRevision(targetRevision, 'Routine rollback target revision', 1);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/versions/${targetRevision}/rollback`,
    commandBody(command),
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  const receipt = parseDwaionRoutineRollback(response.data.data);
  if (receipt.routineId !== routineId || receipt.targetRevision !== targetRevision)
    throw new HttpError('Routine rollback response binding is invalid.', 502, response.data);
  return receipt;
}

export async function getDwaionRoutineHealth(
  routineId: string,
  signal?: AbortSignal
): Promise<DwaionRoutineHealth> {
  assertAgentUuid(routineId, 'Routine identifier');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/health`,
    { signal }
  );
  const health = parseDwaionRoutineHealth(response.data.data);
  if (health.routineId !== routineId)
    throw new HttpError('Routine health response binding is invalid.', 502, response.data);
  return health;
}

export async function downloadDwaionRoutineTelemetry(routineId: string): Promise<Blob> {
  assertAgentUuid(routineId, 'Routine identifier');
  const response = await axiosInstance.get<Blob>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/telemetry/download`,
    { responseType: 'blob', headers: { Accept: 'application/x-ndjson' } }
  );
  if (!(response.data instanceof Blob))
    throw new HttpError('Routine telemetry response is invalid.', 502, response.data);
  return response.data;
}

function validateCommand(routineId: string, command: DwaionRoutineHighRiskCommand) {
  assertAgentUuid(routineId, 'Routine identifier');
  assertAgentUuid(command.commandId, 'Routine command identifier');
  assertAgentRevision(command.expectedRevision, 'Routine command revision', 1);
  if (!/^[A-Z][A-Z0-9_.-]{1,63}$/u.test(command.reasonCode))
    throw new TypeError('Routine command reason code is invalid.');
  if (command.changeReason.trim().length < 5)
    throw new TypeError('Routine command change reason is required.');
}

function commandBody(command: DwaionRoutineHighRiskCommand) {
  return {
    commandId: command.commandId,
    expectedRevision: command.expectedRevision,
    reasonCode: command.reasonCode,
    changeReason: command.changeReason.trim(),
  };
}

export function newDwaionRoutineCommandId(): string {
  return crypto.randomUUID();
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length <= 100 &&
    Object.values(value).every((item) => isJsonValue(item, 0))
  );
}

function isJsonValue(value: unknown, depth: number): boolean {
  if (depth > 10) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return value.length <= 100 && value.every((item) => isJsonValue(item, depth + 1));
  if (
    typeof value !== 'object' ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null)
  )
    return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length <= 100 && entries.every(([, item]) => isJsonValue(item, depth + 1));
}
